/**
 * TTS Integration Service
 * Orchestrates TTS generation across multiple providers
 * Follows onion architecture and uses signal-based reactive patterns
 */

import { Injectable, signal, Signal, computed, inject } from '@angular/core';
import { Result, success, failure } from '../../common/result';
import { Logger } from '../../common/utils';
import { TTSQuery, ModelProvider } from '../../domain/tts.entity';
import { TTSProviderFactory, ProviderConfig } from '../providers/tts-provider.factory';
import { ITTSProvider, TTSResponse } from '../../infrastructure/tts/interfaces/tts-provider.interface';
import { AudioService } from '../../infrastructure/audio/audio.service';
import { StorageIntegrationService } from './storage-integration.service';

export interface TTSGenerationResult {
  readonly query: TTSQuery;
  readonly provider: ModelProvider;
  readonly response: TTSResponse;
  readonly generatedAt: Date;
  readonly duration: number;
}

export interface TTSServiceState {
  readonly isGenerating: boolean;
  readonly currentProvider?: ModelProvider;
  readonly lastGeneration?: TTSGenerationResult;
  readonly error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TTSIntegrationService {
  private readonly providerFactory = inject(TTSProviderFactory);
  private readonly audioService = new AudioService();
  private readonly storageService = inject(StorageIntegrationService);
  
  // Signal-based state management
  private readonly _serviceState = signal<TTSServiceState>({
    isGenerating: false,
    currentProvider: undefined,
    lastGeneration: undefined,
    error: undefined
  });
  
  private readonly _currentGeneration = signal<Signal<Result<TTSResponse, string>> | null>(null);
    public readonly serviceState: Signal<TTSServiceState> = this._serviceState.asReadonly();
  public readonly audioState = this.audioService.audioState;
  public readonly storageState = this.storageService.storageState;
  public readonly storageInfo = this.storageService.storageInfo;
  
  public readonly availableProviders = this.providerFactory.availableProviders;
  public readonly providerStatuses = this.providerFactory.providerStatuses;
    public readonly canGenerate = computed(() => {
    const state = this._serviceState();
    const providers = this.availableProviders();
    return !state.isGenerating && providers.length > 0;
  });
  /**
   * Initialize TTS service and storage
   */
  initialize(): Result<boolean, string> {
    Logger.info('Initializing TTS Integration Service', 'TTSIntegrationService');

    try {
      // Initialize storage
      const storageResult = this.storageService.initialize();

      if (!storageResult.isSuccess) {
        Logger.warn(`Storage initialization failed: ${storageResult.error}`, 'TTSIntegrationService');
        // Continue without storage - it's not critical for TTS generation
      } else {
        Logger.info('Storage initialized successfully', 'TTSIntegrationService');
      }

      return success(true);
    } catch (error) {
      const errorMessage = `TTS service initialization failed: ${error}`;
      Logger.error(errorMessage, 'TTSIntegrationService');
      return failure(errorMessage);
    }
  }
  
  /**
   * Configure TTS providers
   */
  configureProvider(config: ProviderConfig): Result<boolean, string> {
    Logger.info(`Configuring provider: ${config.provider}`, 'TTSIntegrationService');
    
    const result = this.providerFactory.registerProvider(config);
    
    if (!result.isSuccess) {
      Logger.error(`Failed to configure provider ${config.provider}: ${result.error}`, 'TTSIntegrationService');
      this._serviceState.set({
        ...this._serviceState(),
        error: result.error
      });
    } else {
      Logger.info(`Provider ${config.provider} configured successfully`, 'TTSIntegrationService');
      // Clear any previous errors
      this._serviceState.set({
        ...this._serviceState(),
        error: undefined
      });
    }
    
    return result;
  }
  
  /**
   * Generate TTS audio from query
   */
  generateTTS(query: TTSQuery, preferredProvider?: ModelProvider): Signal<Result<TTSGenerationResult, string>> {
    Logger.info(`Starting TTS generation for query: ${query.id}`, 'TTSIntegrationService');
    
    const resultSignal = signal<Result<TTSGenerationResult, string>>(
      failure('Generation in progress...')
    );
    
    // Check if already generating
    if (this._serviceState().isGenerating) {
      resultSignal.set(failure('TTS generation already in progress'));
      return resultSignal.asReadonly();
    }
    
    // Select provider
    const provider = this.selectProvider(preferredProvider);
    if (!provider.isSuccess) {
      resultSignal.set(failure(provider.error));
      return resultSignal.asReadonly();
    }
    
    // Update state
    this._serviceState.set({
      isGenerating: true,
      currentProvider: provider.value.provider,
      lastGeneration: undefined,
      error: undefined
    });
    
    const startTime = Date.now();
    
    // Generate TTS
    const ttsProvider = provider.value.providerInstance;
    const ttsResponseSignal = ttsProvider.generateTTS(query);
    
    // Monitor the TTS generation
    this.monitorGeneration(query, provider.value.provider, ttsResponseSignal, resultSignal, startTime);
    
    return resultSignal.asReadonly();
  }
  
  /**
   * Play generated audio
   */
  playAudio(): Result<boolean, string> {
    const lastGeneration = this._serviceState().lastGeneration;
    
    if (!lastGeneration) {
      return failure('No audio available to play');
    }
    
    // Load audio if not already loaded
    const loadResult = this.audioService.loadAudio(lastGeneration.response);
    if (!loadResult.isSuccess) {
      return loadResult;
    }
    
    // Play audio
    return this.audioService.playAudio();
  }
  
  /**
   * Pause audio playback
   */
  pauseAudio(): Result<boolean, string> {
    return this.audioService.pauseAudio();
  }
  
  /**
   * Stop audio playback
   */
  stopAudio(): Result<boolean, string> {
    return this.audioService.stopAudio();
  }
  
  /**
   * Download generated audio
   */
  downloadAudio(filename?: string): Result<boolean, string> {
    const lastGeneration = this._serviceState().lastGeneration;
    
    if (!lastGeneration) {
      return failure('No audio available to download');
    }
    
    const downloadOptions = {
      filename: filename || `tts-${lastGeneration.query.id}.mp3`,
      format: lastGeneration.response.format
    };
    
    return this.audioService.downloadAudio(lastGeneration.response, downloadOptions);
  }
  
  /**
   * Set audio volume
   */
  setVolume(volume: number): Result<boolean, string> {
    return this.audioService.setVolume(volume);
  }
  
  /**
   * Check provider availability
   */
  checkProviderAvailability(provider: ModelProvider): Signal<Result<boolean, string>> {
    const providerResult = this.providerFactory.getProvider(provider);
    
    if (!providerResult.isSuccess) {
      const errorSignal = signal<Result<boolean, string>>(failure(providerResult.error));
      return errorSignal.asReadonly();
    }
    
    return providerResult.value.checkAvailability();
  }
  
  /**
   * Get provider configurations
   */
  getProviderConfigs(): Signal<ProviderConfig[]> {
    return this.providerFactory.getProviderConfigs();
  }
  
  private selectProvider(preferredProvider?: ModelProvider): Result<{ provider: ModelProvider; providerInstance: ITTSProvider }, string> {
    // If preferred provider specified, try to use it
    if (preferredProvider) {
      const providerResult = this.providerFactory.getProvider(preferredProvider);
      if (providerResult.isSuccess) {
        return success({
          provider: preferredProvider,
          providerInstance: providerResult.value
        });
      }
      
      Logger.warn(`Preferred provider ${preferredProvider} not available: ${providerResult.error}`, 'TTSIntegrationService');
    }
    
    // Fall back to any available provider
    const availableProviders = this.availableProviders();
    
    if (availableProviders.length === 0) {
      return failure('No TTS providers are configured and available');
    }
    
    // Select first available provider
    const selectedProvider = availableProviders[0];
    const providerResult = this.providerFactory.getProvider(selectedProvider);
    
    if (!providerResult.isSuccess) {
      return failure(`Failed to get provider instance: ${providerResult.error}`);
    }
    
    return success({
      provider: selectedProvider,
      providerInstance: providerResult.value
    });
  }
  
  private monitorGeneration(
    query: TTSQuery,
    provider: ModelProvider,
    ttsResponseSignal: Signal<Result<TTSResponse, string>>,
    resultSignal: ReturnType<typeof signal<Result<TTSGenerationResult, string>>>,
    startTime: number
  ): void {
    // Create a reactive effect to monitor the TTS response
    const monitorEffect = () => {
      const ttsResult = ttsResponseSignal();
        if (ttsResult.isSuccess) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        const generationResult: TTSGenerationResult = {
          query,
          provider,
          response: ttsResult.value,
          generatedAt: new Date(),
          duration
        };
        
        // Update service state
        this._serviceState.set({
          isGenerating: false,
          currentProvider: undefined,
          lastGeneration: generationResult,
          error: undefined
        });
        
        // Set result
        resultSignal.set(success(generationResult));
        
        Logger.info(`TTS generation completed successfully in ${duration}ms`, 'TTSIntegrationService');
        
        // Automatically store the result
        this.storeGenerationResult(query, ttsResult.value);
        
      } else if (ttsResult.error !== 'Request in progress...') {
        // Generation failed
        this._serviceState.set({
          isGenerating: false,
          currentProvider: undefined,
          lastGeneration: undefined,
          error: ttsResult.error
        });
        
        resultSignal.set(failure(ttsResult.error));
        
        Logger.error(`TTS generation failed: ${ttsResult.error}`, 'TTSIntegrationService');
      }
    };
      // Monitor the signal (in a real Angular app, this would use effect())
    monitorEffect();
  }
  /**
   * Store TTS generation result in history
   */
  private storeGenerationResult(query: TTSQuery, response: TTSResponse): void {
    try {
      if (this.storageService.isReady()) {
        const storeResult = this.storageService.storeTTSResult(query, response);

        if (storeResult.isSuccess) {
          Logger.info(`Stored TTS result for query ${query.id}`, 'TTSIntegrationService');
        } else {
          Logger.warn(`Failed to store TTS result: ${storeResult.error}`, 'TTSIntegrationService');
        }
      } else {
        Logger.warn('Storage not ready, skipping result storage', 'TTSIntegrationService');
      }
    } catch (error) {
      Logger.error(`Error storing TTS result: ${error}`, 'TTSIntegrationService');
    }
  }
}
