/**
 * Integration Layer TTS Provider Factory
 * Factory service for creating and managing TTS provider instances using Angular DI
 * Fixes NG0203 errors by properly using injection context
 */

import { Injectable, signal, Signal, computed, inject } from '@angular/core';
import { ModelProvider } from '../../domain/tts.entity';
import { Result, success, failure } from '../../common/result';
import { Logger } from '../../common/utils';
import { ITTSProvider, TTSProviderStatus } from '../../infrastructure/tts/interfaces/tts-provider.interface';
import { OpenAITTSProvider } from '../../infrastructure/tts/providers/openai-tts.provider';
import { ElevenLabsTTSProvider } from '../../infrastructure/tts/providers/elevenlabs-tts.provider';
import { EdgeTTSProvider } from '../../infrastructure/tts/providers/edge-tts.provider';

export interface ProviderConfig {
  readonly provider: ModelProvider;
  readonly apiKey: string;
  readonly isEnabled: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TTSProviderFactory {  // Inject provider instances in constructor (within injection context)
  private readonly openaiProvider = inject(OpenAITTSProvider);
  private readonly elevenlabsProvider = inject(ElevenLabsTTSProvider);
  private readonly edgeProvider: EdgeTTSProvider = inject(EdgeTTSProvider);
  
  // Signal-based provider registry
  private readonly _providers = signal<Map<ModelProvider, ITTSProvider>>(new Map());
  private readonly _configs = signal<Map<ModelProvider, ProviderConfig>>(new Map());
  
  public readonly availableProviders: Signal<ModelProvider[]> = computed(() => {
    return Array.from(this._providers().keys()).filter(provider => 
      this._configs().get(provider)?.isEnabled ?? false
    );
  });
    
  public readonly providerStatuses = computed(() => {
    const statuses = new Map<ModelProvider, TTSProviderStatus>();
    this._providers().forEach((provider, key) => {
      statuses.set(key, provider.status());
    });
    return statuses;
  });
  
  /**
   * Register a provider with configuration
   */  
  registerProvider(config: ProviderConfig): Result<boolean, string> {
    try {
      Logger.info(`Registering provider: ${config.provider}`, 'TTSProviderFactory');
      
      const provider = this.createProvider(config.provider, config.apiKey);
      if (!provider.isSuccess) {
        return failure(provider.error);
      }
      
      // Update provider map
      const currentProviders = new Map(this._providers());
      currentProviders.set(config.provider, provider.value);
      this._providers.set(currentProviders);
      
      // Update config map
      const currentConfigs = new Map(this._configs());
      currentConfigs.set(config.provider, config);
      this._configs.set(currentConfigs);
      
      Logger.info(`Provider ${config.provider} registered successfully`, 'TTSProviderFactory');
      return success(true);
      
    } catch (error) {
      const errorMessage = `Failed to register provider ${config.provider}: ${error}`;
      Logger.error(errorMessage, 'TTSProviderFactory');
      return failure(errorMessage);
    }
  }
  
  /**
   * Get a provider instance
   */
  getProvider(provider: ModelProvider): Result<ITTSProvider, string> {
    const providerInstance = this._providers().get(provider);
    
    if (!providerInstance) {
      return failure(`Provider ${provider} is not registered`);
    }
    
    const config = this._configs().get(provider);
    if (!config?.isEnabled) {
      return failure(`Provider ${provider} is disabled`);
    }
    
    return success(providerInstance);
  }
  
  /**
   * Check if a provider is available and enabled
   */
  isProviderAvailable(provider: ModelProvider): boolean {
    const config = this._configs().get(provider);
    const providerInstance = this._providers().get(provider);
    
    return !!(config?.isEnabled && providerInstance && providerInstance.status().isAvailable);
  }
  
  /**
   * Update provider configuration
   */
  updateProviderConfig(provider: ModelProvider, updates: Partial<ProviderConfig>): Result<boolean, string> {
    const currentConfig = this._configs().get(provider);
    
    if (!currentConfig) {
      return failure(`Provider ${provider} is not registered`);
    }
    
    const newConfig: ProviderConfig = {
      ...currentConfig,
      ...updates
    };
      
    // If API key changed, recreate the provider
    if (updates.apiKey && updates.apiKey !== currentConfig.apiKey) {
      const newProvider = this.createProvider(provider, updates.apiKey);
      if (!newProvider.isSuccess) {
        return failure(newProvider.error);
      }
      
      // Update provider instance
      const currentProviders = new Map(this._providers());
      currentProviders.set(provider, newProvider.value);
      this._providers.set(currentProviders);
    }
    
    // Update config
    const currentConfigs = new Map(this._configs());
    currentConfigs.set(provider, newConfig);
    this._configs.set(currentConfigs);
    
    Logger.info(`Provider ${provider} configuration updated`, 'TTSProviderFactory');
    return success(true);
  }
  
  /**
   * Remove a provider
   */
  removeProvider(provider: ModelProvider): Result<boolean, string> {
    const currentProviders = new Map(this._providers());
    const currentConfigs = new Map(this._configs());
    
    currentProviders.delete(provider);
    currentConfigs.delete(provider);
    
    this._providers.set(currentProviders);
    this._configs.set(currentConfigs);
    
    Logger.info(`Provider ${provider} removed`, 'TTSProviderFactory');
    return success(true);
  }
  
  /**
   * Get all registered provider configs
   */
  getProviderConfigs(): Signal<ProviderConfig[]> {
    return computed(() => Array.from(this._configs().values()));
  }
  
  /**
   * Check availability of all registered providers
   */
  checkAllProviderAvailability(): Signal<Map<ModelProvider, Result<boolean, string>>> {
    const availabilitySignal = signal<Map<ModelProvider, Result<boolean, string>>>(new Map());
    
    const providers = this._providers();
    const results = new Map<ModelProvider, Result<boolean, string>>();
    
    providers.forEach((provider, key) => {
      const config = this._configs().get(key);
      if (config?.isEnabled) {
        const availability = provider.checkAvailability();
        // Subscribe to the availability signal and update results
        availability(); // Get current value
        results.set(key, availability());
      } else {
        results.set(key, failure('Provider is disabled'));
      }
    });
    
    availabilitySignal.set(results);
    return availabilitySignal.asReadonly();
  }  /**
   * Create provider instance using Angular DI context
   * This fixes the NG0203 error by using pre-injected providers
   */
  private createProvider(provider: ModelProvider, apiKey: string): Result<ITTSProvider, string> {
    try {
      switch (provider) {
        case ModelProvider.OPENAI: {
          // Use pre-injected provider and configure it with the API key
          this.openaiProvider.setApiKey(apiKey);
          return success(this.openaiProvider);
        }
          
        case ModelProvider.ELEVENLABS: {
          // Use pre-injected provider and configure it with the API key
          this.elevenlabsProvider.setApiKey(apiKey);
          return success(this.elevenlabsProvider);
        }
            case ModelProvider.EDGE: {
          // Edge TTS doesn't require API key but we'll call setApiKey for consistency
          this.edgeProvider.setApiKey(apiKey);
          return success(this.edgeProvider as ITTSProvider);
        }
          
        default:
          return failure(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      return failure(`Failed to create provider ${provider}: ${error}`);
    }
  }
}
