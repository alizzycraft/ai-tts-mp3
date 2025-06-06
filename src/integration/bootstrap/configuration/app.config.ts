import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { routes } from '../routes/app.routes';
import { modalServiceProvider } from '../../providers/modal.provider';
import { modalOutletProvider } from '../../providers/modal-outlet.provider';
import { reconnectionPromptModalProvider } from '../../providers/reconnection-prompt-modal.provider';
import { historyStorageProvider } from '../../providers/history-storage.provider';

export const appConfig: ApplicationConfig = {
  providers: [
    // Enable zoneless change detection for Angular 20
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideClientHydration(),
    provideHttpClient(withFetch()),    // History Storage provider
    historyStorageProvider,
    
    // Modal Service provider
    modalServiceProvider,
    
    // Modal Outlet provider
    modalOutletProvider,
    
    // Reconnection Prompt Modal provider
    reconnectionPromptModalProvider
  ]
};
