// Google Cloud Text-to-Speech provider implementation
import { Injectable, signal, computed, PLATFORM_ID, inject } from '@angular/core';
import { LoggingService } from '../../../../common/services/logging.service';
import { TTSSettings, TTSResult, ModelProvider, TTSResultStatus } from '../../../../domain/entities/tts.entity';
import { Result } from '../../../../common/value-objects/query/result';
import { QueryId } from '../../../../common/value-objects/query/query-id';
import { ProviderHealthMetrics, ProviderMonitoringService } from '../../../../enactment/monitoring/provider-monitoring.service';
import { ApiKey } from '../../../../common/value-objects/text/api-key';
import { isPlatformBrowser } from '@angular/common';

export interface GoogleVoice {
  languageCodes: string[];
  name: string;
  ssmlGender: 'MALE' | 'FEMALE' | 'NEUTRAL';
  naturalSampleRateHertz: number;
}

export interface GoogleAudioConfig {
  audioEncoding: 'MP3' | 'LINEAR16' | 'OGG_OPUS' | 'MULAW' | 'ALAW';
  speakingRate?: number; // 0.25 to 4.0
  pitch?: number; // -20.0 to 20.0
  volumeGainDb?: number; // -96.0 to 16.0
  sampleRateHertz?: number;
  effectsProfileId?: string[];
}

export interface GoogleSynthesisInput {
  text?: string;
  ssml?: string;
}

export interface GoogleVoiceSelectionParams {
  languageCode: string;
  name?: string;
  ssmlGender?: 'MALE' | 'FEMALE' | 'NEUTRAL';
}

export interface GoogleTTSRequest {
  input: GoogleSynthesisInput;
  voice: GoogleVoiceSelectionParams;
  audioConfig: GoogleAudioConfig;
}

@Injectable({
  providedIn: 'root'
})
export class GoogleTTSService {
  private logging = inject(LoggingService);
  private providerMonitoring = inject(ProviderMonitoringService);
  private platformId = inject(PLATFORM_ID);

  private readonly baseUrl = 'https://texttospeech.googleapis.com/v1';

  // Reactive state with signals
  private cachedVoices = signal<GoogleVoice[] | null>(null);
  private isValidated = signal<boolean>(false);
  private synthesisCount = signal<number>(0);
  private errorCount = signal<number>(0);
  private lastCheckTime = signal<Date>(new Date());
  private healthCheckInterval = signal(60000); // 1 minute
  private readonly initialized = signal(false);

  // Computed reactive properties
  readonly voicesCount = computed(() => this.cachedVoices()?.length || 0);
  
  readonly successRate = computed(() => {
    const total = this.synthesisCount() + this.errorCount();
    return total > 0 ? (this.synthesisCount() / total) * 100 : 0;
  });

  readonly providerHealth = computed(() => {
    const status = this.providerStatus();
    const rate = this.successRate();
      
    if (status === 'degraded') {
      this.logging.warn('Google provider performance degraded', 'Google', {
        successRate: rate,
        totalRequests: this.synthesisCount(),
        errors: this.errorCount()
      });
    }
    
    this.updateProviderHealth();
    
    return {
      status: this.providerStatus(),
      successRate: this.successRate(),
      requestCount: this.synthesisCount()
    };
  });

  readonly providerStatus = computed(() => {
    if (!this.isValidated()) return 'not-validated';
    const rate = this.successRate();
    if (rate >= 95) return 'healthy';
    if (rate >= 80) return 'degraded';
    return 'unhealthy';
  });  constructor() {
    if (!this.initialized() && isPlatformBrowser(this.platformId)) {
      this.initialized.set(true);
      this.logging.info('GoogleTTSService initialized', 'Google');
    }
  }

