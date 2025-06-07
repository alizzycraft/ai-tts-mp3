import { Signal } from '@angular/core';
import { HistoryItem, StorageInfo } from '../../../types/storage-types';
import { FolderReconnectionPromptModel } from '../models/folder-reconnection-prompt-model.interface';
import { FileSystemStorageState } from '../models/file-system-storage-sate.interface';
import { TTSSettings, TTSResult } from '../../../entities/tts.entity';

export interface IHistoryStorageService {
  // Reactive signals
  items: Signal<HistoryItem[]>;
  storage: Signal<StorageInfo>;
  fileSystem: Signal<FileSystemStorageState>;
  reconnection: Signal<FolderReconnectionPromptModel | null>;
  historyLoaded?: Signal<boolean>;

  // File system operations
  enableFileSystemStorage(): /*todo:convert*/ Promise<{ success: boolean; error?: string }>;
  disableFileSystemStorage(): /*todo:convert*/ Promise<void>;
  handleFolderReconnection(accepted: boolean): /*todo:convert*/ Promise<void>;

  // History management
  deleteHistoryItem(id: string): /*todo:convert*/ Promise<void>;
  clearHistory(): /*todo:convert*/ Promise<void>;
  addToHistory(text: string, settings: TTSSettings, result: TTSResult, metadata?: { title?: string; tags?: string[]; duration?: number }): /*todo:convert*/ Promise<{ success: boolean; warnings?: string[]; removed?: HistoryItem[] }>;

  getItemsToBeRemoved(newItemSize: number): HistoryItem[];
  getStorageInfo(): StorageInfo;
  getFileSystemState(): FileSystemStorageState;
}
