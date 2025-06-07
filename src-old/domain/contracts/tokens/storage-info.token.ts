import { InjectionToken } from '@angular/core';
import { IStorageInfoService } from '../interfaces/services/storage-info.interface';

export const STORAGE_INFO_SERVICE = new InjectionToken<IStorageInfoService>('STORAGE_INFO_SERVICE');
