import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { routes } from '../routes/app.routes';
import { modalOutletProvider } from '../../providers/modal-outlet.provider';
import { reconnectionPromptModalProvider } from '../../providers/reconnection-prompt-modal.provider';
import { historyStorageProvider } from '../../providers/history-storage.provider';
import { ttsProviderFactoryProvider } from '../../providers/tts-provider-factory.provider';
import { historyManagementProvider } from '../../providers/history-management.provider';
import { fileSystemStorageManagerProvider } from '../../providers/file-system-storage-manager.provider';
import { storageInfoProvider } from '../../providers/storage-info.provider';
import { MODAL_SERVICE } from '../../../domain/contracts/tokens/modal-service.token';
import { ModalService } from '../../services/ui/modal.service';

export const appConfig: ApplicationConfig = {
  providers: [
    // Enable zoneless change detection for Angular 20
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideClientHydration(),
    provideHttpClient(withFetch()),    // History Storage provider
    historyStorageProvider,
    historyManagementProvider,
    
    // Modal Outlet provider
    modalOutletProvider,
    
    // Reconnection Prompt Modal provider
    reconnectionPromptModalProvider,
    
    // TTS Provider Factory
    ttsProviderFactoryProvider,
    fileSystemStorageManagerProvider,
    storageInfoProvider,
    
    // Modal Service token provider (singleton, useExisting)
    { provide: MODAL_SERVICE, useExisting: ModalService },
  ]
};
