// OpenAI TTS provider implementation
import { Injectable, signal, computed, effect } from '@angular/core';
import { LoggingService } from '../logging.service';
import { MonitoringService } from '../monitoring.service';
import { TTSSettings, TTSResult, QueryId, ModelProvider, TTSResultStatus, QueryText } from '../../domain/tts.entity';
import { Result } from '../../common/result';
import { OpenAITTSService } from '../../infrastructure/providers/openai/openai-tts.service';
import { TTSProvider } from './tts-provider.factory';

export interface OpenAISettings extends TTSSettings {
  speed?: number; // 0.25 to 4.0
  responseFormat?: 'mp3' | 'opus' | 'aac' | 'flac';
}

export interface OpenAICapabilities {
  name: string;
  provider: ModelProvider;
  maxTextLength: number;
  supportedModels: string[];
  supportedVoices: string[];
  supportedFormats: string[];
  costEstimation: {
    pricePerThousandChars: number;
    currency: string;
  };
  features: {
    customVoices: boolean;
    voiceCloning: boolean;
    emotionalTones: boolean;
    languageDetection: boolean;
    ssmlSupport: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class OpenAITTSProviderService implements TTSProvider {
  // Reactive signals for provider state
  private cache = signal(new Map<string, { result: TTSResult; timestamp: number }>());
  private cacheDuration = signal(5 * 60 * 1000); // 5 minutes
  private isValidated = signal(false);
  private lastValidationTime = signal<Date | null>(null);
  private synthesisCount = signal(0);
  private errorCount = signal(0);
  
  // Computed signals for reactive derived data
  readonly cacheSize = computed(() => this.cache().size);
  readonly successRate = computed(() => {
    const total = this.synthesisCount();
    const errors = this.errorCount();
    return total > 0 ? ((total - errors) / total) * 100 : 100;
  });
  readonly cacheHitRate = computed(() => {
    // This would be tracked separately in a real implementation
    return this.cacheSize() > 0 ? 25 : 0; // Estimate
  });
  readonly providerStatus = computed(() => {
    if (!this.isValidated()) return 'unconfigured';
    if (this.errorCount() > this.synthesisCount() * 0.5) return 'degraded';
    return 'healthy';
  });
  
  private readonly capabilities: OpenAICapabilities;
  private readonly openaiService: OpenAITTSService;

  constructor(
    private logging: LoggingService,
    private monitoring: MonitoringService
  ) {
    this.openaiService = new OpenAITTSService();
    this.capabilities = {
      name: 'OpenAI Text-to-Speech',
      provider: ModelProvider.OPENAI,
      maxTextLength: 4096,
      supportedModels: ['tts-1', 'tts-1-hd'],
      supportedVoices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
      supportedFormats: ['mp3', 'opus', 'aac', 'flac'],
      costEstimation: {
        pricePerThousandChars: 0.015, // tts-1 base price
        currency: 'USD'
      },
      features: {
        customVoices: false,
        voiceCloning: false,
        emotionalTones: true,
        languageDetection: true,
        ssmlSupport: false
      }
    };

    // Reactive effects for cache management and monitoring
    effect(() => {
      const size = this.cacheSize();
      if (size > 100) { // Clear cache if it gets too large
        this.cleanupExpiredCache();
      }
    });
    
    effect(() => {
      const status = this.providerStatus();
      this.logging.debug(`OpenAI provider status: ${status}`, 'OpenAITTSService', {
        synthesisCount: this.synthesisCount(),
        errorCount: this.errorCount(),
        successRate: this.successRate()
      });
    });

    this.logging.info('OpenAI TTS provider initialized', 'OpenAITTSService');
  }

  /**
   * Synthesize speech using OpenAI TTS API
   */
  async synthesizeSpeech(
    text: string, 
    settings: OpenAISettings, 
    queryId: QueryId
  ): Promise<Result<TTSResult, string>> {
    const startTime = Date.now();
    
    try {
      this.logging.info('Starting OpenAI TTS synthesis', 'OpenAITTSService', {
        queryId: queryId.getValue(),
        textLength: text.length,
        model: settings.model,
        voice: settings.voice
      });      // Check cache first
      const cacheKey = this.generateCacheKey(text, settings);
      const cachedResult = this.getCachedResult(cacheKey);
      if (cachedResult) {
        this.logging.info('Returning cached OpenAI TTS result', 'OpenAITTSService', {
          queryId: queryId.getValue()
        });
        this.monitoring.recordRequest('openai_cache_hit', Date.now() - startTime, true, ModelProvider.OPENAI);
        return Result.success(cachedResult);
      }

      // Validate configuration
      const validationResult = await this.validateConfiguration(settings);
      if (validationResult.isFailure()) {
        this.errorCount.update(count => count + 1);
        this.monitoring.recordRequest('openai_validation', Date.now() - startTime, false, ModelProvider.OPENAI);
        return Result.failure(validationResult.getError());
      }

      // Call OpenAI service
      const queryText = QueryText.fromString(text);
      const audioData = await this.openaiService.generateSpeech(queryText, settings);
      
      const duration = this.estimateDuration(text);
      
      // Create result
      const result: TTSResult = {
        queryId,
        status: TTSResultStatus.COMPLETED,
        audioData,
        duration,
        fileSize: audioData.length,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Cache the result
      this.cacheResult(cacheKey, result);
      this.synthesisCount.update(count => count + 1);

      this.logging.info('OpenAI TTS synthesis completed successfully', 'OpenAITTSService', {
        queryId: queryId.getValue(),
        audioSize: audioData.length,
        duration
      });        this.monitoring.recordRequest('openai_synthesis', Date.now() - startTime, true, ModelProvider.OPENAI);
      return Result.success(result);

    } catch (error) {
      this.errorCount.update(count => count + 1);
      this.logging.error('OpenAI TTS synthesis failed', error as Error, 'OpenAITTSService', {
        queryId: queryId.getValue(),
        textLength: text.length
      });

      this.monitoring.recordRequest('openai_synthesis', Date.now() - startTime, false, ModelProvider.OPENAI);

      // Create failed result
      const failedResult: TTSResult = {
        queryId,
        status: TTSResultStatus.FAILED,
        error: {
          code: 'SYNTHESIS_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return Result.success(failedResult); // Return success with failed status for consistent handling
    }
  }
  /**
   * Validate OpenAI configuration
   */
  async validateConfiguration(settings: OpenAISettings): Promise<Result<boolean, string>> {
    try {
      this.logging.info('Validating OpenAI configuration', 'OpenAITTSService');

      // Check API key
      if (!settings.apiKey?.getValue()) {
        return Result.failure('OpenAI API key is required');
      }

      // Validate model
      if (!this.capabilities.supportedModels.includes(settings.model)) {
        return Result.failure(`Unsupported OpenAI model: ${settings.model}. Supported models: ${this.capabilities.supportedModels.join(', ')}`);
      }

      // Validate voice
      if (!this.capabilities.supportedVoices.includes(settings.voice)) {
        return Result.failure(`Unsupported OpenAI voice: ${settings.voice}. Supported voices: ${this.capabilities.supportedVoices.join(', ')}`);
      }

      // Validate speed if provided
      if (settings.speed !== undefined && (settings.speed < 0.25 || settings.speed > 4.0)) {
        return Result.failure('OpenAI speed must be between 0.25 and 4.0');
      }

      // Test API key validity
      const isValidKey = await this.openaiService.validateApiKey(settings.apiKey.getValue());
      if (!isValidKey) {
        return Result.failure('Invalid OpenAI API key or insufficient permissions');
      }

      // Update validation status
      this.isValidated.set(true);
      this.lastValidationTime.set(new Date());

      this.logging.info('OpenAI configuration validation successful', 'OpenAITTSService');
      return Result.success(true);

    } catch (error) {
      this.isValidated.set(false);
      this.logging.error('OpenAI configuration validation failed', error as Error, 'OpenAITTSService');
      return Result.failure(`Configuration validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get provider capabilities
   */
  getCapabilities(): OpenAICapabilities {
    return this.capabilities;
  }
  /**
   * Clear provider cache
   */
  clearCache(): void {
    this.logging.info('Clearing OpenAI TTS cache', 'OpenAITTSService', {
      cachedItems: this.cacheSize()
    });
    this.cache.set(new Map());
  }
  
  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const currentCache = this.cache();
    const now = Date.now();
    const duration = this.cacheDuration();
    
    const cleanedCache = new Map();
    for (const [key, entry] of currentCache.entries()) {
      if (now - entry.timestamp <= duration) {
        cleanedCache.set(key, entry);
      }
    }
    
    this.cache.set(cleanedCache);
    this.logging.debug('Cleaned up expired cache entries', 'OpenAITTSService', {
      before: currentCache.size,
      after: cleanedCache.size
    });
  }

  /**
   * Get cached result if valid
   */
  private getCachedResult(cacheKey: string): TTSResult | null {
    const cached = this.cache().get(cacheKey);
    if (!cached) {
      return null;
    }

    const isExpired = Date.now() - cached.timestamp > this.cacheDuration();
    if (isExpired) {
      // Remove expired entry
      const currentCache = this.cache();
      const newCache = new Map(currentCache);
      newCache.delete(cacheKey);
      this.cache.set(newCache);
      return null;
    }

    return cached.result;
  }

  /**
   * Cache synthesis result
   */
  private cacheResult(cacheKey: string, result: TTSResult): void {
    const currentCache = this.cache();
    const newCache = new Map(currentCache);
    newCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
    this.cache.set(newCache);
  }

  /**
   * Generate cache key for text and settings
   */
  private generateCacheKey(text: string, settings: OpenAISettings): string {
    const settingsHash = `${settings.model}:${settings.voice}:${settings.speed || 1.0}:${settings.responseFormat || 'mp3'}`;
    return `openai:${Buffer.from(text).toString('base64')}:${settingsHash}`;
  }
  /**
   * Estimate audio duration based on text length
   */
  private estimateDuration(text: string): number {
    // Rough estimation: ~150 words per minute, ~5 characters per word
    const wordsPerMinute = 150;
    const charactersPerWord = 5;
    const words = text.length / charactersPerWord;
    return Math.max(1, Math.round((words / wordsPerMinute) * 60));
  }
}
