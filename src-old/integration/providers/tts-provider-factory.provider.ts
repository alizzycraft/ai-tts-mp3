// Facade provider for TTS_PROVIDER_FACTORY token
import { Provider } from '@angular/core';
import { TTS_PROVIDER_FACTORY } from '../../domain/contracts/tokens/tts-provider-factory.token';
import { TTSProviderFactoryService } from '../../infrastructure/tts-providers/tts-provider.factory';

export const ttsProviderFactoryProvider: Provider = {
  provide: TTS_PROVIDER_FACTORY,
  useClass: TTSProviderFactoryService
};
