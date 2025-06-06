import { Provider } from '@angular/core';
import { HISTORY_MANAGEMENT_SERVICE } from '../../domain/contracts/tokens/history-management.token';
import { HistoryManagementService } from '../../infrastructure/storage/history-management.service';

export const historyManagementProvider: Provider = {
  provide: HISTORY_MANAGEMENT_SERVICE,
  useClass: HistoryManagementService
};
