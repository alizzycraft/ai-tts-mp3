import { FileSystemStorageState } from '../models/file-system-storage-sate.interface';

export interface IFileSystemStorageManagerService {
  fileSystemState: () => FileSystemStorageState;
  /**
   * Start initialization (signal-driven, no async/await)
   */
  startInitialization(): void;
  /**
   * Enable file system storage by selecting a directory
   */
  enableFileSystemStorage(isReconnection?: boolean): /*todo:convert*/ Promise<{ success: boolean; error?: string }>;
  /**
   * Disable file system storage
   */
  disableFileSystemStorage(): /*todo:convert*/ Promise<boolean>;
  /**
   * Handle folder reconnection prompt
   */
  handleFolderReconnection(accepted: boolean): /*todo:convert*/ Promise<void>;
}
