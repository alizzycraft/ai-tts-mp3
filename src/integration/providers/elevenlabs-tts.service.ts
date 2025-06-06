// ElevenLabs TTS provider implementation
import { Injectable, signal, computed, PLATFORM_ID, inject } from '@angular/core';
import { LoggingService } from '../logging.service';
import { ProviderMonitoringService } from '../monitoring/provider-monitoring.service';
import { TTSSettings, TTSResult, QueryId, ModelProvider, TTSResultStatus } from '../../domain/entities/tts.entity';
import { Result } from '../../common/value-objects/query/result';
import { ProviderHealthMetrics } from '../monitoring/provider-monitoring.service';
import { isPlatformBrowser } from '@angular/common';

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  fine_tuning: {
    is_allowed: boolean;
  };
  labels: Record<string, string>;
  description: string;
  preview_url: string;
  available_for_tiers: string[];
  settings: {
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
  };
}

export interface ElevenLabsModel {
  model_id: string;
  name: string;
  can_be_finetuned: boolean;
  can_do_text_to_speech: boolean;
  can_do_voice_conversion: boolean;
  can_use_style: boolean;
  can_use_speaker_boost: boolean;
  serves_pro_voices: boolean;
  token_cost_factor: number;
  description: string;
  requires_alpha_access: boolean;
  max_characters_request_free_user: number;
  max_characters_request_subscribed_user: number;
  maximum_text_length_request: number;
  languages: {
    language_id: string;
    name: string;
  }[];
}

