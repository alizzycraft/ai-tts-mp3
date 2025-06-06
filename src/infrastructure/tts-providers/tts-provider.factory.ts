// Infrastructure provider factory for TTS services
import { Injectable } from '@angular/core';
import { Result } from '../../common/value-objects/query/result';
import { ModelProvider, TTSSettings } from '../../domain/entities/tts.entity';
import type { ITTSProviderFactory } from '../../domain/contracts/interfaces/services/tts-provider-factory.interface';
import { OpenAITTSProviderService } from './openai/openai-tts-provider.service';

@Injectable({ providedIn: 'root' })
export class TTSProviderFactoryService implements ITTSProviderFactory {
  createProvider(provider: ModelProvider): unknown {
    switch (provider) {
      case ModelProvider.OPENAI:
        return new OpenAITTSProviderService();
      default:
        throw new Error(`Provider not implemented: ${provider}`);
    }
  }

  async validateProviderConfiguration(provider: ModelProvider, settings: TTSSettings): Promise<Result<boolean, string>> {
     switch (provider) {
      case ModelProvider.OPENAI:
        {
          const service = new OpenAITTSProviderService();
          return service.validateSettings(settings);
        }
      default:
        throw new Error(`Provider not implemented: ${provider}`);
    }
  }
}
