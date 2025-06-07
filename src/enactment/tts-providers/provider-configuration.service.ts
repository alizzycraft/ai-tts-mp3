// Provider configuration management service
import { Injectable, signal, computed, inject } from '@angular/core';
import { LoggingService } from '../../common/services/logging.service';
import { Result } from '../../common/value-objects/query/result';
import { ModelProvider, TTSSettings } from '../../domain/entities/tts.entity';
import { ITTSProviderFactory } from '../../domain/contracts/interfaces/services/tts-provider-factory.interface';
import { TTS_PROVIDER_FACTORY } from '../../domain/contracts/tokens/tts-provider-factory.token';
import { ApiKey } from '../../common/value-objects/text/api-key';
import { BrowserStorageService } from '../storage/browser-storage.service';

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

export interface ProviderValidationResult {
  provider: ModelProvider;
  isValid: boolean;
  message: string;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ProviderConfigurationService {
  private logging = inject(LoggingService);
  private ttsProviderFactory = inject<ITTSProviderFactory>(TTS_PROVIDER_FACTORY);
  private browserStorage = inject(BrowserStorageService);

  private readonly STORAGE_KEY = 'tts_provider_configs';

  // Signals for reactive state
  private readonly configurations = signal<ProviderConfiguration[]>([]);
  private readonly providerValidationResults = signal<Map<ModelProvider, ProviderValidationResult>>(new Map());
  private readonly lastValidationTime = signal<Date>(new Date());

  // Computed signals
  readonly validConfigurations = computed(() => {
    return this.configurations().filter(config => config.enabled);
  });

  readonly validationStatus = computed(() => {
    return Array.from(this.providerValidationResults().values());
  });

  readonly availableProviders = computed(() => {
    const enabledProviders = this.validConfigurations().map(config => config.provider);
    return enabledProviders.length > 0 ? enabledProviders : [ModelProvider.OPENAI];
  });

  readonly mergedConfigurations = computed(() => {
    const configs = this.configurations();
    const apiKeys = this.apiKeyMap();
    
    return configs.map(config => ({
      ...config,
      apiKey: apiKeys.get(config.provider)?.getValue()
    }));
  });

  constructor() {
    this.initializeConfigurations();
  }

  private initializeConfigurations(): void {
    try {
      const stored = this.browserStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        this.configurations.set(this.getDefaultConfigurations());
        return;
      }

      const parsed = JSON.parse(stored);
      if (!this.isValidConfigurationArray(parsed)) {
        throw new Error('Invalid configuration format');
      }
      
      this.configurations.set(parsed);
    } catch (error) {
      this.logging.error('Failed to initialize configurations', error as Error, 'ProviderConfig');
      this.configurations.set(this.getDefaultConfigurations());
    }
  }

  private isValidConfigurationArray(value: unknown): value is ProviderConfiguration[] {
    if (!Array.isArray(value)) return false;
    
    return value.every(item => this.isValidConfiguration(item));
  }

  private isValidConfiguration(config: unknown): config is ProviderConfiguration {
    if (typeof config !== 'object' || config === null) return false;
    
    const c = config as Record<string, unknown>;
    
    return (
      typeof c['provider'] === 'string' &&
      Object.values(ModelProvider).includes(c['provider'] as ModelProvider) &&
      typeof c['enabled'] === 'boolean' &&
      typeof c['displayName'] === 'string' &&
      typeof c['priority'] === 'number' &&
      (c['apiKey'] === undefined || typeof c['apiKey'] === 'string') &&
      (c['customEndpoint'] === undefined || typeof c['customEndpoint'] === 'string') &&
      (c['timeout'] === undefined || typeof c['timeout'] === 'number') &&
      (c['maxRetries'] === undefined || typeof c['maxRetries'] === 'number') &&
      (!c['rateLimits'] || (
        typeof c['rateLimits'] === 'object' &&
        c['rateLimits'] !== null &&
        typeof (c['rateLimits'] as Record<string, unknown>)['requestsPerMinute'] === 'number' &&
        typeof (c['rateLimits'] as Record<string, unknown>)['charactersPerMinute'] === 'number'
      ))
    );
  }

