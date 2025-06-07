import { Provider } from '@angular/core';
import { HISTORY_STORAGE_SERVICE } from '../../domain/contracts/tokens/history-storage.token';
import { IntegratedHistoryStorageService } from '../../enactment/storage/history-storage.service';

export const historyStorageProvider: Provider = {
  provide: HISTORY_STORAGE_SERVICE,
  useClass: IntegratedHistoryStorageService
};
