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

@Injectable({
  providedIn: 'root'
})
export class LocalStorageService implements IStorageService {
  private readonly platformId = inject(PLATFORM_ID);
  
  // Internal signals
  private readonly _isReady = signal(false);
  private readonly _history = signal<readonly HistoryItem[]>([]);
  private readonly _error = signal<string | undefined>(undefined);
    // Computed state signals
  public readonly state: Signal<StorageState> = computed(() => ({
    mode: StorageMode.LOCAL_STORAGE,
    isReady: this._isReady(),
    info: this.storageInfo(),
    history: this._history(),
    error: this._error()
  }));
  
  public readonly storageInfo: Signal<StorageInfo> = computed(() => 
    StorageCapacityManager.calculateStorageInfo(this._history())
  );
  
  public readonly history: Signal<readonly HistoryItem[]> = computed(() => this._history());

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private getStorageCapacity(): number {
    // Return conservative estimate for localStorage capacity
    return 5 * 1024 * 1024; // 5MB
  }
  /**
   * Initialize storage system
   */
  initialize(): Result<boolean, string> {
    if (!this.isBrowser) {
      Logger.warn('LocalStorage not available (SSR)', 'LocalStorageService');
      return failure('LocalStorage not available in server environment');
    }

    try {
      // For now, just mark as ready
      this._isReady.set(true);
      this._error.set(undefined);
      Logger.info('Storage initialized successfully', 'LocalStorageService');
      return success(true);
    } catch (error) {
      const errorMessage = `Storage initialization failed: ${error}`;
      Logger.error(errorMessage, 'LocalStorageService');
      this._error.set(errorMessage);
      return failure(errorMessage);
    }
  }
  /**
   * Store a history item
   */
  storeItem(item: HistoryItem): Result<boolean, string> {
    try {
      if (!this._isReady()) {
        return failure('Storage not initialized');
      }

      const currentHistory = this._history();
      const existingIndex = currentHistory.findIndex(h => h.id === item.id);
      
      if (existingIndex >= 0) {
        // Update existing item
        const newHistory = [...currentHistory];
        newHistory[existingIndex] = item;
        this._history.set(newHistory);
      } else {
        // Add new item
        this._history.set([...currentHistory, item]);
      }

      Logger.info(`Stored item: ${item.id}`, 'LocalStorageService');
      return success(true);
    } catch (error) {
      const errorMessage = `Failed to store item: ${error}`;
      Logger.error(errorMessage, 'LocalStorageService');
      return failure(errorMessage);
    }
  }
  /**
   * Remove a history item
   */
  removeItem(itemId: string): Result<boolean, string> {
    try {
      if (!this._isReady()) {
        return failure('Storage not initialized');
      }

      const currentHistory = this._history();
      const filteredHistory = currentHistory.filter(item => item.id !== itemId);
      
      if (filteredHistory.length === currentHistory.length) {
        return failure(`Item with ID ${itemId} not found`);
      }

      this._history.set(filteredHistory);
      Logger.info(`Removed item: ${itemId}`, 'LocalStorageService');
      return success(true);
    } catch (error) {
      const errorMessage = `Failed to remove item: ${error}`;
      Logger.error(errorMessage, 'LocalStorageService');
      return failure(errorMessage);
    }
  }
  /**
   * Clear all history
   */
  clearHistory(): Result<boolean, string> {
    try {
      if (!this._isReady()) {
        return failure('Storage not initialized');
      }

      this._history.set([]);
      Logger.info('Cleared all history', 'LocalStorageService');
      return success(true);
    } catch (error) {
      const errorMessage = `Failed to clear history: ${error}`;
      Logger.error(errorMessage, 'LocalStorageService');
      return failure(errorMessage);
    }
  }
  /**
   * Get a specific history item
   */
  getItem(itemId: string): Result<HistoryItem, string> {
    try {
      if (!this._isReady()) {
        return failure('Storage not initialized');
      }

      const item = this._history().find(h => h.id === itemId);
      if (!item) {
        return failure(`Item with ID ${itemId} not found`);
      }

      return success(item);
    } catch (error) {
      const errorMessage = `Failed to get item: ${error}`;
      Logger.error(errorMessage, 'LocalStorageService');
      return failure(errorMessage);
    }
  }
  /**
   * Check if an item can be stored without exceeding limits
   */
  canStore(itemSize: number): boolean {
    return StorageCapacityManager.canStoreItem(this._history(), itemSize);
  }

  /**
   * Get storage capacity information
   */
  getCapacityInfo(): StorageInfo {
    return this.storageInfo();
  }
}
