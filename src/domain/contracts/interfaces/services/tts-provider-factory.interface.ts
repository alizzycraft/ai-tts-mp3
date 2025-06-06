import { Result } from '../../../../integration/value-objects/query';
import { ModelProvider, TTSSettings } from '../../../entities/tts.entity';

export interface ITTSProviderFactory {
  createProvider(provider: ModelProvider): unknown;
  validateProviderConfiguration(
    provider: ModelProvider,
    settings: TTSSettings
  ): Promise<Result<boolean, string>>;
}
