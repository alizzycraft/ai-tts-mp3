import { Provider } from '@angular/core';
import { RECONNECTION_PROMPT_MODAL } from '../../domain/contracts/tokens/reconnection-prompt-modal.token';
import { ReconnectionPromptModalComponent } from '../../presentation/app/modals/reconnection-prompt-modal.component';

export const reconnectionPromptModalProvider: Provider = {
  provide: RECONNECTION_PROMPT_MODAL,
  useValue: ReconnectionPromptModalComponent
};
