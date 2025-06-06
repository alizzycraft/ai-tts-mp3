// Infrastructure implementation of TTS provider service
import { ITTSProviderService } from '../../../domain/contracts/interfaces/services/tts-provider.interface';
import { OpenAITTSService } from './openai-tts.service';
import { TTSSettings, QueryText } from '../../../domain/entities/tts.entity';
import { Result } from '../../../common/value-objects/query/result';

export class OpenAITTSProviderService implements ITTSProviderService {
  private readonly openAIService = new OpenAITTSService();

  async generateSpeech(text: string, settings: TTSSettings): Promise<Uint8Array> {
    const queryText = QueryText.fromString(text);
    return this.openAIService.generateSpeech(queryText, settings);
  }

  async validateSettings(settings: TTSSettings): Promise<Result<boolean, string>> {
    // Basic validation checks
    if (!settings.apiKey) {
      return Result.failure('API key is required.');
    }
    if (!settings.model || typeof settings.model !== 'string') {
      return Result.failure('Model is required.');
    }
    if (!settings.voice || typeof settings.voice !== 'string') {
      return Result.failure('Voice is required.');
    }

    return Result.success(true);
  }
}
