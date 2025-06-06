// Storage Migration Service - Handles data migration between storage systems
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HistoryItem } from '../../domain/types/storage-types';
import { DataSerializationService } from './data-serialization.service';
import { FileSystemOperationsService } from './file-system-operations.service';
import { FileSystemStorageState } from '../../domain/services/storage-state.service';

@Injectable({
  providedIn: 'root'
})
export class StorageMigrationService {
  private platformId = inject(PLATFORM_ID);
  private serializationService = inject(DataSerializationService);
  private fileSystemOperations = inject(FileSystemOperationsService);

  private readonly STORAGE_KEY = 'tts-history';
  private readonly METADATA_FILE = 'history-metadata.json';

  /** true only when running in a browser (not during SSR) */
  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  // Load history from appropriate storage based on state
  async loadHistoryFromStorage(state: FileSystemStorageState): Promise<HistoryItem[]> {
    if (!this.isBrowser) return [];

    if (state.isEnabled && state.directoryHandle) {
      return this.loadFromFileSystem(state.directoryHandle);
    } else {
      return this.loadFromLocalStorage();
    }
  }

  // Save history item to appropriate storage based on state
  async saveHistoryItemToStorage(item: HistoryItem, state: FileSystemStorageState): Promise<void> {
    if (!this.isBrowser) return;

    if (state.isEnabled && state.directoryHandle) {
      await this.saveToFileSystem(item, state.directoryHandle);
    } else {
      this.saveToLocalStorage([item]);
    }
  }

  // Delete history item from appropriate storage based on state
  async deleteHistoryItemFromStorage(itemId: string, state: FileSystemStorageState): Promise<void> {
    if (!this.isBrowser) return;

    if (state.isEnabled && state.directoryHandle) {
      await this.deleteFromFileSystem(itemId, state.directoryHandle);
    } else {
      this.deleteFromLocalStorage(itemId);
    }
  }

  // Migrate history from localStorage to file system
  async migrateFromLocalStorageToFileSystem(): Promise<HistoryItem[]> {
    if (!this.isBrowser || typeof localStorage === 'undefined') return [];

    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return [];

    try {
      const parsed = JSON.parse(stored);        // Deserialize items from localStorage format
      const historyItems = parsed.map((item: unknown) => 
        this.serializationService.deserializeFromLocalStorage(item as Record<string, unknown>)
      );

      return historyItems;
    } catch (error) {
      console.error('[StorageMigration] Error migrating from localStorage:', error);
      return [];
    }
  }

  // Migrate history from file system to localStorage
  async migrateFromFileSystemToLocalStorage(): Promise<void> {
    // This would be implemented when needed, for now it's a placeholder
    console.warn('[StorageMigration] Migration from file system to localStorage not yet implemented');
  }

  /**
   * Load history data from the file system
   */
  async loadFromFileSystem(handle: FileSystemDirectoryHandle): Promise<HistoryItem[]> {
    if (!this.isBrowser) return [];

    try {
      // Read the metadata file
      const metadataFile = await this.fileSystemOperations.readFile(handle, this.METADATA_FILE);

      if (!metadataFile) {
        console.log('[StorageMigration] Metadata file not found in file system. Returning empty history.');
        return []; // No metadata file means no history saved in the file system
      }

      const metadataContent = await metadataFile.text();
      const parsedMetadata = JSON.parse(metadataContent);

      if (!parsedMetadata || !Array.isArray(parsedMetadata.history)) {
        console.warn('[StorageMigration] Invalid metadata file format.');
        return [];
      }

      const historyItems: HistoryItem[] = [];
      for (const serializedItem of parsedMetadata.history) {
        try {
          // Deserialize item and load audio data
          const historyItem = await this.deserializeFromFileSystem(handle, serializedItem);
          historyItems.push(historyItem);
        } catch (itemError) {
          console.error('[StorageMigration] Error deserializing item from file system:', itemError);
          // Continue with other items even if one fails
        }
      }
      
      console.log(`[StorageMigration] Successfully loaded ${historyItems.length} items from file system.`);
      return historyItems;

    } catch (error) {
      console.error('[StorageMigration] Error loading history from file system:', error);
      return [];
    }
  }

  /**
   * Load history data from local storage
   */
  loadFromLocalStorage(): HistoryItem[] {
    if (!this.isBrowser) return [];
    const serializedHistory = localStorage.getItem(this.STORAGE_KEY);
    if (!serializedHistory) return [];
    try {
      const parsedHistory: Record<string, unknown>[] = JSON.parse(serializedHistory);
      return parsedHistory.map(item => this.serializationService.deserializeFromLocalStorage(item));
    } catch (error) {
      console.error('[StorageMigration] Error parsing or deserializing history from localStorage:', error);
      return [];
    }
  }