// Voice settings interface for ElevenLabs
export interface ElevenLabsSettings extends TTSSettings {
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ElevenLabsTTSService {
  private logging = inject(LoggingService);
  private providerMonitoring = inject(ProviderMonitoringService);
  private platformId = inject(PLATFORM_ID);

  private readonly baseUrl = 'https://api.elevenlabs.io/v1';
  private readonly cacheExpiryTime = 5 * 60 * 1000; // 5 minutes

  // Reactive state with signals
  private cachedVoices = signal<ElevenLabsVoice[]>([]);
  private cachedModels = signal<ElevenLabsModel[]>([]);
  private voicesCacheExpiry = signal<Date | null>(null);
  private modelsCacheExpiry = signal<Date | null>(null);
  private isValidated = signal<boolean>(false);
  private synthesisCount = signal<number>(0);
  private errorCount = signal<number>(0);
  private lastCheckTime = signal<Date>(new Date());
  private readonly initialized = signal(false);

  // Computed reactive properties
  readonly voicesCount = computed(() => this.cachedVoices().length);
  readonly modelsCount = computed(() => this.cachedModels().length);
  readonly successRate = computed(() => {
    const total = this.synthesisCount() + this.errorCount();
    return total > 0 ? (this.synthesisCount() / total) * 100 : 0;
  });

  readonly cacheStatus = computed(() => {
    const now = new Date();
    this.lastCheckTime.set(now); // Trigger recomputation periodically
    
    // Check voice cache
    if (this.voicesCacheExpiry() && now > this.voicesCacheExpiry()!) {
      this.clearVoicesCache();
    }
    
    // Check model cache
    if (this.modelsCacheExpiry() && now > this.modelsCacheExpiry()!) {
      this.clearModelsCache();
    }
    
    return {
      voicesCount: this.voicesCount(),
      modelsCount: this.modelsCount(),
      voicesCacheValid: !this.voicesCacheExpiry() || now <= this.voicesCacheExpiry()!,
      modelsCacheValid: !this.modelsCacheExpiry() || now <= this.modelsCacheExpiry()!
    };
  });  readonly providerStatus = computed(() => {
    const status = !this.isValidated() ? 'unconfigured' 
      : this.successRate() < 80 ? 'unhealthy'
      : this.successRate() < 95 ? 'degraded' 
      : 'healthy';    if (status !== 'healthy') {
      if (status === 'unhealthy') {
        this.logging.error('ElevenLabs provider is unhealthy', new Error(`Provider status: ${status}`), 'ElevenLabs', {
          synthesisCount: this.synthesisCount(),
          errorCount: this.errorCount(),
          successRate: this.successRate()
        });
      } else {
        this.logging.warn(`ElevenLabs provider status: ${status}`, 'ElevenLabs', {
          synthesisCount: this.synthesisCount(),
          errorCount: this.errorCount(),
          successRate: this.successRate()
        });
      }
    }
    return status;
  });  constructor() {
    if (!this.initialized() && isPlatformBrowser(this.platformId)) {
      this.initialized.set(true);
      this.logging.info('ElevenLabsTTSService initialized', 'ElevenLabs');
    }
    this.lastCheckTime.set(new Date());
  }

  // Core TTS functionality
  async synthesizeSpeech(
    text: string,
    settings: TTSSettings,
    queryId: QueryId
  ): Promise<Result<TTSResult, string>> {
    if (!settings.apiKey) {
      return Result.failure('ElevenLabs API key is required');
    }

    if (!text?.trim()) {
      return Result.failure('Text is required');
    }

    return this.logging.trackPerformance(
      'elevenLabsSynthesize',
      async () => {
        const startTime = Date.now();
        
        this.logging.info('Starting ElevenLabs synthesis', 'ElevenLabs', {
          textLength: text.length,
          voice: settings.voice,
          model: settings.model
        });

        try {
          // Validate text length against model limits
          const model = this.cachedModels().find(m => m.model_id === settings.model);
          const maxLength = model?.maximum_text_length_request || 2500;
          if (text.length > maxLength) {
            throw new Error(`Text length (${text.length}) exceeds maximum allowed characters (${maxLength})`);
          }

          const audioData = await this.makeTextToSpeechRequest(text, settings);
          const processingTime = Date.now() - startTime;
          
          this.synthesisCount.update(count => count + 1);
          this.updateProviderHealth();

          const result: TTSResult = {
            queryId,
            status: TTSResultStatus.COMPLETED,
            createdAt: new Date(),
            updatedAt: new Date(),
            audioData,
            duration: this.estimateAudioDuration(audioData),
            fileSize: audioData.byteLength,
            processingTime
          };

          this.logging.info('ElevenLabs synthesis completed successfully', 'ElevenLabs', {
            fileSize: audioData.byteLength,
            duration: result.duration,
            processingTime
          });

          return Result.success(result);

        } catch (error) {
          const processingTime = Date.now() - startTime;
          this.errorCount.update(count => count + 1);
          this.updateProviderHealth();

          // Convert any error to a string message
          let errorMessage: string;
          if (error instanceof Error) {
            errorMessage = error.message;
          } else if (typeof error === 'string') {
            errorMessage = error;
          } else if (error && typeof error === 'object' && 'message' in error) {
            errorMessage = String(error.message);
          } else {
            errorMessage = 'Unknown error occurred';
          }

          this.logging.error('ElevenLabs synthesis failed', 
            error instanceof Error ? error : new Error(errorMessage), 
            'ElevenLabs', 
            {
              processingTime,
              errorMessage,
              successRate: this.successRate()
            }
          );

          const result: TTSResult = {
            queryId,
            status: TTSResultStatus.FAILED,
            createdAt: new Date(),
            updatedAt: new Date(),
            error: {
              code: 'SYNTHESIS_ERROR',
              message: errorMessage,
              details: error
            },
            processingTime
          };

          return Result.success(result);
        }
      }
    );
  }

  // Voice management
  async getAvailableVoices(apiKey: string): Promise<Result<ElevenLabsVoice[], string>> {
    // Check if cache is valid
    if (this.cachedVoices().length > 0 && this.voicesCacheExpiry() && new Date() < this.voicesCacheExpiry()!) {
      return Result.success(this.cachedVoices());
    }

    return this.logging.trackPerformance(
      'elevenLabsGetVoices',
      async () => {
        try {
          const response = await fetch(`${this.baseUrl}/voices`, {
            headers: {
              'xi-api-key': apiKey,
              'Accept': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch voices: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          const voices = this.transformElevenLabsVoices(data.voices);
          this.cachedVoices.set(voices);
          this.voicesCacheExpiry.set(new Date(Date.now() + this.cacheExpiryTime));

          this.logging.info(`Retrieved ${voices.length} ElevenLabs voices`, 'ElevenLabs');
          return Result.success(voices);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch voices';
          this.logging.error('Failed to fetch ElevenLabs voices', error as Error, 'ElevenLabs');
          return Result.failure(errorMessage);
        }
      }
    );
  }

  // Model management
  async getAvailableModels(apiKey: string): Promise<Result<ElevenLabsModel[], string>> {
    // Check if cache is valid
    if (this.cachedModels().length > 0 && this.modelsCacheExpiry() && new Date() < this.modelsCacheExpiry()!) {
      return Result.success(this.cachedModels());
    }

    return this.logging.trackPerformance(
      'elevenLabsGetModels',
      async () => {
        try {
          const response = await fetch(`${this.baseUrl}/models`, {
            headers: {
              'xi-api-key': apiKey,
              'Accept': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          const models = this.transformElevenLabsModels(data);
          this.cachedModels.set(models);
          this.modelsCacheExpiry.set(new Date(Date.now() + this.cacheExpiryTime));

          this.logging.info(`Retrieved ${models.length} ElevenLabs models`, 'ElevenLabs');
          return Result.success(models);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch models';
          this.logging.error('Failed to fetch ElevenLabs models', error as Error, 'ElevenLabs');
          return Result.failure(errorMessage);
        }
      }
    );
  }

  // Validation and capabilities
  async validateConfiguration(settings: TTSSettings): Promise<Result<boolean, string>> {
    if (!settings.apiKey) {
      return Result.failure('API key is required');
    }

    // Test API key by fetching user info
    try {
      const response = await fetch(`${this.baseUrl}/user`, {
        headers: {
          'xi-api-key': settings.apiKey.getValue(),
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        return Result.failure(`Invalid API key or network error: ${response.status}`);
      }      this.logging.info('ElevenLabs configuration validated successfully', 'ElevenLabs');
      this.isValidated.set(true);
      this.updateProviderHealth(); // Update health metrics after successful validation
      return Result.success(true);

    } catch (error) {
      this.isValidated.set(false);
      this.updateProviderHealth(); // Update health metrics after failed validation
      const errorMessage = error instanceof Error ? error.message : 'Configuration validation failed';
      this.logging.error('ElevenLabs configuration validation failed', error as Error, 'ElevenLabs');
      return Result.failure(errorMessage);
    }
  }

  getCapabilities() {
    return {
      maxTextLength: 5000, // ElevenLabs limit for most models
      supportedFormats: ['mp3'],
      supportsSSML: false,
      supportsStreaming: true,
      defaultModel: 'eleven_monolingual_v1',
      defaultVoice: 'Rachel', // Popular ElevenLabs voice
      requiresApiKey: true
    };
  }

  clearCache(): void {
    this.clearVoicesCache();
    this.clearModelsCache();
    this.logging.info('ElevenLabs cache cleared', 'ElevenLabs');
  }

  // Private helper methods
  private clearVoicesCache(): void {
    this.cachedVoices.set([]);
    this.voicesCacheExpiry.set(null);
    this.logging.info('ElevenLabs voices cache expired and cleared', 'ElevenLabs');
  }

  private clearModelsCache(): void {
    this.cachedModels.set([]);
    this.modelsCacheExpiry.set(null);
    this.logging.info('ElevenLabs models cache expired and cleared', 'ElevenLabs');
  }

  private async makeTextToSpeechRequest(text: string, settings: TTSSettings): Promise<Uint8Array> {
    if (!settings.apiKey?.getValue()) {
      throw new Error('ElevenLabs API key is required');
    }

    if (!settings.voice) {
      throw new Error('Voice ID is required');
    }

    // Type guard for ElevenLabs specific settings
    const elevenLabsSettings = settings as ElevenLabsSettings;
    
    // Validate and normalize settings with safe defaults
    const payload = {
      text: String(text).trim(),
      model_id: String(settings.model || 'eleven_monolingual_v1'),
      voice_settings: {
        stability: typeof elevenLabsSettings.stability === 'number' && 
          elevenLabsSettings.stability >= 0 && 
          elevenLabsSettings.stability <= 1
          ? elevenLabsSettings.stability 
          : 0.5,

        similarity_boost: typeof elevenLabsSettings.similarityBoost === 'number' && 
          elevenLabsSettings.similarityBoost >= 0 && 
          elevenLabsSettings.similarityBoost <= 1
          ? elevenLabsSettings.similarityBoost
          : 0.75,

        style: typeof elevenLabsSettings.style === 'number' && 
          elevenLabsSettings.style >= 0 && 
          elevenLabsSettings.style <= 1
          ? elevenLabsSettings.style 
          : 0,

        use_speaker_boost: Boolean(elevenLabsSettings.useSpeakerBoost)
      }
    };

    this.logging.info('Making ElevenLabs TTS request', 'ElevenLabs', {
      textLength: payload.text.length,
      modelId: payload.model_id,
      voiceId: settings.voice
    });

    try {
      const response = await fetch(`${this.baseUrl}/text-to-speech/${settings.voice}`, {
        method: 'POST',
        headers: {
          'xi-api-key': settings.apiKey.getValue(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMessage = `ElevenLabs API error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (typeof errorData?.detail?.message === 'string') {
            errorMessage += ` - ${errorData.detail.message}`;
          }
        } catch {
          // If error response isn't JSON, try text
          const errorText = await response.text();
          if (errorText) {
            errorMessage += ` - ${errorText}`;
          }
        }
        throw new Error(errorMessage);
      }

      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer) {
        throw new Error('Received empty response from ElevenLabs API');
      }

      return new Uint8Array(arrayBuffer);

    } catch (error) {
      this.logging.error(
        'ElevenLabs API request failed',
        error instanceof Error ? error : new Error('Unknown error'),
        'ElevenLabs'
      );
      throw error;
    }
  }

  private estimateAudioDuration(audioData: Uint8Array): number {
    // Rough estimation for MP3: assumes 128kbps bitrate
    const bytesPerSecond = 128 * 1024 / 8; // 128kbps in bytes per second
    return audioData.byteLength / bytesPerSecond;
  }
  private updateProviderHealth(): void {
    const status = !this.isValidated() ? 'unconfigured' as const
      : this.successRate() < 80 ? 'unhealthy' as const
      : this.successRate() < 95 ? 'degraded' as const
      : 'healthy' as const;

    const metrics: ProviderHealthMetrics = {
      synthesisCount: this.synthesisCount(),
      errorCount: this.errorCount(),
      successRate: this.successRate(),
      lastCheckTime: this.lastCheckTime(),
      status
    };

    this.providerMonitoring.updateProviderMetrics(ModelProvider.ELEVENLABS, metrics);
  }

  private transformElevenLabsVoices(elevenVoices: unknown): ElevenLabsVoice[] {
    // Initial type guard for array
    if (!Array.isArray(elevenVoices)) {
      this.logging.warn('Expected array for ElevenLabs voices, received different type', 'ElevenLabs');
      return [];
    }

    return elevenVoices
      .filter((voice): voice is Record<string, unknown> => {
        // Type guard for object
        if (typeof voice !== 'object' || voice === null) {
          return false;
        }

        // Required field presence checks
        const requiredFields = [
          'voice_id',
          'name',
          'category',
          'fine_tuning',
          'labels',
          'description',
          'preview_url',
          'available_for_tiers',
          'settings'
        ];

        const hasAllFields = requiredFields.every(field => field in voice);
        if (!hasAllFields) {
          this.logging.warn(`Voice object missing required fields: ${requiredFields.filter(f => !(f in voice)).join(', ')}`, 'ElevenLabs');
          return false;
        }

        // Type verification for nested objects
        const settings = voice['settings'];
        if (typeof settings !== 'object' || settings === null) {
          this.logging.warn('Voice settings is not an object', 'ElevenLabs');
          return false;
        }

        const fineTuning = voice['fine_tuning'];
        if (typeof fineTuning !== 'object' || fineTuning === null) {
          this.logging.warn('Voice fine_tuning is not an object', 'ElevenLabs');
          return false;
        }

        return true;
      })
      .map(voice => {
        // Safe type casting with fallbacks
        const settings = voice['settings'] as Record<string, unknown>;
        return {
          voice_id: String(voice['voice_id']),
          name: String(voice['name']),
          category: String(voice['category']),
          fine_tuning: {
            is_allowed: Boolean((voice['fine_tuning'] as Record<string, unknown>)['is_allowed'])
          },
          labels: voice['labels'] as Record<string, string>,
          description: String(voice['description']),
          preview_url: String(voice['preview_url']),
          available_for_tiers: Array.isArray(voice['available_for_tiers']) 
            ? voice['available_for_tiers'].map(String)
            : [],
          settings: {
            stability: typeof settings['stability'] === 'number' ? settings['stability'] : 0.5,
            similarity_boost: typeof settings['similarity_boost'] === 'number' ? settings['similarity_boost'] : 0.75,
            style: typeof settings['style'] === 'number' ? settings['style'] : 0,
            use_speaker_boost: Boolean(settings['use_speaker_boost'])
          }
        };
      });
  }

  private transformElevenLabsModels(elevenModels: unknown): ElevenLabsModel[] {
    // Initial type guard for array
    if (!Array.isArray(elevenModels)) {
      this.logging.warn('Expected array for ElevenLabs models, received different type', 'ElevenLabs');
      return [];
    }

    return elevenModels
      .filter((model): model is Record<string, unknown> => {
        // Type guard for object
        if (typeof model !== 'object' || model === null) {
          return false;
        }

        // Required field presence and type checks
        const requiredFields: [string, string][] = [
          ['model_id', 'string'],
          ['name', 'string'],
          ['can_be_finetuned', 'boolean'],
          ['can_do_text_to_speech', 'boolean'],
          ['can_do_voice_conversion', 'boolean'],
          ['can_use_style', 'boolean'],
          ['can_use_speaker_boost', 'boolean'],
          ['serves_pro_voices', 'boolean'],
          ['token_cost_factor', 'number'],
          ['description', 'string'],
          ['requires_alpha_access', 'boolean']
        ];

        const hasValidFields = requiredFields.every(([field, type]) => {
          const value = model[field];
          return value !== undefined && typeof value === type;
        });

        if (!hasValidFields) {
          const invalidFields = requiredFields
            .filter(([field, type]) => {
              const value = model[field];
              return value === undefined || typeof value !== type;
            })
            .map(([field]) => field);
          this.logging.warn(`Model object has invalid fields: ${invalidFields.join(', ')}`, 'ElevenLabs');
          return false;
        }

        // Check languages array
        if (!Array.isArray(model['languages'])) {
          this.logging.warn('Model languages is not an array', 'ElevenLabs');
          return false;
        }

        return true;
      })
      .map(model => ({
        model_id: String(model['model_id']),
        name: String(model['name']),
        can_be_finetuned: Boolean(model['can_be_finetuned']),
        can_do_text_to_speech: Boolean(model['can_do_text_to_speech']),
        can_do_voice_conversion: Boolean(model['can_do_voice_conversion']),
        can_use_style: Boolean(model['can_use_style']),
        can_use_speaker_boost: Boolean(model['can_use_speaker_boost']),
        serves_pro_voices: Boolean(model['serves_pro_voices']),
        token_cost_factor: Number(model['token_cost_factor']),
        description: String(model['description']),
        requires_alpha_access: Boolean(model['requires_alpha_access']),
        max_characters_request_free_user: typeof model['max_characters_request_free_user'] === 'number'
          ? model['max_characters_request_free_user'] as number
          : 2500,
        max_characters_request_subscribed_user: typeof model['max_characters_request_subscribed_user'] === 'number'
          ? model['max_characters_request_subscribed_user'] as number
          : 5000,
        maximum_text_length_request: typeof model['maximum_text_length_request'] === 'number'
          ? model['maximum_text_length_request'] as number
          : 2500,
        languages: Array.isArray(model['languages'])
          ? model['languages']
              .filter((lang): lang is Record<string, unknown> =>
                typeof lang === 'object' &&
                lang !== null &&
                typeof lang['language_id'] === 'string' &&
                typeof lang['name'] === 'string'
              )
              .map(lang => ({
                language_id: String(lang['language_id']),
                name: String(lang['name'])
              }))
          : []
      }));
  }
}
