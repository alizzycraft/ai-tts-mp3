import { Observable } from 'rxjs';
import { TTSResult, TTSSettings } from '../../domain/tts.entity';
import { FileSystemStorageState, FolderReconnectionPrompt } from './storage-state.service';
import { HistoryItem, StorageInfo } from './storage-types';

export interface IFileSystemStorageService {
  // Observables
  fileSystemState$: Observable<FileSystemStorageState>;
  history$: Observable<HistoryItem[]>;
  storageInfo$: Observable<StorageInfo>;
  folderReconnectionPrompt$: Observable<FolderReconnectionPrompt | null>;

  // Current state getters
  getHistory(): HistoryItem[];
  getFileSystemState(): FileSystemStorageState;
  getStorageInfo(): StorageInfo;

  // Storage operations
  saveItem(text: string, settings: TTSSettings, result: TTSResult, metadata?: { title?: string; tags?: string[]; duration?: number }): Promise<void>;
  deleteItem(itemId: string): Promise<void>;
  clearHistory(): Promise<void>;

  // File system operations  
  selectFolder(): Promise<void>;
  reconnectToFolder(): Promise<void>;
  disableFileSystemStorage(): Promise<void>;
  dismissReconnectionPrompt(): void;

  // Storage status methods
  isFileSystemAccessSupported(): boolean;
  isFileSystemStorageEnabled(): boolean;
  hasDirectoryAccess(): boolean;
  isStorageNearFull(): boolean;
  isStorageCritical(): boolean;
}
