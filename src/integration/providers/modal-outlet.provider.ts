import { Provider } from '@angular/core';
import { MODAL_OUTLET } from '../../domain/contracts/tokens/modal-outlet.token';
import { ModalOutletComponent } from '../../presentation/app/modals/modal-outlet.component';

export const modalOutletProvider: Provider = {
  provide: MODAL_OUTLET,
  useValue: ModalOutletComponent
};
