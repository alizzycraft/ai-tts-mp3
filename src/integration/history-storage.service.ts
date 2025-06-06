// Integration layer wrapper for history storage
import { Injectable, PLATFORM_ID, Signal, inject } from '@angular/core';
import { 
  HistoryItem, 
  StorageInfo 
} from '../domain/types/storage-types';
import { HistoryManagementService } from '../infrastructure/storage/history-management.service';
import { FileSystemStorageManagerService } from '../infrastructure/storage/file-system-storage-manager.service';
import { StorageStateService, FileSystemStorageState, FolderReconnectionPrompt } from '../domain/services/storage-state.service';
import { StorageInfoService } from '../infrastructure/storage/storage-info.service';
import { TTSSettings, TTSResult } from '../domain/entities/tts.entity';
import { LoggingService } from './logging.service';
import { MonitoringService } from './monitoring.service';
import { isPlatformBrowser } from '@angular/common';
import { IHistoryStorage } from './interfaces';

@Injectable({
  providedIn: 'root'
})
export class IntegratedHistoryStorageService implements IHistoryStorage {
  private platformId = inject(PLATFORM_ID);
  private logging = inject(LoggingService);
  private monitoring = inject(MonitoringService);
  private historyManagement = inject(HistoryManagementService);
  private fileSystemManager = inject(FileSystemStorageManagerService);
  private storageStateService = inject(StorageStateService);
  private storageInfoService = inject(StorageInfoService);

  private initialized = false;

  // Expose signals as per IHistoryStorage interface
  readonly items: Signal<HistoryItem[]>;
  readonly storage: Signal<StorageInfo>;
  readonly fileSystem: Signal<FileSystemStorageState>;
  readonly reconnection: Signal<FolderReconnectionPrompt | null>;

  constructor() {
    // Initialize signals directly from services
    this.items = this.historyManagement.history;
    this.storage = this.storageInfoService.storageInfo;
    this.fileSystem = this.storageStateService.fileSystemState;
    this.reconnection = this.storageStateService.folderReconnectionPrompt;

    if (this.isBrowser) {
      this.ensureInitialized().catch(error => 
        this.logging.error('Failed to initialize history storage', error as Error));
    }
  }

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      this.logging.debug('Initializing history storage services', 'History');
      
      // Initialize services in the right order
      await this.fileSystemManager.initializeService();
      await this.historyManagement.loadHistory();
      
      this.initialized = true;
      this.logging.info('History storage services initialized', 'History');
      
    } catch (err) {
      this.initialized = false;
      const error = err instanceof Error ? err : new Error(String(err));
      this.logging.error('Failed to initialize history storage', error);
      throw error;
    }
  }

  async enableFileSystemStorage(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.ensureInitialized();
      const result = await this.fileSystemManager.enableFileSystemStorage(false);
      if (!result.success) {
        return { success: false, error: result.error || 'Failed to enable file system storage' };
      }
      return { success: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unexpected error enabling file system storage';
      return { success: false, error };
    }
  }

  async disableFileSystemStorage(): Promise<void> {
    await this.ensureInitialized();
    const result = await this.fileSystemManager.disableFileSystemStorage();
    if (!result) {
      throw new Error('Failed to disable file system storage');
    }
    // Reload history from local storage
    await this.historyManagement.loadHistory();
  }

  async handleFolderReconnection(accepted: boolean): Promise<void> {
    await this.ensureInitialized();
    await this.fileSystemManager.handleFolderReconnection(accepted);
  }

  async deleteHistoryItem(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.historyManagement.removeFromHistory(id);
  }

  async clearHistory(): Promise<void> {
    await this.ensureInitialized();
    await this.historyManagement.clearHistory();
  }

  // Additional history management methods - Delegate to infrastructure service
  async addToHistory(
    text: string,
    settings: TTSSettings,
    result: TTSResult,
    metadata?: { title?: string; tags?: string[]; duration?: number }
  ): Promise<{ success: boolean; warnings?: string[]; removed?: HistoryItem[] }> {
    await this.ensureInitialized();
    return await this.historyManagement.addToHistory(text, settings, result, metadata);
  }

  getItemsToBeRemoved(newItemSize: number): HistoryItem[] {
    return this.storageInfoService.getItemsToBeRemoved(
      this.items(), 
      newItemSize,
      this.fileSystem()
    );
  }

  getStorageInfo(): StorageInfo {
    return this.storage();
  }

  getFileSystemState(): FileSystemStorageState {
    return this.fileSystem();
  }

  // Private utility methods
  private updateStorageMetrics(): void {
    try {
      const info = this.storage();
      const used = info.used;
      const available = info.available;
      const total = info.total;
      const percentageUsed = info.usedPercentage;
      
      this.monitoring.updateStorageMetrics(used, available);
      this.logging.debug('Storage metrics updated', 'History', { 
        used, 
        available, 
        total,
        percentageUsed: percentageUsed * 100, // Convert to percentage for display
        itemCount: info.itemCount
      });
    } catch (error) {
      this.logging.warn('Failed to update storage metrics', 'History', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  // Enhanced history operations with monitoring
  async addToHistoryWithMonitoring(
    text: string,
    settings: TTSSettings,
    result: TTSResult,
    metadata?: { title?: string; tags?: string[]; duration?: number }
  ): Promise<{ success: boolean; warnings?: string[]; removed?: HistoryItem[] }> {
    return this.logging.trackPerformance(
      'addToHistory',
      async () => {
        this.logging.info('Adding item to history', 'History', { 
          textLength: text.length, 
          provider: settings.provider,
          hasMetadata: !!metadata 
        });

        const historyResult = await this.addToHistory(text, settings, result, metadata);
        
        if (historyResult.success) {
          this.logging.info('Item added to history successfully', 'History', {
            warningsCount: historyResult.warnings?.length || 0,
            removedCount: historyResult.removed?.length || 0
          });
          this.updateStorageMetrics();
        } else {
          this.logging.warn('Failed to add item to history', 'History');
        }

        return historyResult;
      },
      'History'
    );
  }
}

// Re-export types for convenience
export type { HistoryItem, StorageInfo, FileSystemStorageState, FolderReconnectionPrompt, TTSResult };
