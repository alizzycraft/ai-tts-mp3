/**
 * Local Storage Service Implementation
 * Infrastructure layer - handles browser localStorage operations
 * Uses signal-based reactive patterns following onion architecture
 */

import { Injectable, signal, computed, PLATFORM_ID, inject, Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Result, success, failure } from '../../common/result';
import { Logger } from '../../common/utils';
import { IStorageService } from '../../domain/interfaces/storage.service.interface';
import { HistoryItem, StorageState, StorageInfo, StorageMode, StorageCapacityManager } from '../../domain/storage.entity';

interface SerializedHistoryItem {  readonly id: string;
  readonly text: string;
  readonly settings: unknown;
  readonly audioData: number[];
  readonly audioSize: number;
  readonly createdAt: string;
  readonly duration?: number;
  readonly metadata?: HistoryItem['metadata'];
}

@Injectable({
  providedIn: 'root'
})
export class LocalStorageService implements IStorageService {
  private static readonly STORAGE_KEY = 'ai-tts-mp3-history';
  private static readonly VERSION_KEY = 'ai-tts-mp3-version';
  private static readonly CURRENT_VERSION = '1.0.0';

  private readonly platformId = inject(PLATFORM_ID);

  // Signal-based state management
  private readonly _history = signal<readonly HistoryItem[]>([]);
  private readonly _isReady = signal<boolean>(false);
  private readonly _error = signal<string | undefined>(undefined);

  // Computed storage info
  private readonly _storageInfo = computed(() => 
    StorageCapacityManager.calculateStorageInfo(this._history())
  );

  // Computed storage state
  private readonly _state = computed<StorageState>(() => ({
    mode: StorageMode.LOCAL_STORAGE,
    isReady: this._isReady(),
    info: this._storageInfo(),
    history: this._history(),
    error: this._error()
  }));  // Public readonly signals  
  public readonly state: Signal<StorageState> = computed(() => this._state());
  public readonly storageInfo: Signal<StorageInfo> = computed(() => this._storageInfo());
  public readonly history: Signal<readonly HistoryItem[]> = computed(() => this._history());

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
  initialize(): Signal<Result<boolean, string>> {
    const initSignal = signal<Result<boolean, string>>(success(false));

    if (!this.isBrowser) {
      Logger.warn('LocalStorage not available (SSR)', 'LocalStorageService');
      const error = 'LocalStorage not available in server environment';
      this._error.set(error);
      initSignal.set(failure(error));
      return computed(() => initSignal());
    }

    try {
      // Check for version compatibility
      this.checkVersion();
      
      // Load existing history
      const loadResult = this.loadHistoryFromStorage();
      if (loadResult.isSuccess) {
        this._history.set(loadResult.value);
        this._isReady.set(true);
        this._error.set(undefined);
        
        Logger.info(`Loaded ${loadResult.value.length} history items`, 'LocalStorageService');
        initSignal.set(success(true));
      } else {
        Logger.error('Failed to load history', 'LocalStorageService', loadResult.error);
        this._error.set(loadResult.error);
        initSignal.set(failure(loadResult.error));
      }
    } catch (error) {
      const errorMessage = `Storage initialization failed: ${error}`;
      Logger.error(errorMessage, 'LocalStorageService');
      this._error.set(errorMessage);      initSignal.set(failure(errorMessage));
    }

    return computed(() => initSignal());
  }

  storeItem(item: HistoryItem): ReturnType<typeof signal<Result<boolean, string>>> {
    const storeSignal = signal<Result<boolean, string>>(success(false));

    if (!this._isReady()) {
      const error = 'Storage not initialized';
      storeSignal.set(failure(error));
      return storeSignal.asReadonly();
    }

    try {
      const currentHistory = this._history();
      
      // Check if item already exists
      if (currentHistory.some(h => h.id === item.id)) {
        const error = `Item with ID ${item.id} already exists`;
        storeSignal.set(failure(error));
        return storeSignal.asReadonly();
      }

      // Check storage capacity and remove old items if needed
      const itemsToRemove = StorageCapacityManager.getItemsToRemove(currentHistory, item.audioSize);
      
      let updatedHistory = currentHistory;
      if (itemsToRemove.length > 0) {
        Logger.info(`Removing ${itemsToRemove.length} old items to make space`, 'LocalStorageService');
        updatedHistory = currentHistory.filter(h => 
          !itemsToRemove.some(r => r.id === h.id)
        );
      }

      // Add new item
      const newHistory = [...updatedHistory, item];

      // Save to localStorage
      const saveResult = this.saveHistoryToStorage(newHistory);
      if (saveResult.isSuccess) {
        this._history.set(newHistory);
        this._error.set(undefined);
        
        Logger.info(`Stored item ${item.id}`, 'LocalStorageService');
        storeSignal.set(success(true));
      } else {
        Logger.error('Failed to save item', 'LocalStorageService', saveResult.error);
        this._error.set(saveResult.error);
        storeSignal.set(failure(saveResult.error));
      }
    } catch (error) {
      const errorMessage = `Failed to store item: ${error}`;
      Logger.error(errorMessage, 'LocalStorageService');
      this._error.set(errorMessage);
      storeSignal.set(failure(errorMessage));
    }

    return storeSignal.asReadonly();
  }

