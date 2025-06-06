import { FileSystemStorageState } from '../models/file-system-storage-sate.interface';

export interface IFileSystemStorageManagerService {
  fileSystemState: () => FileSystemStorageState;
  initializeService(): Promise<void>;
  enableFileSystemStorage(promptUser: boolean): Promise<{ success: boolean; error?: string }>;
  disableFileSystemStorage(): Promise<boolean>;
  handleFolderReconnection(accepted: boolean): Promise<void>;
}
