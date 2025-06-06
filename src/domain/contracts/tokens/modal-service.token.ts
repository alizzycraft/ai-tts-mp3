import { InjectionToken } from '@angular/core';
import { IModalService } from '../interfaces/services/modal-service.interface';

export const MODAL_SERVICE = new InjectionToken<IModalService>('MODAL_SERVICE');
