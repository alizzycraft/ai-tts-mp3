import { TTSQuery, TTSSettings, ModelProvider } from '../entities/tts.entity';
import { TTSQueryRepository } from '../contracts/abstracts/repositories/tts-query.repository';
import { TTSResultRepository } from '../contracts/abstracts/repositories/tts-result.repository';

export class TTSDomainService {
  constructor(
    private queryRepository: TTSQueryRepository,
    private resultRepository: TTSResultRepository
  ) {}

  validateSettings(settings: TTSSettings): void {
    if (!settings.provider) {
      throw new Error('Provider is required');
    }

    if (!settings.model) {
      throw new Error('Model is required');
    }

    if (!settings.voice) {
      throw new Error('Voice is required');
    }    // Provider-specific validations can be added here when needed
  }

  async estimateCost(query: TTSQuery): /*todo:convert*/ Promise<number> {
    const wordCount = query.text.getWordCount();
    
    // Rough cost estimation based on provider
    switch (query.settings.provider) {
      case ModelProvider.OPENAI:
        return wordCount * 0.000015; // $15 per 1M characters, rough conversion
      case ModelProvider.ELEVENLABS:
        return Math.ceil(wordCount / 100) * 0.0003; // Character-based pricing
      default:
        return 0; // Unknown pricing
    }
  }

  async canProcessQuery(query: TTSQuery): /*todo:convert*/ Promise<boolean> {
    // Check if query text is within limits
    const textLength = query.text.getValue().length;
    
    switch (query.settings.provider) {
      case ModelProvider.OPENAI:
        return textLength <= 4096;
      case ModelProvider.ELEVENLABS:
        return textLength <= 5000;
      default:
        return textLength <= 4000;
    }
  }
}
