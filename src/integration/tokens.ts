import { InjectionToken } from '@angular/core';
import { IHistoryStorage } from './interfaces';

export const HISTORY_STORAGE_TOKEN = new InjectionToken<IHistoryStorage>('HistoryStorage');
