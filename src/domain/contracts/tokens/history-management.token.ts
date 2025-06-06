import { InjectionToken } from '@angular/core';
import { IHistoryManagementService } from '../interfaces/services/history-management.interface';

export const HISTORY_MANAGEMENT_SERVICE = new InjectionToken<IHistoryManagementService>('HISTORY_MANAGEMENT_SERVICE');
