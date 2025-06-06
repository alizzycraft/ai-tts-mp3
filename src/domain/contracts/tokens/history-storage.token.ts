import { InjectionToken } from '@angular/core';
import { IHistoryStorageService } from '../interfaces/services/history-storage.interface';

export const HISTORY_STORAGE_SERVICE = new InjectionToken<IHistoryStorageService>('HISTORY_STORAGE_SERVICE');
