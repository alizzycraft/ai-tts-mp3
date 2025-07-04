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
import { HistoryItem, StorageState, StorageInfo } from '../../domain/storage.entity';

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
    isReady: this._isReady(),
    error: this._error()
  }));
  
  public readonly storageInfo: Signal<StorageInfo> = computed(() => ({
    totalItems: this._history().length,
    totalSize: this._history().reduce((sum, item) => sum + item.audioSize, 0),
    storageCapacity: this.getStorageCapacity(),
    isNearLimit: false
  }));
  
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
  initialize(): Signal<Result<boolean, string>> {
    if (!this.isBrowser) {
      Logger.warn('LocalStorage not available (SSR)', 'LocalStorageService');
      return signal(failure('LocalStorage not available in server environment'));
    }

    try {
      // For now, just mark as ready
      this._isReady.set(true);
      this._error.set(undefined);
      Logger.info('Storage initialized successfully', 'LocalStorageService');
      return signal(success(true));
    } catch (error) {
      const errorMessage = `Storage initialization failed: ${error}`;
      Logger.error(errorMessage, 'LocalStorageService');
      this._error.set(errorMessage);
      return signal(failure(errorMessage));
    }
  }

  /**
   * Store a history item
   */
  storeItem(item: HistoryItem): Signal<Result<boolean, string>> {
    try {
      if (!this._isReady()) {
        return signal(failure('Storage not initialized'));
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
      return signal(success(true));
    } catch (error) {
      const errorMessage = `Failed to store item: ${error}`;
      Logger.error(errorMessage, 'LocalStorageService');
      return signal(failure(errorMessage));
    }
  }

  /**
   * Remove a history item
   */
  removeItem(itemId: string): Signal<Result<boolean, string>> {
    try {
      if (!this._isReady()) {
        return signal(failure('Storage not initialized'));
      }

      const currentHistory = this._history();
      const filteredHistory = currentHistory.filter(item => item.id !== itemId);
      
      if (filteredHistory.length === currentHistory.length) {
        return signal(failure(`Item with ID ${itemId} not found`));
      }

      this._history.set(filteredHistory);
      Logger.info(`Removed item: ${itemId}`, 'LocalStorageService');
      return signal(success(true));
    } catch (error) {
      const errorMessage = `Failed to remove item: ${error}`;
      Logger.error(errorMessage, 'LocalStorageService');
      return signal(failure(errorMessage));
    }
  }

  /**
   * Clear all history
   */
  clearHistory(): Signal<Result<boolean, string>> {
    try {
      if (!this._isReady()) {
        return signal(failure('Storage not initialized'));
      }

      this._history.set([]);
      Logger.info('Cleared all history', 'LocalStorageService');
      return signal(success(true));
    } catch (error) {
      const errorMessage = `Failed to clear history: ${error}`;
      Logger.error(errorMessage, 'LocalStorageService');
      return signal(failure(errorMessage));
    }
  }

  /**
   * Get a specific history item
   */
  getItem(itemId: string): Signal<Result<HistoryItem, string>> {
    try {
      if (!this._isReady()) {
        return signal(failure('Storage not initialized'));
      }

      const item = this._history().find(h => h.id === itemId);
      if (!item) {
        return signal(failure(`Item with ID ${itemId} not found`));
      }

      return signal(success(item));
    } catch (error) {
      const errorMessage = `Failed to get item: ${error}`;
      Logger.error(errorMessage, 'LocalStorageService');
      return signal(failure(errorMessage));
    }
  }
}