  /**
   * Save history data to local storage
   */
  saveToLocalStorage(history: HistoryItem[]): void {
    if (!this.isBrowser) return;
    try {
      const serializedItems = history.map(item => this.serializationService.serializeForLocalStorage(item));
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(serializedItems));
    } catch (error) {
      console.error('[StorageMigration] Error serializing or saving history to localStorage:', error);
    }
  }

  /**
   * Migrate data from local storage to file system
   */
  async migrateFromLocalStorage(handle: FileSystemDirectoryHandle): Promise<HistoryItem[]> {
    const history = this.loadFromLocalStorage();
    if (history.length > 0) {
      // This logic should likely be moved or delegated after refactoring
      // await this.fileSystemOperations.saveHistoryToFileSystem(handle, history, this.METADATA_FILE);
      console.warn('[StorageMigration] migrateFromLocalStorage needs update after FileSystemOperationsService refactor.', handle);
      localStorage.removeItem(this.STORAGE_KEY);
    }
    return history;
  }

  // Save individual item to file system
  private async saveToFileSystem(item: HistoryItem, directoryHandle: FileSystemDirectoryHandle): Promise<void> {
    if (!this.isBrowser) return;

    try {
      // Save audio file if available
      if (item.result.audioData) {
        const audioFileName = `${item.id}.mp3`;
        await this.fileSystemOperations.writeFile(
          directoryHandle,
          audioFileName,
          item.result.audioData
        );
      }

      // Load existing metadata, add this item, and save back
      await this.updateMetadataFile(directoryHandle, item);
    } catch (error) {
      console.error(`[StorageMigration] Error saving item ${item.id} to file system:`, error);
      throw error;
    }
  }

  // Delete item from file system
  private async deleteFromFileSystem(itemId: string, directoryHandle: FileSystemDirectoryHandle): Promise<void> {
    if (!this.isBrowser) return;

    try {
      // Delete audio file
      const audioFileName = `${itemId}.mp3`;
      await this.fileSystemOperations.deleteFile(directoryHandle, audioFileName);

      // Update metadata file to remove this item
      await this.removeFromMetadataFile(directoryHandle, itemId);
    } catch (error) {
      console.error(`[StorageMigration] Error deleting item ${itemId} from file system:`, error);
      throw error;
    }
  }

  // Delete item from localStorage
  private deleteFromLocalStorage(itemId: string): void {
    if (!this.isBrowser || typeof localStorage === 'undefined') return;

    try {
      const existingHistory = this.loadFromLocalStorage();
      const updatedHistory = existingHistory.filter(item => item.id !== itemId);
      
      const serializedItems = updatedHistory.map(item =>
        this.serializationService.serializeForLocalStorage(item)
      );
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(serializedItems));
    } catch (error) {
      console.error('[StorageMigration] Error deleting from localStorage:', error);
    }
  }

  // Helper method to deserialize from file system with audio loading
  private async deserializeFromFileSystem(
    directoryHandle: FileSystemDirectoryHandle,
    serializedItem: unknown
  ): Promise<HistoryItem> {
    let audioData: Uint8Array | undefined;

    // Type assertion to access properties
    const item = serializedItem as Record<string, unknown>;

    try {
      const audioFileName = `${item['id']}.mp3`;
      const audioFile = await this.fileSystemOperations.readFile(directoryHandle, audioFileName);
      
      if (audioFile) {
        audioData = new Uint8Array(await audioFile.arrayBuffer());
      } else {
        console.warn(`[StorageMigration] Audio file not found for item ${item['id']}. History item will be loaded without audio.`);
      }
    } catch (error) {
      console.error(`[StorageMigration] Error loading audio file for item ${item['id']}:`, error);
    }

    return this.serializationService.deserializeFromFileSystemMetadata(item, audioData);
  }

  // Helper method to update metadata file with new item
  private async updateMetadataFile(directoryHandle: FileSystemDirectoryHandle, newItem: HistoryItem): Promise<void> {
    try {
      // Load existing metadata
      const existingHistory = await this.loadFromFileSystem(directoryHandle);
      
      // Add new item (avoid duplicates)
      const filteredHistory = existingHistory.filter(item => item.id !== newItem.id);
      const updatedHistory = [...filteredHistory, newItem];
      
      // Serialize for metadata file
      const metadata = updatedHistory.map(item => ({
        id: item.id,
        text: item.text,
        settings: item.settings,
        result: {
          queryId: item.result.queryId.toString(),
          status: item.result.status,
          createdAt: item.result.createdAt.toISOString(),
          updatedAt: item.result.updatedAt.toISOString(),
          duration: item.result.duration,
          fileSize: item.result.fileSize,
          error: item.result.error
        },
        createdAt: item.createdAt.toISOString(),
        audioSize: item.audioSize
      }));

      const metadataContent = JSON.stringify({ history: metadata }, null, 2);
      await this.fileSystemOperations.writeFile(
        directoryHandle,
        this.METADATA_FILE,
        metadataContent
      );
    } catch (error) {
      console.error('[StorageMigration] Error updating metadata file:', error);
      throw error;
    }
  }

  // Helper method to remove item from metadata file
  private async removeFromMetadataFile(directoryHandle: FileSystemDirectoryHandle, itemId: string): Promise<void> {
    try {
      // Load existing metadata
      const existingHistory = await this.loadFromFileSystem(directoryHandle);
      
      // Remove the item
      const updatedHistory = existingHistory.filter(item => item.id !== itemId);
      
      // Serialize for metadata file
      const metadata = updatedHistory.map(item => ({
        id: item.id,
        text: item.text,
        settings: item.settings,
        result: {
          queryId: item.result.queryId.toString(),
          status: item.result.status,
          createdAt: item.result.createdAt.toISOString(),
          updatedAt: item.result.updatedAt.toISOString(),
          duration: item.result.duration,
          fileSize: item.result.fileSize,
          error: item.result.error
        },
        createdAt: item.createdAt.toISOString(),
        audioSize: item.audioSize
      }));

      const metadataContent = JSON.stringify({ history: metadata }, null, 2);
      await this.fileSystemOperations.writeFile(
        directoryHandle,
        this.METADATA_FILE,
        metadataContent
      );
    } catch (error) {
      console.error('[StorageMigration] Error removing from metadata file:', error);
      throw error;
    }
  }
}
