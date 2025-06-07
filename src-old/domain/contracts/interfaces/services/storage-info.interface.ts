import { StorageInfo } from '../../../types/storage-types';
import { HistoryItem } from '../../../types/storage-types';
import { FileSystemStorageState } from '../models/file-system-storage-sate.interface';

export interface IStorageInfoService {
  storageInfo: () => StorageInfo;
  getItemsToBeRemoved(
    items: HistoryItem[],
    newItemSize: number,
    fileSystem: FileSystemStorageState
  ): HistoryItem[];
}
