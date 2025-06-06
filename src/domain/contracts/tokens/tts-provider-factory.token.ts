import { InjectionToken } from '@angular/core';
import { ITTSProviderFactory } from '../interfaces/services/tts-provider-factory.interface';

export const TTS_PROVIDER_FACTORY = new InjectionToken<ITTSProviderFactory>('TTS_PROVIDER_FACTORY');
