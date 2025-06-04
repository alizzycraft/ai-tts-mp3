// Common domain types for storage infrastructure
export interface FileSystemStorageState {
  isSupported: boolean;
  isEnabled: boolean;
  selectedPath: string | null;
  directoryHandle: FileSystemDirectoryHandle | null;
}

export interface FolderReconnectionPrompt {
  previousPath: string;
  shouldPrompt: boolean;
}