  // Core TTS functionality
  async synthesizeSpeech(
    text: string,
    settings: TTSSettings,
    queryId: QueryId
  ): Promise<Result<TTSResult, string>> {
    if (!settings.apiKey) {
      return Result.failure('Google Cloud API key is required');
    }

    return this.logging.trackPerformance(
      'googleSynthesize',
      async () => {
        const startTime = Date.now();
        
        this.logging.info('Starting Google synthesis', 'Google', {
          textLength: text.length,
          voice: settings.voice,
          languageCode: this.extractLanguageFromVoice(settings.voice)
        });

        try {
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

          this.logging.info('Google synthesis completed successfully', 'Google', {
            fileSize: audioData.byteLength,
            duration: result.duration,
            processingTime
          });

          return Result.success(result);

        } catch (error) {
          const processingTime = Date.now() - startTime;
          this.errorCount.update(count => count + 1);
          this.updateProviderHealth();

          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          this.logging.error('Google synthesis failed', error as Error, 'Google');

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
      },
      'Google'
    );
  }

  // Voice management
  async getAvailableVoices(apiKey: string): Promise<Result<GoogleVoice[], string>> {
    if (this.cachedVoices()) {
      return Result.success(this.cachedVoices()!);
    }

    return this.logging.trackPerformance(
      'googleGetVoices',
      async () => {
        try {
          const response = await fetch(`${this.baseUrl}/voices?key=${apiKey}`, {
            headers: {
              'Accept': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch voices: ${response.status} ${response.statusText}`);
          }
          
          const data = await response.json();
          if (!data || !Array.isArray(data.voices)) {
            throw new Error('Invalid response format from Google API');
          }          // Type guard to validate top-level response structure
          const isValidResponse = (data: unknown): data is { voices: unknown[] } => {
            return typeof data === 'object' && 
                   data !== null && 
                   Array.isArray((data as Record<string, unknown>)['voices']);
          };

          // Type guard to validate voice data structure
          const isValidGoogleVoice = (v: unknown): v is GoogleVoice => {
            if (typeof v !== 'object' || v === null) return false;
            const voice = v as Record<string, unknown>;
            
            // Validate languageCodes array
            if (!Array.isArray(voice['languageCodes']) || 
                !voice['languageCodes'].every(code => typeof code === 'string')) {
              return false;
            }

            // Validate name
            if (typeof voice['name'] !== 'string') return false;

            // Validate ssmlGender
            if (typeof voice['ssmlGender'] !== 'string' ||
                !['MALE', 'FEMALE', 'NEUTRAL'].includes(voice['ssmlGender'])) {
              return false;
            }

            // Validate naturalSampleRateHertz
            if (typeof voice['naturalSampleRateHertz'] !== 'number') return false;

            return true;
          };

          if (!isValidResponse(data)) {
            throw new Error('Invalid response format from Google TTS API');
          }

          // Filter and transform valid voices
          const voices = data.voices.filter(isValidGoogleVoice);
          this.cachedVoices.set(voices);

          this.logging.info(`Retrieved ${voices.length} Google voices`, 'Google');
          return Result.success(voices);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch voices';
          this.logging.error('Failed to fetch Google voices', error as Error, 'Google');
          return Result.failure(errorMessage);
        }
      },
      'Google'
    );
  }

  // SSML generation
  generateSSML(text: string, options?: {
    speakingRate?: number;
    pitch?: string;
    volume?: string;
    emphasis?: 'strong' | 'moderate' | 'reduced';
    prosody?: {
      rate?: string;
      pitch?: string;
      volume?: string;
    };
  }): string {
    let ssml = '<speak>';

    if (options?.prosody) {
      ssml += '<prosody';
      if (options.prosody.rate) ssml += ` rate="${options.prosody.rate}"`;
      if (options.prosody.pitch) ssml += ` pitch="${options.prosody.pitch}"`;
      if (options.prosody.volume) ssml += ` volume="${options.prosody.volume}"`;
      ssml += '>';
    }

    if (options?.emphasis) {
      ssml += `<emphasis level="${options.emphasis}">`;
    }

    ssml += text;

    if (options?.emphasis) {
      ssml += '</emphasis>';
    }

    if (options?.prosody) {
      ssml += '</prosody>';
    }

    ssml += '</speak>';
    return ssml;
  }

  // Audio effects and customization
  getAudioEffectsProfiles(): string[] {
    return [
      'wearable-class-device',
      'handset-class-device',
      'headphone-class-device',
      'small-bluetooth-speaker-class-device',
      'medium-bluetooth-speaker-class-device',
      'large-home-entertainment-class-device',
      'large-automotive-class-device',
      'telephony-class-application'
    ];
  }

  // Validation and capabilities
  async validateConfiguration(settings: TTSSettings): Promise<Result<boolean, string>> {
    if (!settings.apiKey) {
      this.isValidated.set(false);
      return Result.failure('API key is required');
    }

    // Test API key by fetching voices
    const voicesResult = await this.getAvailableVoices(settings.apiKey.getValue());
    if (voicesResult.isFailure()) {
      this.isValidated.set(false);
      return Result.failure(`Invalid API key: ${voicesResult.getError()}`);
    }

    this.logging.info('Google configuration validated successfully', 'Google');
    this.isValidated.set(true);
    return Result.success(true);
  }

  getCapabilities() {
    return {
      maxTextLength: 5000, // Google Cloud TTS limit
      supportedFormats: ['mp3', 'wav', 'ogg'],
      supportsSSML: true,
      supportsStreaming: false,
      defaultModel: 'Standard', // Google uses voice types instead of models
      defaultVoice: 'en-US-Standard-J',
      requiresApiKey: true,
      supportedLanguages: this.getSupportedLanguages()
    };
  }

  // Language support
  getSupportedLanguages(): string[] {
    return [
      'ar-XA', 'bn-IN', 'bg-BG', 'ca-ES', 'yue-HK', 'cs-CZ', 'da-DK',
      'nl-BE', 'nl-NL', 'en-AU', 'en-IN', 'en-GB', 'en-US', 'et-EE',
      'fi-FI', 'fr-CA', 'fr-FR', 'de-DE', 'el-GR', 'gu-IN', 'he-IL',
      'hi-IN', 'hu-HU', 'is-IS', 'id-ID', 'it-IT', 'ja-JP', 'kn-IN',
      'ko-KR', 'lv-LV', 'lt-LT', 'ms-MY', 'ml-IN', 'cmn-CN', 'cmn-TW',
      'mr-IN', 'nb-NO', 'pl-PL', 'pt-BR', 'pt-PT', 'pa-IN', 'ro-RO',
      'ru-RU', 'sr-RS', 'sk-SK', 'sl-SI', 'es-ES', 'es-MX', 'es-US',
      'sv-SE', 'ta-IN', 'te-IN', 'th-TH', 'tr-TR', 'uk-UA', 'vi-VN'
    ];
  }

  // Voice filtering helpers
  getVoicesByLanguage(voices: GoogleVoice[], languageCode: string): GoogleVoice[] {
    return voices.filter(voice => voice.languageCodes.includes(languageCode));
  }

  getVoicesByGender(voices: GoogleVoice[], gender: 'MALE' | 'FEMALE' | 'NEUTRAL'): GoogleVoice[] {
    return voices.filter(voice => voice.ssmlGender === gender);
  }

  // Clear caches
  clearCache(): void {
    this.cachedVoices.set(null);
    this.logging.info('Google cache cleared', 'Google');
  }

  // Private helper methods
  private extractLanguageFromVoice(voice: string | undefined): string {
    // Handle undefined/null case
    if (!voice) return 'en-US';

    // Extract language code from voice name (e.g., "en-US-Standard-J" -> "en-US")
    const match = voice.match(/^([a-z]{2,3}-[A-Z]{2})/);
    if (!match) {
      this.logging.warn('Invalid voice name format, using default', 'Google', { voice });
      return 'en-US';
    }

    return match[1];
  }

  private async makeTextToSpeechRequest(text: string, settings: TTSSettings): Promise<Uint8Array> {
    // Ensure voice is a valid string
    const voiceName = settings.voice || 'en-US-Standard-J';
    if (typeof voiceName !== 'string') {
      throw new Error('Invalid voice name format');
    }

    const languageCode = this.extractLanguageFromVoice(voiceName);
    const requestBody: GoogleTTSRequest = {
      input: { text },
      voice: {
        languageCode,
        name: voiceName
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0.0,
        volumeGainDb: 0.0
      }
    };

    const response = await fetch(`${this.baseUrl}/text:synthesize?key=${settings.apiKey!.getValue()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Google API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    // Type guard for Google API response
    const isValidGoogleResponse = (resp: unknown): resp is { audioContent: string } => {
      return typeof resp === 'object' && 
             resp !== null && 
             typeof (resp as { audioContent?: unknown }).audioContent === 'string';
    };
    
    if (!isValidGoogleResponse(data)) {
      throw new Error('Invalid response format from Google API');
    }

    // Google returns base64 encoded audio
    const audioData = Uint8Array.from(atob(data.audioContent), (c: string) => c.charCodeAt(0));
    return audioData;
  }
  private updateProviderHealth(): void {
    const status = !this.isValidated() ? "unconfigured" as const
      : this.successRate() < 80 ? "unhealthy" as const
      : this.successRate() < 95 ? "degraded" as const
      : "healthy" as const;

    const metrics: ProviderHealthMetrics = {
      synthesisCount: this.synthesisCount(),
      errorCount: this.errorCount(),
      successRate: this.successRate(),
      lastCheckTime: this.lastCheckTime(),
      status
    };

    this.providerMonitoring.updateProviderMetrics(ModelProvider.GOOGLE, metrics);
  }

  private estimateAudioDuration(audioData: Uint8Array): number {
    // Rough estimation for MP3: assumes 64kbps bitrate (Google default)
    const bytesPerSecond = 64 * 1024 / 8; // 64kbps in bytes per second
    return Math.round(audioData.byteLength / bytesPerSecond);
  }

  private isValidTTSSettings(settings: unknown): settings is TTSSettings {
    if (!settings || typeof settings !== 'object') return false;
    const s = settings as Record<string, unknown>;
    return (
      typeof s['provider'] === 'string' &&
      typeof s['model'] === 'string' &&
      typeof s['voice'] === 'string' &&
      (!s['apiKey'] || s['apiKey'] instanceof ApiKey)
    );
  }
}
