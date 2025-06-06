// History management service - handles CRUD operations for history items
import { Injectable, PLATFORM_ID, signal, computed, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HistoryItem } from '../../domain/types/storage-types';
import { TTSResult, TTSSettings } from '../../domain/entities/tts.entity';
import { DataSerializationService } from './data-serialization.service';
import { StorageInfoService } from './storage-info.service';
import { StorageStateService } from '../../domain/services/storage-state.service';
import { FileSystemOperationsService } from './file-system-operations.service';
import { StorageMigrationService } from './storage-migration.service';

@Injectable({
  providedIn: 'root'
})
export class HistoryManagementService {
  private platformId = inject(PLATFORM_ID);
  private serialization = inject(DataSerializationService);
  private storageInfo = inject(StorageInfoService);
  private storageState = inject(StorageStateService);
  private fileSystemOperations = inject(FileSystemOperationsService);
  private migration = inject(StorageMigrationService);

  private readonly METADATA_FILE = 'history-metadata.json';
  
  // Replace BehaviorSubject with signal
  private readonly _history = signal<HistoryItem[]>([]);
  
  // Public readonly computed signal
  readonly history = computed(() => this._history());

  /** true only when running in a browser (not during SSR) */
  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  // Current state getters
  getHistory(): HistoryItem[] {
    return this._history();
  }

  /**
   * Load history from either localStorage or file system
   */
  async loadHistory(): Promise<void> {
    if (!this.isBrowser) {
      this._history.set([]);
      this.updateStorageInfo();
      return;
    }

    const state = this.storageState.fileSystemState();
    console.log('[HistoryManagementService] loadHistory called with state:', {
      isEnabled: state.isEnabled,
      hasDirectoryHandle: !!state.directoryHandle
    });

    let history: HistoryItem[] = [];
    if (state.isEnabled && state.directoryHandle) {
      // Load from file system
      console.log('[HistoryManagementService] Loading history from file system...');
      history = await this.migration.loadFromFileSystem(state.directoryHandle);
      console.log(`[HistoryManagementService] Loaded ${history.length} items from file system`);
    } else {
      // Load from localStorage (fallback)
      console.log('[HistoryManagementService] Loading history from localStorage...');
      history = this.migration.loadFromLocalStorage();
      console.log(`[HistoryManagementService] Loaded ${history.length} items from localStorage`);
    }

    // Update signal with loaded history
    this._history.set(history);
    this.updateStorageInfo();
  }

  /**
   * Add new item to history
   */
  async addToHistory(
    text: string,
    settings: TTSSettings,
    result: TTSResult,
    metadata?: { title?: string; tags?: string[]; duration?: number }
  ): Promise<{ success: boolean; warnings?: string[]; removed?: HistoryItem[] }> {
    // Use current signal value
    let currentHistory = [...this._history()];
    const fileSystemState = this.storageState.fileSystemState();
    let removedItems: HistoryItem[] = [];
    const warnings: string[] = [];

    // Create the new history item
    const newItem = this.serialization.createHistoryItem(text, settings, result, metadata);

    // Check storage limits and remove oldest items if necessary (only for localStorage mode)
    if (!fileSystemState.isEnabled) {
      const itemsToBeRemoved = this.storageInfo.getItemsToBeRemoved(
        currentHistory,
        newItem.audioSize,
        fileSystemState
      );
      if (itemsToBeRemoved.length > 0) {
        removedItems = itemsToBeRemoved;
        warnings.push(`Storage limit exceeded. Removed ${removedItems.length} oldest item(s).`);

        // Remove the items from the current history array
        const removedIds = new Set(removedItems.map(item => item.id));
        currentHistory = currentHistory.filter(item => !removedIds.has(item.id));
      }
    }

    // Add the new item to the history (at the beginning for newest first)
    currentHistory.unshift(newItem);

    // Update the signal and save history
    this._history.set(currentHistory);
    await this.saveHistory(currentHistory);
    this.updateStorageInfo();

    console.log(`[HistoryManagementService] Added new item to history: ${newItem.id}`);
    return { success: true, warnings, removed: removedItems };
  }

  /**
   * Remove item from history
   */
  async removeFromHistory(itemId: string): Promise<boolean> {
    const currentHistory = this._history();
    const itemIndex = currentHistory.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      console.warn(`[HistoryManagementService] Item with ID ${itemId} not found in history.`);
      return false;
    }

    // Remove the item from history
    const updatedHistory = currentHistory.filter(item => item.id !== itemId);
    this._history.set(updatedHistory);

