/**
 * Storage Integration Service
 * Integration layer that coordinates storage operations and provides
 * higher-level storage functionality to the presentation layer
 */

import { Injectable, signal, computed, inject, Signal } from '@angular/core';
import { Result, success, failure } from '../../common/result';
import { Logger } from '../../common/utils';
import { IStorageService } from '../../domain/interfaces/storage.service.interface';
import { LocalStorageService } from '../../infrastructure/storage/local-storage.service';
import { HistoryItem, HistoryItemFactory } from '../../domain/storage.entity';
import { TTSQuery } from '../../domain/tts.entity';
import { TTSResponse } from '../../infrastructure/tts/interfaces/tts-provider.interface';

export interface StorageIntegrationState {
  readonly isInitialized: boolean;
  readonly storageReady: boolean;
  readonly lastError?: string;
}

@Injectable({
  providedIn: 'root'
})
export class StorageIntegrationService {
  private readonly storageService: IStorageService = inject(LocalStorageService);

  // Signal-based state management
  private readonly _integrationState = signal<StorageIntegrationState>({
    isInitialized: false,
    storageReady: false
  });

  // Public readonly signals
  public readonly integrationState = this._integrationState.asReadonly();
  public readonly storageState = this.storageService.state;
  public readonly storageInfo = this.storageService.storageInfo;
  public readonly history = this.storageService.history;

  // Computed signals for UI convenience
  public readonly isReady = computed(() => 
    this._integrationState().isInitialized && this.storageService.state().isReady
  );

  public readonly hasHistory = computed(() => 
    this.storageService.history().length > 0
  );

  public readonly isNearCapacity = computed(() => 
    this.storageService.storageInfo().isNearFull
  );

  public readonly isCriticalCapacity = computed(() => 
    this.storageService.storageInfo().isCritical
  );
  /**
   * Initialize the storage integration service
   */
  initialize(): Result<boolean, string> {
    Logger.info('Initializing storage integration', 'StorageIntegrationService');

    try {
      // Initialize underlying storage service
      const storageResult = this.storageService.initialize();

      if (storageResult.isSuccess) {
        this._integrationState.set({
          isInitialized: true,
          storageReady: true,
          lastError: undefined
        });

        Logger.info('Storage integration initialized successfully', 'StorageIntegrationService');
        return success(true);
      } else {
        this._integrationState.set({
          isInitialized: false,
          storageReady: false,
          lastError: storageResult.error
        });

        Logger.error('Storage integration failed', 'StorageIntegrationService', storageResult.error);
        return failure(storageResult.error);
      }
    } catch (error) {
      const errorMessage = `Storage integration initialization failed: ${error}`;
      this._integrationState.set({
        isInitialized: false,
        storageReady: false,
        lastError: errorMessage
      });

      Logger.error(errorMessage, 'StorageIntegrationService');
      return failure(errorMessage);
    }
  }
  /**
   * Store TTS generation result
   */
  storeTTSResult(
    query: TTSQuery, 
    response: TTSResponse, 
    metadata?: HistoryItem['metadata']
  ): Result<boolean, string> {
    if (!this.isReady()) {
      return failure('Storage integration not ready');
    }

    try {
      // Create history item from TTS generation
      const historyItem = HistoryItemFactory.fromTTSGeneration(
        query,
        response.audioData,
        response.duration,
        metadata
      );

      // Check if we can store the item
      if (!this.storageService.canStore(historyItem.audioSize)) {
        Logger.warn(`Cannot store item ${historyItem.id} - insufficient capacity`, 'StorageIntegrationService');
      }

      // Store the item
      const storeResult = this.storageService.storeItem(historyItem);

      if (storeResult.isSuccess) {
        Logger.info(`Stored TTS result ${historyItem.id}`, 'StorageIntegrationService');
        return success(true);
      } else {
        Logger.error('Failed to store TTS result', 'StorageIntegrationService', storeResult.error);
        this._integrationState.update(state => ({
          ...state,
          lastError: storeResult.error
        }));
        return failure(storeResult.error);
      }
    } catch (error) {
      const errorMessage = `Failed to store TTS result: ${error}`;
      Logger.error(errorMessage, 'StorageIntegrationService');
      this._integrationState.update(state => ({
        ...state,
        lastError: errorMessage
      }));
      return failure(errorMessage);
    }
  }
  /**
   * Remove history item by ID
   */
  removeHistoryItem(itemId: string): Result<boolean, string> {
    if (!this.isReady()) {
      return failure('Storage integration not ready');
    }

    return this.storageService.removeItem(itemId);
  }

