import { HistoryItem } from '../types/storage-types';
import { StorageInfo } from '../types/storage-types';
import { FileSystemStorageState } from '../contracts/interfaces/models/file-system-storage-sate.interface';

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