    // Delete audio file if using file system storage
    const fileSystemState = this.storageState.fileSystemState();
    if (fileSystemState.isEnabled && fileSystemState.directoryHandle) {
      await this.deleteAudioFile(itemId, fileSystemState.directoryHandle);
    }

    // Save updated history
    await this.saveHistory(updatedHistory);
    this.updateStorageInfo();

    console.log(`[HistoryManagementService] Item with ID ${itemId} removed from history.`);
    return true;
  }

  /**
   * Clear all history
   */
  async clearHistory(): Promise<boolean> {
    try {
      console.log('[HistoryManagementService] Clearing all history...');

      // Update signal instead of subject
      this._history.set([]);

      // Clear from localStorage
      if (this.isBrowser && typeof localStorage !== 'undefined') {
        localStorage.removeItem('tts-history');
      }

      // If using file system storage, delete all audio files and metadata file
      const fileSystemState = this.storageState.fileSystemState();
      if (fileSystemState.isEnabled && fileSystemState.directoryHandle) {
        const handle = fileSystemState.directoryHandle;
        
        try {
          // Delete metadata file
          await this.fileSystemOperations.deleteFile(handle, this.METADATA_FILE);
          
          // Delete all audio files (*.mp3)
          await this.fileSystemOperations.deleteAllMp3Files(handle);
          
        } catch (error) {
          console.error('[HistoryManagementService] Error clearing file system storage:', error);
          // Continue even if file system cleanup fails
        }
      }

      this.updateStorageInfo();
      console.log('[HistoryManagementService] All history cleared successfully.');
      return true;

    } catch (error) {
      console.error('[HistoryManagementService] Failed to clear history:', error);
      return false;
    }
  }

  /**
   * Replace entire history (used during storage mode switching)
   */
  async setHistory(newHistory: HistoryItem[]): Promise<void> {
    // Update history signal first
    this._history.set(newHistory);
    
    // Then handle persistence
    await this.saveHistory(newHistory);
    
    // Update storage info immediately
    this.updateStorageInfo();
    
    console.log(`[HistoryManagementService] History updated with ${newHistory.length} items`);
  }

  /**
   * Clear history without persisting (used during storage mode switching)
   */
  clearHistoryInMemory(): void {
    this._history.set([]);
    this.updateStorageInfo();
  }

  // Private helper methods

  /**
   * Save history to appropriate storage
   */
  private async saveHistory(history: HistoryItem[]): Promise<void> {
    if (!this.isBrowser) return;

    const fileSystemState = this.storageState.fileSystemState();
    if (fileSystemState.isEnabled && fileSystemState.directoryHandle) {
      // Save to file system
      await this.saveToFileSystem(history, fileSystemState.directoryHandle);
    } else {
      // Save to localStorage (fallback)
      this.migration.saveToLocalStorage(history);
    }
  }

  /**
   * Save history to file system
   */
  private async saveToFileSystem(history: HistoryItem[], handle: FileSystemDirectoryHandle): Promise<void> {
    if (!this.isBrowser) return;

    try {
      // Save audio files
      for (const item of history) {
        if (item.result?.audioData) {
          const audioFileName = `${item.id}.mp3`;
          await this.fileSystemOperations.writeFile(handle, audioFileName, item.result.audioData);
        }
      }

      // Save metadata file
      const metadata = history.map(item => this.serialization.serializeForFileSystemMetadata(item));
      const metadataContent = JSON.stringify({ history: metadata }, null, 2);
      await this.fileSystemOperations.writeFile(handle, this.METADATA_FILE, metadataContent);

    } catch (error) {
      console.error('[HistoryManagementService] Error saving history to file system:', error);
      throw error;
    }
  }

  /**
   * Delete audio file from file system
   */
  private async deleteAudioFile(itemId: string, handle: FileSystemDirectoryHandle): Promise<void> {
    if (!this.isBrowser) return;

    try {
      const audioFileName = `${itemId}.mp3`;
      await this.fileSystemOperations.deleteFile(handle, audioFileName);
    } catch (error) {
      console.error(`[HistoryManagementService] Failed to delete audio file for item ${itemId}:`, error);
    }
  }

  /**
   * Update storage info
   */
  private updateStorageInfo(): void {
    const currentHistory = this._history();
    const currentState = this.storageState.fileSystemState();
    
    // Update storage info with current state
    this.storageInfo.updateStorageInfo(currentHistory, currentState);
  }
}
