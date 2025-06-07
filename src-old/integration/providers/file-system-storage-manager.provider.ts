import { Provider } from '@angular/core';
import { FILE_SYSTEM_STORAGE_MANAGER_SERVICE } from '../../domain/contracts/tokens/file-system-storage-manager.token';
import { FileSystemStorageManagerService } from '../../infrastructure/storage/file-system-storage-manager.service';

export const fileSystemStorageManagerProvider: Provider = {
  provide: FILE_SYSTEM_STORAGE_MANAGER_SERVICE,
  useClass: FileSystemStorageManagerService
};
