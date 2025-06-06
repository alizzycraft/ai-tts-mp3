export interface FileSystemStorageState {
  isSupported: boolean;
  isEnabled: boolean;
  selectedPath: string | null;
  directoryHandle: FileSystemDirectoryHandle | null;
}
