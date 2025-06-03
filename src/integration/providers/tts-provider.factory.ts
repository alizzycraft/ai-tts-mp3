// Integration layer TTS provider factory with dependency injection
import { Injectable } from '@angular/core';
import { ModelProvider, TTSSettings, TTSResult, QueryId } from '../../domain/tts.entity';
import { Result } from '../../common/result';
import { LoggingService } from '../logging.service';
import { ProviderMonitoringService } from '../monitoring/provider-monitoring.service';

// Provider implementations
import { ElevenLabsTTSService } from './elevenlabs-tts.service';
import { AzureTTSService } from './azure-tts.service';
import { GoogleTTSService } from './google-tts.service';
import { AWSPollyTTSService } from './aws-polly-tts.service';
import { OpenAITTSProviderService } from './openai-tts.service';

// Provider interface for standardized operations
export interface TTSProvider {
  synthesizeSpeech(text: string, settings: TTSSettings, queryId: QueryId): Promise<Result<TTSResult, string>>;
  validateConfiguration(settings: TTSSettings): Promise<Result<boolean, string>>;
  getCapabilities(): unknown;
  clearCache?(): void;
}

// Provider-specific settings types
export interface ElevenLabsSettings extends TTSSettings {
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export interface AzureSettings extends TTSSettings {
  region?: string;
  subscriptionKey?: string;
  resourceKey?: string;
  customEndpoint?: string;
}

export interface GoogleSettings extends TTSSettings {
  projectId?: string;
  location?: string;
  audioProfile?: string;
  effectsProfileId?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class TTSProviderFactory {
  private readonly providers = new Map<ModelProvider, TTSProvider>();

  constructor(
    private logging: LoggingService,
    private providerMonitoring: ProviderMonitoringService,
    private elevenLabsService: ElevenLabsTTSService,
    private azureService: AzureTTSService,
    private googleService: GoogleTTSService,
    private awsPollyService: AWSPollyTTSService,
    private openaiService: OpenAITTSProviderService
  ) {
    // Providers will be available through DI, just create the map for lookup
    this.providers.set(ModelProvider.OPENAI, this.openaiService);
    this.providers.set(ModelProvider.ELEVENLABS, this.elevenLabsService);
    this.providers.set(ModelProvider.AZURE, this.azureService);
    this.providers.set(ModelProvider.GOOGLE, this.googleService);
    this.providers.set(ModelProvider.AWS, this.awsPollyService);
    
    this.logging.debug(`TTS provider factory ready with providers: ${Array.from(this.providers.keys()).join(', ')}`, 'Factory');
  }

  /**
   * Get provider instance for the specified model provider
   */
  getProvider(provider: ModelProvider): Result<TTSProvider, string> {
    try {
      const providerInstance = this.providers.get(provider);
      
      if (!providerInstance) {
        const error = `Provider ${provider} is not supported or not initialized`;
        this.logging.error(error, new Error(error), 'Factory');
        return Result.failure(error);
      }

      this.logging.debug(`Retrieved provider instance for ${provider}`, 'Factory');
      return Result.success(providerInstance);

    } catch (error) {
      const errorMessage = `Failed to get provider ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logging.error(errorMessage, error as Error, 'Factory');
      return Result.failure(errorMessage);
    }
  }

  /**
   * Get all available providers
   */
  getAvailableProviders(): ModelProvider[] {
    return Array.from(this.providers.keys());
  }
  /**
   * Get supported providers with their capabilities
   */
  getProvidersWithCapabilities(): { provider: ModelProvider; capabilities: unknown; isHealthy: boolean }[] {
    const providersInfo: { provider: ModelProvider; capabilities: unknown; isHealthy: boolean }[] = [];

    for (const [provider, instance] of this.providers.entries()) {
      try {
        const capabilities = instance.getCapabilities();
        const healthResult = this.providerMonitoring.getProviderHealth(provider);
        const isHealthy = healthResult.isSuccess() ? healthResult.getValue() : false;
        
        providersInfo.push({
          provider,
          capabilities,
          isHealthy
        });
      } catch (error) {
        this.logging.error(`Failed to get capabilities for ${provider}`, error as Error, 'Factory');
        providersInfo.push({
          provider,
          capabilities: null,
          isHealthy: false
        });
      }
    }

    return providersInfo;
  }

  /**
   * Validate configuration for a specific provider
   */
  async validateProviderConfiguration(
    provider: ModelProvider, 
    settings: TTSSettings
  ): Promise<Result<boolean, string>> {
    const providerResult = this.getProvider(provider);
    if (providerResult.isFailure()) {
      return Result.failure(providerResult.getError());
    }

    const providerInstance = providerResult.getValue();

    try {
      const validationResult = await providerInstance.validateConfiguration(settings);
      
      if (validationResult.isSuccess()) {
        this.providerMonitoring.recordHealthCheck(provider, true);
        this.logging.info(`Configuration validated successfully for ${provider}`, 'Factory');
      } else {
        this.providerMonitoring.recordHealthCheck(provider, false);
        this.logging.warn(`Configuration validation failed for ${provider}: ${validationResult.getError()}`, 'Factory');
      }

      return validationResult;

    } catch (error) {
      const errorMessage = `Configuration validation error for ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logging.error(errorMessage, error as Error, 'Factory');
      this.providerMonitoring.recordHealthCheck(provider, false);
      return Result.failure(errorMessage);
    }
  }

  /**
   * Perform health checks on all providers
   */
  async performHealthChecks(): Promise<Map<ModelProvider, boolean>> {
    this.logging.info('Starting health checks for all providers', 'Factory');
    const healthResults = new Map<ModelProvider, boolean>();

    for (const [provider, instance] of this.providers.entries()) {
      try {
        // For now, we'll consider a provider healthy if it can return capabilities
        const capabilities = instance.getCapabilities();
        const isHealthy = !!capabilities;
        
        healthResults.set(provider, isHealthy);
        this.providerMonitoring.recordHealthCheck(provider, isHealthy);

      } catch (error) {
        healthResults.set(provider, false);
        this.providerMonitoring.recordHealthCheck(provider, false);
        this.logging.error(`Health check failed for ${provider}`, error as Error, 'Factory');
      }
    }

    this.logging.info(`Health checks completed. Healthy providers: ${Array.from(healthResults.entries())
      .filter(([, healthy]) => healthy)
      .map(([provider]) => provider)
      .join(', ')}`, 'Factory');
    
    return healthResults;
  }

  /**
   * Get the health status of a specific provider
   */
  getProviderHealth(provider: ModelProvider): boolean {
    const healthResult = this.providerMonitoring.getProviderHealth(provider);
    return healthResult.isSuccess() ? healthResult.getValue() : false;
  }

  /**
   * Clear caches for all providers
   */
  clearAllCaches(): void {
    this.logging.info('Clearing caches for all providers', 'Factory');
    
    for (const [provider, instance] of this.providers.entries()) {
      try {
        if (instance.clearCache) {
          instance.clearCache();
          this.logging.debug(`Cache cleared for ${provider}`, 'Factory');
        }
      } catch (error) {
        this.logging.error(`Failed to clear cache for ${provider}`, error as Error, 'Factory');
      }
    }
  }

  /**
   * Clear cache for a specific provider
   */
  clearProviderCache(provider: ModelProvider): Result<boolean, string> {
    const providerResult = this.getProvider(provider);
    if (providerResult.isFailure()) {
      return Result.failure(providerResult.getError());
    }

    const instance = providerResult.getValue();
    if (!instance.clearCache) {
      return Result.failure(`Provider ${provider} does not support cache clearing`);
    }

    try {
      instance.clearCache();
      this.logging.info(`Cache cleared for ${provider}`, 'Factory');
      return Result.success(true);
    } catch (error) {
      const errorMessage = `Failed to clear cache for ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.logging.error(errorMessage, error as Error, 'Factory');
      return Result.failure(errorMessage);
    }
  }

  /**
   * Get provider-specific settings interface information
   */
  getProviderSettingsInfo(provider: ModelProvider): Record<string, unknown> {
    const baseInfo = {
      provider,
      requiredFields: ['apiKey', 'voice', 'model'],
      optionalFields: []
    };

    switch (provider) {
      case ModelProvider.OPENAI:
        return {
          ...baseInfo,
          requiredFields: [...baseInfo.requiredFields],
          optionalFields: ['speed', 'responseFormat'],
          settingsType: 'OpenAISettings'
        };

      case ModelProvider.ELEVENLABS:
        return {
          ...baseInfo,
          requiredFields: [...baseInfo.requiredFields],
          optionalFields: ['stability', 'similarityBoost', 'style', 'useSpeakerBoost', 'model'],
          settingsType: 'ElevenLabsSettings'
        };

      case ModelProvider.AZURE:
        return {
          ...baseInfo,
          requiredFields: [...baseInfo.requiredFields, 'region'],
          optionalFields: ['subscriptionKey', 'resourceKey', 'customEndpoint'],
          settingsType: 'AzureSettings'
        };

      case ModelProvider.GOOGLE:
        return {
          ...baseInfo,
          requiredFields: [...baseInfo.requiredFields],
          optionalFields: ['projectId', 'location', 'audioProfile', 'effectsProfileId'],
          settingsType: 'GoogleSettings'
        };

      case ModelProvider.AWS:
        return {
          ...baseInfo,
          requiredFields: [...baseInfo.requiredFields, 'accessKeyId', 'secretKey'],
          optionalFields: ['region', 'customEndpoint'],
          settingsType: 'AWSPollySettings'
        };

      default:
        return baseInfo;
    }
  }
  // Provider initialization is now handled by Angular DI
}
