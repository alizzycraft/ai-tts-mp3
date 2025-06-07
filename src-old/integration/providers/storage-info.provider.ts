import { Provider } from '@angular/core';
import { STORAGE_INFO_SERVICE } from '../../domain/contracts/tokens/storage-info.token';
import { StorageInfoService } from '../../infrastructure/storage/storage-info.service';

export const storageInfoProvider: Provider = {
  provide: STORAGE_INFO_SERVICE,
  useClass: StorageInfoService
};
