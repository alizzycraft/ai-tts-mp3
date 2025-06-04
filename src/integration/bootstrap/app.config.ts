import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { routes } from './app.routes';
import { HISTORY_STORAGE_TOKEN } from '../tokens';
import { IntegratedHistoryStorageService } from '../history-storage.service';

export const appConfig: ApplicationConfig = {
  providers: [
    // Enable zoneless change detection for Angular 20
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideClientHydration(),
    provideHttpClient(withFetch()),

    // History Storage provider
    {
      provide: HISTORY_STORAGE_TOKEN,
      useClass: IntegratedHistoryStorageService
    }
  ]
};