  getAvailableProviders(): ModelProvider[] {
    return this.availableProviders();
  }  getProviderConfiguration(provider: ModelProvider): Result<ProviderConfiguration, string> {
    try {
      const config = this.mergedConfigurations().find(c => c.provider === provider);
      if (!config) {
        return Result.failure(`No configuration found for provider ${provider}`);
      }

      return Result.success(config);
    } catch (error) {
      this.logging.error('Failed to get provider configuration', error as Error, 'ProviderConfig');
      return Result.failure('Failed to get configuration');
    }
  }async validateProviderConfiguration(
    provider: ModelProvider
  ): /*todo:convert*/ Promise<Result<ProviderValidationResult, string>> {
    try {
      this.logging.info(`Starting validation for provider ${provider}`, 'ProviderConfig');

      const config = this.validConfigurations().find(c => c.provider === provider);
      if (!config) {
        const result: ProviderValidationResult = {
          provider,
          isValid: false,
          message: 'Provider is not enabled',
          timestamp: new Date()
        };
        this.updateValidationResults(result);
        return Result.success(result);
      }

      const apiKey = this.getApiKey(provider);
      if (!apiKey) {
        const result: ProviderValidationResult = {
          provider,
          isValid: false,
          message: 'API key is required',
          timestamp: new Date()
        };
        this.updateValidationResults(result);
        return Result.success(result);
      }

      // Create minimal settings for validation
      const testSettings: TTSSettings = {
        provider,
        apiKey,
        model: 'default',  // Use placeholder values since we only care about API key validation
        voice: 'default'
      };

      // Validate configuration
      const validationResult = await this.ttsProviderFactory.validateProviderConfiguration(provider, testSettings);
      
      const result: ProviderValidationResult = {
        provider,
        isValid: validationResult.isSuccess(),
        message: validationResult.isSuccess() ? 'Configuration is valid' : validationResult.getError(),
        timestamp: new Date()
      };

      this.updateValidationResults(result);
      return Result.success(result);

    } catch (error) {
      const result: ProviderValidationResult = {
        provider,
        isValid: false,
        message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      };
      
      this.updateValidationResults(result);
      return Result.success(result);
    }
  }  async loadProviderConfiguration(provider: ModelProvider): /*todo:convert*/ Promise<Result<ProviderConfiguration | null, string>> {
    try {
      const config = this.configurations().find(c => c.provider === provider);
      if (!config) {
        return Result.success(null);
      }

      // Merge with API key if available
      const apiKey = this.getApiKey(provider);
      const mergedConfig = {
        ...config,
        apiKey: apiKey ? apiKey.getValue() : undefined
      };

      return Result.success(mergedConfig);
    } catch (error) {
      this.logging.error('Failed to load provider configuration', error as Error, 'ProviderConfig');
      return Result.failure('Failed to load configuration');
    }
  }
  loadAllProviderConfigurations(): /*todo:convert*/ Promise<Result<ProviderConfiguration[], string>> {
    try {
      return /*todo:convert*/ Promise.resolve(Result.success(this.mergedConfigurations()));
    } catch (error) {
      this.logging.error('Failed to load provider configurations', error as Error, 'ProviderConfig');
      return /*todo:convert*/ Promise.resolve(Result.failure('Failed to load configurations'));
    }
  }
  private updateValidationResults(result: ProviderValidationResult): void {
    const currentResults = new Map(this.providerValidationResults());
    currentResults.set(result.provider, result);
    this.providerValidationResults.set(currentResults);
    this.lastValidationTime.set(new Date());
  }


  async clearAllProviderConfigurations(): /*todo:convert*/ Promise<Result<void, string>> {
    try {
      this.browserStorage.removeItem(this.STORAGE_KEY);
      this.configurations.set(this.getDefaultConfigurations());
      this.apiKeyMap.set(new Map());
      this.providerValidationResults.set(new Map());
      this.lastValidationTime.set(new Date());
      this.logging.info('Provider configurations cleared', 'ProviderConfig');
      return Result.success(undefined);
    } catch (error) {
      this.logging.error('Failed to clear provider configurations', error as Error, 'ProviderConfig');
      return Result.failure('Failed to clear configurations: ' + (error instanceof Error ? error.message : 'Unknown error'));
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
      this.getDefaultConfiguration(ModelProvider.OPENAI)
    ];
  }
  async saveProviderConfiguration(config: ProviderConfiguration): /*todo:convert*/ Promise<Result<void, string>> {
    try {
      // Create sanitized config without sensitive data
      const sanitizedConfig = { ...config };
      delete sanitizedConfig.apiKey; // Never store API keys

      const currentConfigs = this.configurations();
      const updatedConfigs = [...currentConfigs];
      
      // Update or add configuration
      const existingIndex = updatedConfigs.findIndex(c => c.provider === config.provider);
      if (existingIndex >= 0) {
        updatedConfigs[existingIndex] = sanitizedConfig;
      } else {
        updatedConfigs.push(sanitizedConfig);
      }

      // Update signal first
      this.configurations.set(updatedConfigs);

      // Then persist to storage
      const serialized = JSON.stringify(updatedConfigs);
      this.browserStorage.setItem(this.STORAGE_KEY, serialized);
      
      this.logging.info('Provider configuration saved (excluding sensitive data)', 'ProviderConfig', { provider: config.provider });
      return Result.success(undefined);    } catch (e) {
      this.logging.error('Failed to save provider configuration', e as Error, 'ProviderConfig');
      return Result.failure('Failed to save provider configuration');
    }
  }  // ApiKey value object conversion helpers
  private readonly apiKeyMap = signal<Map<ModelProvider, ApiKey>>(new Map());

  private convertToApiKey(apiKeyStr: string | undefined): ApiKey | undefined {
    if (!apiKeyStr) {
      return undefined;
    }
    try {
      return ApiKey.fromString(apiKeyStr);
    } catch {
      this.logging.warn('Invalid API key format');
      return undefined;
    }
  }

  private convertToApiKeyString(apiKey: ApiKey | undefined): string | undefined {
    if (!apiKey) {
      return undefined;
    }
    return apiKey.getValue();
  }

  // API key management
  setApiKey(provider: ModelProvider, apiKey: string | undefined): void {
    if (!apiKey) {
      const currentMap = new Map(this.apiKeyMap());
      currentMap.delete(provider);
      this.apiKeyMap.set(currentMap);
      return;
    }

    const convertedKey = this.convertToApiKey(apiKey);
    if (convertedKey) {
      const currentMap = new Map(this.apiKeyMap());
      currentMap.set(provider, convertedKey);
      this.apiKeyMap.set(currentMap);
    }
  }

  getApiKey(provider: ModelProvider): ApiKey | undefined {
    return this.apiKeyMap().get(provider);
  }
}
