import { HistoryItem, StorageInfo, FileSystemStorageState } from '../../../integration/domain-types';

export interface PresentationHistoryItem extends HistoryItem {
  isExpanded?: boolean;
  isPlaying?: boolean;
}

export interface PresentationStorageInfo extends Omit<StorageInfo, 'total'> {
  isFileSystem: boolean;
  folderName?: string;
  usedPercentage: number;
  itemCount: number;
}

export interface PresentationStorageState extends FileSystemStorageState {
  showReconnectPrompt?: boolean;
}

// Using domain type directly
export type { FolderReconnectionPrompt } from '../../../integration/domain-types';