  /**
   * Clear all history
   */
  clearAllHistory(): Result<boolean, string> {
    if (!this.isReady()) {
      return failure('Storage integration not ready');
    }

    return this.storageService.clearHistory();
  }

  /**
   * Get history item by ID
   */
  getHistoryItem(itemId: string): Result<HistoryItem, string> {
    if (!this.isReady()) {
      return failure('Storage integration not ready');
    }

    return this.storageService.getItem(itemId);
  }
  /**
   * Search history items by text content
   */
  searchHistory(searchTerm: string): Signal<readonly HistoryItem[]> {
    return computed(() => {
      if (!this.isReady()) {
        return [];
      }

      try {
        const allHistory = this.storageService.history();
        const searchTermLower = searchTerm.toLowerCase().trim();

        if (!searchTermLower) {
          return allHistory;
        }

        return allHistory.filter(item => 
          item.text.toLowerCase().includes(searchTermLower) ||
          item.metadata?.title?.toLowerCase().includes(searchTermLower) ||
          item.metadata?.tags?.some(tag => tag.toLowerCase().includes(searchTermLower))
        );
      } catch (error) {
        Logger.error(`Search failed: ${error}`, 'StorageIntegrationService');
        return [];
      }
    });
  }

  /**
   * Get history items sorted by creation date (newest first)
   */
  getHistorySorted(): Signal<readonly HistoryItem[]> {
    return computed(() => {
      if (!this.isReady()) {
        return [];
      }

      try {
        const allHistory = this.storageService.history();
        return [...allHistory].sort((a, b) => 
          b.createdAt.getTime() - a.createdAt.getTime()
        );
      } catch (error) {
        Logger.error(`Sort failed: ${error}`, 'StorageIntegrationService');
        return [];
      }
    });
  }

  /**
   * Get storage capacity warnings
   */
  getCapacityWarnings(): Signal<string[]> {
    return computed(() => {
      try {
        const info = this.storageService.storageInfo();
        const warnings: string[] = [];

        if (info.isCritical) {
          warnings.push(`Storage is critically full (${Math.round(info.usedPercentage * 100)}%). Old items will be automatically removed.`);
        } else if (info.isNearFull) {
          warnings.push(`Storage is nearly full (${Math.round(info.usedPercentage * 100)}%). Consider clearing old items.`);
        }

        if (info.itemCount > 50) {
          warnings.push(`You have ${info.itemCount} stored items. Consider organizing or removing unused items.`);
        }

        return warnings;
      } catch (error) {
        Logger.error(`Warning check failed: ${error}`, 'StorageIntegrationService');
        return [];
      }
    });
  }
  /**
   * Add metadata to existing history item
   */
  updateItemMetadata(
    itemId: string, 
    metadata: HistoryItem['metadata']
  ): Result<boolean, string> {
    if (!this.isReady()) {
      return failure('Storage integration not ready');
    }

    try {
      const getResult = this.storageService.getItem(itemId);

      if (!getResult.isSuccess) {
        return failure(getResult.error);
      }

      const updatedItem = HistoryItemFactory.withMetadata(getResult.value, metadata);

      // Remove old item and add updated one
      const removeResult = this.storageService.removeItem(itemId);

      if (!removeResult.isSuccess) {
        return failure(removeResult.error);
      }

      return this.storageService.storeItem(updatedItem);
    } catch (error) {
      const errorMessage = `Failed to update metadata: ${error}`;
      Logger.error(errorMessage, 'StorageIntegrationService');
      return failure(errorMessage);
    }
  }
}
