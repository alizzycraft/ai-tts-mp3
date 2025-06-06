export interface PresentationStorageInfo {
  used: number;
  available: number;
  total: number;
  usedPercentage: number;
  itemCount: number;
}

export interface PresentationStorageState {
  isSupported: boolean;
  isEnabled: boolean;
  selectedPath: string | null;
  directoryHandle: FileSystemDirectoryHandle | null;
}

export interface PresentationHistoryItem {
  id: string;
  text: string;
  metadata?: {
    title?: string;
    tags?: string[];
  };
  createdAt: Date;
  result?: {
    audioData: Uint8Array;
    duration: number;
  };
}
