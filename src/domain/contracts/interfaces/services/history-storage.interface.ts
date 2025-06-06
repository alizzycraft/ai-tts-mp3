import { Signal } from '@angular/core';
import { HistoryItem, StorageInfo } from '../../../types/storage-types';
import { FolderReconnectionPrompt } from '../models/folder-reconnection-prompt.interface';
import { FileSystemStorageState } from '../models/file-system-storage-sate.interface';
import { TTSSettings, TTSResult } from '../../../entities/tts.entity';

export interface IHistoryStorageService {
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
  addToHistory(text: string, settings: TTSSettings, result: TTSResult, metadata?: { title?: string; tags?: string[]; duration?: number }): Promise<{ success: boolean; warnings?: string[]; removed?: HistoryItem[] }>;

  getItemsToBeRemoved(newItemSize: number): HistoryItem[];
  getStorageInfo(): StorageInfo;
  getFileSystemState(): FileSystemStorageState;
}
