import { InjectionToken, Type } from '@angular/core';
import { IReconnectionPromptModal } from '../interfaces/components/reconnection-prompt-modal.interface';

export const RECONNECTION_PROMPT_MODAL = new InjectionToken<Type<IReconnectionPromptModal>>('RECONNECTION_PROMPT_MODAL');