  removeItem(itemId: string): ReturnType<typeof signal<Result<boolean, string>>> {
    const removeSignal = signal<Result<boolean, string>>(success(false));

    if (!this._isReady()) {
      const error = 'Storage not initialized';
      removeSignal.set(failure(error));
      return removeSignal.asReadonly();
    }

    try {
      const currentHistory = this._history();
      const itemExists = currentHistory.some(h => h.id === itemId);
      
      if (!itemExists) {
        const error = `Item with ID ${itemId} not found`;
        removeSignal.set(failure(error));
        return removeSignal.asReadonly();
      }

      const updatedHistory = currentHistory.filter(h => h.id !== itemId);
      
      const saveResult = this.saveHistoryToStorage(updatedHistory);
      if (saveResult.isSuccess) {
        this._history.set(updatedHistory);
        this._error.set(undefined);
        
        Logger.info(`Removed item ${itemId}`, 'LocalStorageService');
        removeSignal.set(success(true));
      } else {
        Logger.error('Failed to save after removal', 'LocalStorageService', saveResult.error);
        this._error.set(saveResult.error);
        removeSignal.set(failure(saveResult.error));
      }
    } catch (error) {
      const errorMessage = `Failed to remove item: ${error}`;
      Logger.error(errorMessage, 'LocalStorageService');
      this._error.set(errorMessage);
      removeSignal.set(failure(errorMessage));
    }

    return removeSignal.asReadonly();
  }

  clearHistory(): ReturnType<typeof signal<Result<boolean, string>>> {
    const clearSignal = signal<Result<boolean, string>>(success(false));

    if (!this._isReady()) {
      const error = 'Storage not initialized';
      clearSignal.set(failure(error));
      return clearSignal.asReadonly();
    }

    try {
      const saveResult = this.saveHistoryToStorage([]);
      if (saveResult.isSuccess) {
        this._history.set([]);
        this._error.set(undefined);
        
        Logger.info('Cleared all history', 'LocalStorageService');
        clearSignal.set(success(true));
      } else {
        Logger.error('Failed to clear history', 'LocalStorageService', saveResult.error);
        this._error.set(saveResult.error);
        clearSignal.set(failure(saveResult.error));
      }
    } catch (error) {
      const errorMessage = `Failed to clear history: ${error}`;
      Logger.error(errorMessage, 'LocalStorageService');
      this._error.set(errorMessage);
      clearSignal.set(failure(errorMessage));
    }

    return clearSignal.asReadonly();
  }

  getItem(itemId: string): ReturnType<typeof signal<Result<HistoryItem, string>>> {
    const getSignal = signal<Result<HistoryItem, string>>(failure('Item not found'));

    if (!this._isReady()) {
      const error = 'Storage not initialized';
      getSignal.set(failure(error));
      return getSignal.asReadonly();
    }

    const item = this._history().find(h => h.id === itemId);
    if (item) {
      getSignal.set(success(item));
    } else {
      getSignal.set(failure(`Item with ID ${itemId} not found`));
    }

    return getSignal.asReadonly();
  }

  canStore(itemSize: number): boolean {
    return StorageCapacityManager.canStoreItem(this._history(), itemSize);
  }

  getCapacityInfo(): StorageInfo {
    return this._storageInfo();
  }

  // Private helper methods
  private checkVersion(): void {
    if (!this.isBrowser) return;

    try {
      const storedVersion = localStorage.getItem(LocalStorageService.VERSION_KEY);
      if (!storedVersion) {
        localStorage.setItem(LocalStorageService.VERSION_KEY, LocalStorageService.CURRENT_VERSION);
      } else if (storedVersion !== LocalStorageService.CURRENT_VERSION) {
        Logger.info(`Version upgrade: ${storedVersion} → ${LocalStorageService.CURRENT_VERSION}`, 'LocalStorageService');
        // Handle version migration if needed
        localStorage.setItem(LocalStorageService.VERSION_KEY, LocalStorageService.CURRENT_VERSION);
      }
    } catch (error) {
      Logger.warn('Failed to check version', 'LocalStorageService', error);
    }
  }

  private loadHistoryFromStorage(): Result<readonly HistoryItem[], string> {
    if (!this.isBrowser) {
      return failure('Not in browser environment');
    }

    try {
      const storedData = localStorage.getItem(LocalStorageService.STORAGE_KEY);
      if (!storedData) {
        return success([]);
      }

      const serializedItems: SerializedHistoryItem[] = JSON.parse(storedData);
      const historyItems = serializedItems.map(this.deserializeItem);

      return success(historyItems);
    } catch (error) {
      return failure(`Failed to load history: ${error}`);
    }
  }

  private saveHistoryToStorage(history: readonly HistoryItem[]): Result<boolean, string> {
    if (!this.isBrowser) {
      return failure('Not in browser environment');
    }

    try {
      const serializedItems = history.map(this.serializeItem);
      const dataString = JSON.stringify(serializedItems);
      
      localStorage.setItem(LocalStorageService.STORAGE_KEY, dataString);
      return success(true);
    } catch (error) {
      return failure(`Failed to save history: ${error}`);
    }
  }

  private serializeItem(item: HistoryItem): SerializedHistoryItem {
    return {
      id: item.id,
      text: item.text,
      settings: item.settings,
      audioData: Array.from(item.audioData),
      audioSize: item.audioSize,
      createdAt: item.createdAt.toISOString(),
      duration: item.duration,
      metadata: item.metadata
    };
  }

  private deserializeItem(serialized: SerializedHistoryItem): HistoryItem {
    return {
      id: serialized.id,
      text: serialized.text,
      settings: serialized.settings,
      audioData: new Uint8Array(serialized.audioData),
      audioSize: serialized.audioSize,
      createdAt: new Date(serialized.createdAt),
      duration: serialized.duration,
      metadata: serialized.metadata
    };
  }
}
