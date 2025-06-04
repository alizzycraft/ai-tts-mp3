import { Signal } from '@angular/core';
import { HistoryItem, StorageInfo, FileSystemStorageState, FolderReconnectionPrompt } from './domain-types';

export interface IHistoryStorage {
  // Reactive signals
  items: Signal<HistoryItem[]>;
  storage: Signal<StorageInfo>;
  fileSystem: Signal<FileSystemStorageState>;
  reconnection: Signal<FolderReconnectionPrompt | null>;
    // File system operations
  enableFileSystemStorage(): Promise<{ success: boolean; error?: string }>;
  disableFileSystemStorage(): Promise<void>;
  handleFolderReconnection(accepted: boolean): Promise<void>;

  // History management
  deleteHistoryItem(id: string): Promise<void>;
  clearHistory(): Promise<void>;
}
