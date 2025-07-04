import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { LocalStorageService } from '../../infrastructure/storage/local-storage.service';
import { StorageIntegrationService } from '../services/storage-integration.service';
import { TTSIntegrationService } from '../services/tts-integration.service';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch()),
    // Storage services
    LocalStorageService,
    StorageIntegrationService,
    TTSIntegrationService
  ]
};
