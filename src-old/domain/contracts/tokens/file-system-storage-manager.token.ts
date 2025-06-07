import { InjectionToken } from '@angular/core';
import { IFileSystemStorageManagerService } from '../interfaces/services/file-system-storage-manager.interface';

export const FILE_SYSTEM_STORAGE_MANAGER_SERVICE = new InjectionToken<IFileSystemStorageManagerService>('FILE_SYSTEM_STORAGE_MANAGER_SERVICE');
