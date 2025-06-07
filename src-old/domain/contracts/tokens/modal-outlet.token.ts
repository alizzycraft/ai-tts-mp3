import { InjectionToken, Type } from '@angular/core';
import { IModalOutlet } from '../interfaces/components/modal-outlet.interface';

export const MODAL_OUTLET = new InjectionToken<Type<IModalOutlet>>('MODAL_OUTLET');
