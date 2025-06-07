import { Provider } from '@angular/core';
import { MODAL_SERVICE } from '../../domain/contracts/tokens/modal-service.token';
import { ModalService } from '../services/ui/modal.service';

export const modalServiceProvider: Provider = {
  provide: MODAL_SERVICE,
  useClass: ModalService
};
