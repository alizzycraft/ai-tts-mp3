import { Result } from '../../../../common/value-objects/query/result';
import { ModelProvider, TTSSettings } from '../../../entities/tts.entity';

export interface ITTSProviderFactory {
  createProvider(provider: ModelProvider): unknown;
  validateProviderConfiguration(
    provider: ModelProvider,
    settings: TTSSettings
  ): Promise<Result<boolean, string>>;
}
