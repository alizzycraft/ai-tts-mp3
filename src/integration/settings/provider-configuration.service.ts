// Provider configuration management service
import { Injectable } from '@angular/core';
import { LoggingService } from '../logging.service';
import { Result } from '../../common/result';
import { ModelProvider } from '../../domain/tts.entity';

export interface ProviderConfiguration {
  provider: ModelProvider;
  apiKey?: string;
  customEndpoint?: string;
  timeout?: number;
  maxRetries?: number;
  enabled: boolean;
  displayName: string;
  priority: number;
  rateLimits?: {
    requestsPerMinute: number;
    charactersPerMinute: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ProviderConfigurationService {
  private readonly STORAGE_KEY = 'tts_provider_configs';
  private cachedConfigurations?: ProviderConfiguration[];

  constructor(private logging: LoggingService) {}

  getAvailableProviders(): ModelProvider[] {
    // First check if there are any provider configurations
    const configurationsResult = this.loadConfigurationsFromStorage();
    if (configurationsResult.isSuccess()) {
      const enabledProviders = configurationsResult.getValue()
        .filter(config => config.enabled)
        .map(config => config.provider);
      
      return enabledProviders.length > 0 ? enabledProviders : [ModelProvider.OPENAI];
    }

    // Fall back to default provider list if no configurations exist
    return [ModelProvider.OPENAI, ModelProvider.ELEVENLABS, ModelProvider.GOOGLE, ModelProvider.AZURE, ModelProvider.AWS];
  }

  private loadConfigurationsFromStorage(): Result<ProviderConfiguration[], string> {
    try {
      if (this.cachedConfigurations) {
        return Result.success(this.cachedConfigurations);
      }

      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return Result.success(this.getDefaultConfigurations());
      }

      const parsed = JSON.parse(stored);
      this.cachedConfigurations = parsed;
      return Result.success(parsed);
    } catch (error) {
      this.logging.error('Failed to load provider configurations', error as Error, 'ProviderConfig');
      return Result.failure('Failed to load provider configurations');
    }
  }

  private getDefaultConfiguration(provider: ModelProvider): ProviderConfiguration {
    const displayNames: Record<ModelProvider, string> = {
      [ModelProvider.OPENAI]: 'OpenAI',
      [ModelProvider.ELEVENLABS]: 'ElevenLabs',
      [ModelProvider.AZURE]: 'Azure',
      [ModelProvider.GOOGLE]: 'Google',
      [ModelProvider.AWS]: 'AWS'
    };

    const priorities: Record<ModelProvider, number> = {
      [ModelProvider.OPENAI]: 1,
      [ModelProvider.ELEVENLABS]: 2,
      [ModelProvider.AZURE]: 3,
      [ModelProvider.GOOGLE]: 4,
      [ModelProvider.AWS]: 5
    };

    return {
      provider,
      enabled: provider === ModelProvider.OPENAI,
      displayName: displayNames[provider],
      priority: priorities[provider]
    };
  }

  private getDefaultConfigurations(): ProviderConfiguration[] {
    return [
      this.getDefaultConfiguration(ModelProvider.OPENAI),
      this.getDefaultConfiguration(ModelProvider.ELEVENLABS),
      this.getDefaultConfiguration(ModelProvider.GOOGLE),
      this.getDefaultConfiguration(ModelProvider.AZURE),
      this.getDefaultConfiguration(ModelProvider.AWS)
    ];
  }
}
