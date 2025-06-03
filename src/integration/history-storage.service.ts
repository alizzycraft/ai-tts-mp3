// Integration layer wrapper for history storage
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { 
  HistoryItem, 
  StorageInfo 
} from '../infrastructure/storage/storage-types';
// Import the new, focused storage services
import { HistoryManagementService } from '../infrastructure/storage/history-management.service';
import { FileSystemStorageManagerService } from '../infrastructure/storage/file-system-storage-manager.service';
import { StorageStateService, FileSystemStorageState, FolderReconnectionPrompt } from '../infrastructure/storage/storage-state.service';
import { StorageInfoService } from '../infrastructure/storage/storage-info.service';
// import { FileSystemStorageService } from '../infrastructure/storage/file-system-storage.service'; // Removed as it's no longer used directly here
import { TTSSettings, TTSResult } from '../domain/tts.entity';
import { LoggingService } from './logging.service';
import { MonitoringService } from './monitoring.service';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class IntegratedHistoryStorageService {  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private logging: LoggingService,
    private monitoring: MonitoringService,
    // Inject the new, focused storage services
    private historyManagement: HistoryManagementService,
    private fileSystemManager: FileSystemStorageManagerService,
    private storageState: StorageStateService,
    private storageInfo: StorageInfoService
  ) {
    this.logging.info('IntegratedHistoryStorageService initialized', 'History');
    if (this.isBrowser) {
      // Delegate initialization to FileSystemStorageManagerService and handle its response
      this.initializeFileSystemStorage();
    }
  }

  private async initializeFileSystemStorage() {
    try {
      // Initialize and get response about user interaction
      const initResult = await this.fileSystemManager.initializeService();
      this.logging.debug('FileSystem storage initialization result:', 'History', initResult);

      if (!initResult.success) {
        this.logging.warn('FileSystem storage initialization failed', 'History');
        return;
      }

      // If we're waiting for user response, let the modal+reconnection flow handle loading
      if (initResult.waitingForUser) {
        this.logging.debug('Waiting for user response to reconnection prompt', 'History');
        return;
      }

      // Otherwise we've loaded successfully (either with or without filesystem access)
      this.logging.info('FileSystem storage initialized successfully', 'History');
    } catch (error) {
      this.logging.error('Error during file system initialization', error as Error, 'History');
    }
  }

  /** true only when running in a browser (not during SSR) */
  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  // Observables - Delegate to focused services
  get history$(): Observable<HistoryItem[]> {
    return this.historyManagement.history$;
  }

  get storageInfo$(): Observable<StorageInfo> {
    return this.storageInfo.storageInfo$;
  }

  get fileSystemState$(): Observable<FileSystemStorageState> {
    return this.storageState.fileSystemState$;
  }

  get folderReconnectionPrompt$(): Observable<FolderReconnectionPrompt | null> {
    return this.storageState.folderReconnectionPrompt$;
  }

  // History operations - map to correct infrastructure method names
  async getHistoryItems(): Promise<HistoryItem[]> {
    return this.logging.trackPerformance(
      'getHistoryItems',
      async () => {
        this.logging.debug('Retrieving history items', 'History');
        // Delegate directly to HistoryManagementService
        const items = this.historyManagement.getHistory();
        this.logging.info(`Retrieved ${items.length} history items`, 'History');

        return items;
      },
      'History'
    );
  }

  async deleteHistoryItem(id: string): Promise<void> {
    return this.logging.trackPerformance(
      'deleteHistoryItem',
      async () => {
        this.logging.info('Deleting history item', 'History', { itemId: id });
        // Delegate directly to HistoryManagementService
        await this.historyManagement.removeFromHistory(id);
        this.logging.info('History item deleted successfully', 'History', { itemId: id });
        this.updateStorageMetrics();
      },
      'History'
    );
  }

  // Method aliases for backward compatibility (delegate to infrastructure service)
  async removeFromHistory(id: string): Promise<void> {
    // Delegate directly to HistoryManagementService
    await this.historyManagement.removeFromHistory(id);
  }

  async clearHistory(): Promise<boolean> {
    // Delegate directly to HistoryManagementService
    return await this.historyManagement.clearHistory();
  }

  async clearAllHistory(): Promise<boolean> {
    // Delegate directly to HistoryManagementService
    return await this.historyManagement.clearHistory();
  }

  getStorageInfo(): StorageInfo {
    // Delegate directly to StorageInfoService
    return this.storageInfo.getStorageInfo();
  }

  // File system operations - Delegate to infrastructure service
  getFileSystemState(): FileSystemStorageState {
    // Delegate directly to StorageStateService
    return this.storageState.getFileSystemState();
  }

  async enableFileSystemStorage(): Promise<{ success: boolean; error?: string }> {
    // Delegate directly to FileSystemStorageManagerService
    return await this.fileSystemManager.enableFileSystemStorage();
  }

  async disableFileSystemStorage(): Promise<boolean> {
    // Delegate directly to FileSystemStorageManagerService
    return await this.fileSystemManager.disableFileSystemStorage();
  }

  async handleFolderReconnection(reconnect: boolean): Promise<void> {
    // Delegate user decision to FileSystemStorageManagerService
    await this.fileSystemManager.handleFolderReconnection(reconnect);
  }

  // Additional history management methods - Delegate to infrastructure service
  async addToHistory(
    text: string,
    settings: TTSSettings,
    result: TTSResult,
    metadata?: { title?: string; tags?: string[]; duration?: number }
  ): Promise<{ success: boolean; warnings?: string[]; removed?: HistoryItem[] }> {
    // Delegate directly to HistoryManagementService
    return await this.historyManagement.addToHistory(text, settings, result, metadata);
  }

  getItemsToBeRemoved(newItemSize: number): HistoryItem[] {
    // Delegate directly to StorageInfoService
    return this.storageInfo.getItemsToBeRemoved(this.historyManagement.getHistory(), newItemSize, this.storageState.getFileSystemState());
  }

  // Private utility methods
  private updateStorageMetrics(): void {
    try {
      const storageInfo = this.getStorageInfo();
      const used = storageInfo.used;
      const available = storageInfo.available;
      const total = storageInfo.total;
      const percentageUsed = storageInfo.usedPercentage;
      
      this.monitoring.updateStorageMetrics(used, available);
      this.logging.debug('Storage metrics updated', 'History', { 
        used, 
        available, 
        total,
        percentageUsed: percentageUsed * 100, // Convert to percentage for display
        itemCount: storageInfo.itemCount
      });
    } catch (error) {
      this.logging.warn('Failed to update storage metrics', 'History', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  // Enhanced history operations with monitoring - Delegate to infrastructure service and add monitoring
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

        // Delegate directly to HistoryManagementService
        const historyResult = await this.historyManagement.addToHistory(text, settings, result, metadata);
        
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
