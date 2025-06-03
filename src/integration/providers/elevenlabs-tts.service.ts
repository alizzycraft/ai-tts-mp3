// ElevenLabs TTS provider implementation
import { Injectable, signal, computed, effect } from '@angular/core';
import { LoggingService } from '../logging.service';
import { MonitoringService } from '../monitoring.service';
import { TTSSettings, TTSResult, QueryId, ModelProvider, TTSResultStatus } from '../../domain/tts.entity';
import { Result } from '../../common/result';

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
  sharing: {
    status: string;
    history_item_sample_id: string | null;
    original_voice_id: string | null;
    public_owner_id: string | null;
    liked_by_count: number;
    cloned_by_count: number;
    name: string;
    description: string;
    labels: Record<string, string>;
    created_at: string;
    enable_responses: boolean;
  };
  high_quality_base_model_ids: string[];
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

@Injectable({
  providedIn: 'root'
})
export class ElevenLabsTTSService {
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

  // Computed reactive properties
  readonly voicesCount = computed(() => this.cachedVoices().length);
  readonly modelsCount = computed(() => this.cachedModels().length);
  readonly successRate = computed(() => {
    const total = this.synthesisCount() + this.errorCount();
    return total > 0 ? (this.synthesisCount() / total) * 100 : 0;
  });
  readonly providerStatus = computed(() => {
    if (!this.isValidated()) return 'not-validated';
    if (this.errorCount() > this.synthesisCount()) return 'degraded';
    return 'healthy';
  });

  constructor(
    private logging: LoggingService,
    private monitoring: MonitoringService
  ) {
    this.logging.info('ElevenLabsTTSService initialized', 'ElevenLabs');

    // Effects for reactive behaviors
    effect(() => {
      // Auto-cleanup expired caches
      const now = new Date();
      if (this.voicesCacheExpiry() && now > this.voicesCacheExpiry()!) {
        this.cachedVoices.set([]);
        this.voicesCacheExpiry.set(null);
        this.logging.info('ElevenLabs voices cache expired and cleared', 'ElevenLabs');
      }
      if (this.modelsCacheExpiry() && now > this.modelsCacheExpiry()!) {
        this.cachedModels.set([]);
        this.modelsCacheExpiry.set(null);
        this.logging.info('ElevenLabs models cache expired and cleared', 'ElevenLabs');
      }
    });

    effect(() => {
      // Monitor provider health
      const status = this.providerStatus();
      if (status === 'degraded') {
        this.logging.warn(`ElevenLabs provider status: ${status}`, 'ElevenLabs', {
          synthesisCount: this.synthesisCount(),
          errorCount: this.errorCount(),
          successRate: this.successRate()
        });
      }
    });
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
          const audioData = await this.makeTextToSpeechRequest(text, settings);
          const processingTime = Date.now() - startTime;

          this.monitoring.recordRequest('elevenlabs_synthesis', processingTime, true, ModelProvider.ELEVENLABS);
          this.synthesisCount.update(count => count + 1);          const result: TTSResult = {
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
          this.monitoring.recordRequest('elevenlabs_synthesis', processingTime, false, ModelProvider.ELEVENLABS);
          this.errorCount.update(count => count + 1);

          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          this.logging.error('ElevenLabs synthesis failed', error as Error, 'ElevenLabs');          const result: TTSResult = {
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
      },
      'ElevenLabs'
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
        try {          const response = await fetch(`${this.baseUrl}/voices`, {
            headers: {
              'xi-api-key': apiKey,
              'Accept': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch voices: ${response.status} ${response.statusText}`);
          }          const data = await response.json();
          this.cachedVoices.set(data.voices || []);
          this.voicesCacheExpiry.set(new Date(Date.now() + this.cacheExpiryTime));

          this.logging.info(`Retrieved ${this.cachedVoices().length} ElevenLabs voices`, 'ElevenLabs');
          return Result.success(this.cachedVoices());

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch voices';
          this.logging.error('Failed to fetch ElevenLabs voices', error as Error, 'ElevenLabs');
          return Result.failure(errorMessage);
        }
      },
      'ElevenLabs'
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
        try {          const response = await fetch(`${this.baseUrl}/models`, {
            headers: {
              'xi-api-key': apiKey,
              'Accept': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
          }          const data = await response.json();
          this.cachedModels.set(data || []);
          this.modelsCacheExpiry.set(new Date(Date.now() + this.cacheExpiryTime));

          this.logging.info(`Retrieved ${this.cachedModels().length} ElevenLabs models`, 'ElevenLabs');
          return Result.success(this.cachedModels());

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch models';
          this.logging.error('Failed to fetch ElevenLabs models', error as Error, 'ElevenLabs');
          return Result.failure(errorMessage);
        }
      },
      'ElevenLabs'
    );
  }
  // Quota and subscription info
  async getSubscriptionInfo(apiKey: string): Promise<Result<unknown, string>> {
    return this.logging.trackPerformance(
      'elevenLabsSubscriptionInfo',
      async () => {
        try {          const response = await fetch(`${this.baseUrl}/user/subscription`, {
            headers: {
              'xi-api-key': apiKey,
              'Accept': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch subscription info: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          this.logging.info('Retrieved ElevenLabs subscription info', 'ElevenLabs');
          return Result.success(data);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch subscription info';
          this.logging.error('Failed to fetch ElevenLabs subscription info', error as Error, 'ElevenLabs');
          return Result.failure(errorMessage);
        }
      },
      'ElevenLabs'
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
      return Result.success(true);

    } catch (error) {
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
  }  // Clear caches
  clearCache(): void {
    this.cachedVoices.set([]);
    this.cachedModels.set([]);
    this.voicesCacheExpiry.set(null);
    this.modelsCacheExpiry.set(null);
    this.logging.info('ElevenLabs cache cleared', 'ElevenLabs');
  }

  // Private helper methods
  private async makeTextToSpeechRequest(text: string, settings: TTSSettings): Promise<Uint8Array> {
    const voiceId = settings.voice || 'Rachel';
    const modelId = settings.model || 'eleven_monolingual_v1';

    const requestBody = {
      text,
      model_id: modelId,
      voice_settings: {
        stability: 0.75,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true
      }
    };

    const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': settings.apiKey!.getValue(),
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  private estimateAudioDuration(audioData: Uint8Array): number {
    // Rough estimation for MP3: assumes 128kbps bitrate
    const bytesPerSecond = 128 * 1024 / 8; // 128kbps in bytes per second
    return audioData.byteLength / bytesPerSecond;
  }
}
