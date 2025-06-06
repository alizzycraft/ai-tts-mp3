// AWS Polly TTS provider implementation
import { Injectable, signal, computed, PLATFORM_ID, inject } from '@angular/core';
import { LoggingService } from '../logging.service';
import { TTSSettings, TTSResult, QueryId, ModelProvider, TTSResultStatus } from '../../domain/entities/tts.entity';
import { Result } from '../../common/value-objects/query/result';
import { ApiKey } from '../../common/value-objects/text/api-key';
import { ProviderHealthMetrics, ProviderMonitoringService } from '../monitoring/provider-monitoring.service';
import { isPlatformBrowser } from '@angular/common';

export interface AWSVoice {
  id: string;
  name: string;
  languageCode: string;
  languageName: string;
  gender: 'Male' | 'Female';
  engine: 'standard' | 'neural';
  supportedEngines: ('standard' | 'neural')[];
  additionalLanguageCodes?: string[];
}

export interface AWSPollySettings extends Omit<TTSSettings, 'apiKey'> {
  apiKey?: ApiKey;
  secretKey?: ApiKey;
  region?: string;
  customEndpoint?: string;
}

export interface AWSPollyRequest {
  text: string;
  voiceId: string;
  outputFormat: 'mp3' | 'ogg_vorbis' | 'pcm';
  engine: 'standard' | 'neural';
  languageCode?: string;
  sampleRate?: string;
  textType?: 'text' | 'ssml';
  speechMarkTypes?: string[];
}

export interface AWSSSMLOptions {
  rate?: string; // x-slow, slow, medium, fast, x-fast, or percentage
  pitch?: string; // x-low, low, medium, high, x-high, or percentage  
  volume?: string; // silent, x-soft, soft, medium, loud, x-loud, or percentage
  emphasis?: 'strong' | 'moderate' | 'reduced';
  prosody?: {
    rate?: string;
    pitch?: string;
    volume?: string;
  };
  breakTime?: string; // pause duration (e.g., "1s", "500ms")
}

@Injectable({
  providedIn: 'root'
})
export class AWSPollyTTSService {
  private logging = inject(LoggingService);
  private providerMonitoring = inject(ProviderMonitoringService);
  private platformId = inject(PLATFORM_ID);

  private readonly baseUrl = 'https://polly.{{region}}.amazonaws.com';
  
  // Reactive signals for state management
  private cachedVoices = signal<AWSVoice[] | null>(null);
  private cachedCredentials = signal<{ accessKeyId: string; secretAccessKey: string; sessionToken?: string } | null>(null);
  private isValidated = signal(false);
  private synthesisCount = signal(0);
  private errorCount = signal(0);
  private lastCheckTime = signal<Date>(new Date());
  private initialized = signal(false);
  
  // Computed signals for reactive analytics
  readonly voicesCount = computed(() => this.cachedVoices()?.length ?? 0);
  readonly successRate = computed(() => {
    const total = this.synthesisCount();
    const errors = this.errorCount();
    return total > 0 ? ((total - errors) / total) * 100 : 0;
  });

  readonly cacheStatus = computed(() => {
    const voices = this.cachedVoices();
    const credentials = this.cachedCredentials();
    return {
      hasVoices: !!voices,
      hasCredentials: !!credentials,
      voicesCount: voices?.length ?? 0
    };
  });

  readonly healthMetrics = computed(() => ({
    totalRequests: this.synthesisCount(),
    errorCount: this.errorCount(),
    successRate: this.successRate(),
    lastCheckTime: this.lastCheckTime(),
    voicesAvailable: this.voicesCount()
  }));

  readonly providerStatus = computed(() => {
    if (!this.isValidated()) return 'unconfigured';
    
    const rate = this.successRate();
    const status = rate >= 95 ? 'healthy' : rate >= 80 ? 'degraded' : 'unhealthy';
    
    if (status !== 'healthy') {
      this.logging.warn(`AWS Polly provider status: ${status}`, 'AWS', {
        successRate: rate,
        totalRequests: this.synthesisCount(),
        errors: this.errorCount(),
        lastCheck: this.lastCheckTime()
      });
    }
    
    this.updateProviderHealth();
    return status;
  });
  constructor() {
    if (!this.initialized() && isPlatformBrowser(this.platformId)) {
      this.initialized.set(true);
      this.logging.info('AWSPollyTTSService initialized', 'AWS');
    }
  }
  // Core TTS functionality
  async synthesizeSpeech(
    text: string,
    settings: AWSPollySettings,
    queryId: QueryId
  ): Promise<Result<TTSResult, string>> {
    if (!settings.apiKey) {
      return Result.failure('AWS Polly API key is required');
    }

    if (!settings.secretKey) {
      return Result.failure('AWS Polly secret key is required');
    }

    const region = settings.region || 'us-east-1';

    return this.logging.trackPerformance(
      'awsPollySynthesize',
      async () => {
        const startTime = Date.now();
        
        this.logging.info('Starting AWS Polly synthesis', 'AWS', {
          textLength: text.length,
          voice: settings.voice,
          region
        });

        try {
          const audioData = await this.makeTextToSpeechRequest(text, settings, region);
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

          this.logging.info('AWS Polly synthesis completed successfully', 'AWS', {
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
          this.logging.error('AWS Polly synthesis failed', error as Error, 'AWS');

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
      'AWS'
    );
  }

  // Voice management
  async getAvailableVoices(
    accessKeyId: string,
    secretAccessKey: string,
    region: string
  ): Promise<Result<AWSVoice[], string>> {
    const cacheStatus = this.cacheStatus();
    if (cacheStatus.hasVoices) {
      return Result.success(this.cachedVoices()!);
    }

    return this.logging.trackPerformance(
      'awsPollyGetVoices',
      async () => {
        try {
          const credentials = await this.getAWSCredentials(accessKeyId, secretAccessKey);
          if (credentials.isFailure()) {
            return Result.failure(credentials.getError());
          }

          const url = this.baseUrl.replace('{{region}}', region);
          const response = await this.makeAWSRequest(
            `${url}/v1/voices`,
            'GET',
            credentials.getValue(),
            region
          );

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch voices: ${response.status} ${response.statusText} - ${errorText}`);
          }

          const data = await response.json();          if (!data || !Array.isArray(data.Voices)) {
            throw new Error('Invalid response format from AWS Polly API');
          }

          const voices = this.transformPollyVoices(data.Voices as unknown[]);
          this.cachedVoices.set(voices);

          this.logging.info(`Retrieved ${voices.length} AWS Polly voices`, 'AWS');
          return Result.success(voices);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch voices';
          this.logging.error('Failed to fetch AWS Polly voices', error as Error, 'AWS');
          return Result.failure(errorMessage);
        }
      },
      'AWS'
    );
  }

  // SSML generation for AWS Polly
  generateSSML(text: string, options?: AWSSSMLOptions): string {
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

    if (options?.breakTime) {
      ssml += `<break time="${options.breakTime}"/>`;
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
  // Validation and capabilities
  async validateConfiguration(settings: AWSPollySettings): Promise<Result<boolean, string>> {
    if (!settings.apiKey || !settings.secretKey) {
      this.isValidated.set(false);
      return Result.failure('AWS credentials are required');
    }

    const region = this.extractRegionFromSettings(settings) || 'us-east-1';
    
    try {
      // Test credentials by fetching voices
      const voicesResult = await this.getAvailableVoices(
        settings.apiKey.getValue(),
        settings.secretKey.getValue(),
        region
      );

      if (voicesResult.isFailure()) {      this.isValidated.set(false);
      this.updateProviderHealth(); // Update metrics after failed validation
      return Result.failure(`Invalid AWS credentials or region: ${voicesResult.getError()}`);
    }

      this.isValidated.set(true);
      this.updateProviderHealth(); // Update metrics after successful validation
      this.logging.info('AWS Polly configuration validated successfully', 'AWS');
      return Result.success(true);

    } catch (error) {
      this.isValidated.set(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return Result.failure(`AWS Polly configuration validation failed: ${errorMessage}`);
    }
  }

  getCapabilities() {
    return {
      maxTextLength: 3000, // AWS Polly limit for standard voices
      supportedFormats: ['mp3', 'ogg_vorbis', 'pcm'],
      supportsSSML: true,
      supportsStreaming: false,
      supportsSpeechMarks: true,
      defaultEngine: 'neural',
      defaultVoice: 'Joanna',
      requiresAccessKey: true,
      requiresSecretKey: true,
      requiresRegion: true,
      supportedEngines: ['standard', 'neural']
    };
  }

  // Supported regions
  getSupportedRegions(): string[] {
    return [
      'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
      'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
      'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
      'ca-central-1', 'sa-east-1'
    ];
  }

  // Engine and voice utilities
  getSupportedEngines(): ('standard' | 'neural')[] {
    return ['standard', 'neural'];
  }

  getVoicesByEngine(voices: AWSVoice[], engine: 'standard' | 'neural'): AWSVoice[] {
    return voices.filter(voice => voice.supportedEngines.includes(engine));
  }

  getVoicesByLanguage(voices: AWSVoice[], languageCode: string): AWSVoice[] {
    return voices.filter(voice => 
      voice.languageCode === languageCode || 
      (voice.additionalLanguageCodes && voice.additionalLanguageCodes.includes(languageCode))
    );
  }
  // Clear caches and reset state
  clearCache(): void {
    this.cachedVoices.set(null);
    this.cachedCredentials.set(null);
    this.logging.info('AWS Polly cache cleared', 'AWS');
  }
  // Private helper methods
  private async makeTextToSpeechRequest(
    text: string, 
    settings: AWSPollySettings, 
    region: string
  ): Promise<Uint8Array> {
    const credentials = await this.getAWSCredentials(
      settings.apiKey!.getValue(), 
      settings.secretKey!.getValue()
    );
    
    if (credentials.isFailure()) {
      throw new Error(`Failed to get AWS credentials: ${credentials.getError()}`);
    }

    const voice = settings.voice || 'Joanna';
    const engine = this.getEngineFromVoice(voice);
    const outputFormat = 'mp3';
    
    // Check if text needs SSML processing
    const isSSML = text.trim().startsWith('<speak>');
    const requestBody: AWSPollyRequest = {
      text: isSSML ? text : this.generateSSML(text),
      voiceId: voice,
      outputFormat,
      engine,
      textType: isSSML ? 'ssml' : 'text',
      sampleRate: '22050'
    };

    const url = this.baseUrl.replace('{{region}}', region);
    const response = await this.makeAWSRequest(
      `${url}/v1/speech`,
      'POST',
      credentials.getValue(),
      region,
      requestBody
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AWS Polly API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  private async getAWSCredentials(
    accessKeyId: string, 
    secretAccessKey: string
  ): Promise<Result<{ accessKeyId: string; secretAccessKey: string }, string>> {
    // For simplicity, we're just validating the presence of credentials
    // In a production environment, you might want to validate these with AWS STS
    if (!accessKeyId || !secretAccessKey) {
      return Result.failure('AWS credentials are incomplete');
    }

    return Result.success({ accessKeyId, secretAccessKey });
  }

  private async makeAWSRequest(
    url: string,
    method: string,
    credentials: { accessKeyId: string; secretAccessKey: string },    region: string,
    body?: unknown
  ): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-amz-json-1.0',
      'X-Amz-Target': method === 'POST' ? 'AWSPollyService.SynthesizeSpeech' : 'AWSPollyService.DescribeVoices',
      'User-Agent': 'ai-tts-mp3'
    };

    // Note: In a real implementation, you would need to implement AWS Signature Version 4
    // For this example, we'll use a simplified approach
    // In production, consider using AWS SDK for JavaScript
    headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/...`;

    return fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  }  private transformPollyVoices(awsVoices: unknown[]): AWSVoice[] {
    return awsVoices
      .filter((voice): voice is Record<string, unknown> => (
        typeof voice === 'object' && 
        voice !== null
      ))
      .filter(voice => (
        typeof voice['Id'] === 'string' &&
        typeof voice['Name'] === 'string' &&
        typeof voice['LanguageCode'] === 'string' &&
        typeof voice['LanguageName'] === 'string' &&
        (voice['Gender'] === 'Male' || voice['Gender'] === 'Female') &&
        (voice['SupportedEngines'] === undefined || 
          (Array.isArray(voice['SupportedEngines']) && 
           voice['SupportedEngines'].every(engine => 
             engine === 'standard' || engine === 'neural'
           ))) &&
        (voice['AdditionalLanguageCodes'] === undefined || Array.isArray(voice['AdditionalLanguageCodes']))
      ))
      .map(voice => ({
        id: voice['Id'] as string,
        name: voice['Name'] as string,
        languageCode: voice['LanguageCode'] as string,
        languageName: voice['LanguageName'] as string,
        gender: voice['Gender'] as 'Male' | 'Female',
        engine: (voice['Engine'] as string === 'neural' ? 'neural' : 'standard'),
        supportedEngines: (voice['SupportedEngines'] as string[])?.map(
          engine => engine === 'neural' ? 'neural' : 'standard'
        ) ?? ['standard'],
        additionalLanguageCodes: voice['AdditionalLanguageCodes'] as string[] | undefined
      }));
  }
  private extractRegionFromSettings(settings: AWSPollySettings): string | null {
    // Try to extract region from custom endpoint
    if (settings.customEndpoint) {
      const match = settings.customEndpoint.match(/polly\.([^.]+)\.amazonaws\.com/);
      if (match) {
        return match[1];
      }
    }

    // Try to extract from voice name or other settings
    // For AWS, region is typically specified separately
    return settings.region || null;
  }

  private getEngineFromVoice(voice?: string): 'standard' | 'neural' {
    // Define neural voices (this would typically come from AWS API)
    const neuralVoices = [
      'Ivy', 'Joanna', 'Kendra', 'Kimberly', 'Salli', 'Joey', 'Justin', 'Kevin', 'Matthew',
      'Amy', 'Emma', 'Brian', 'Olivia', 'Aria', 'Ayanda', 'Gabrielle', 'Burbank'
    ];

    if (voice && neuralVoices.includes(voice)) {
      return 'neural';
    }

    return 'standard';
  }

  private estimateAudioDuration(audioData: Uint8Array): number {
    // Rough estimation for MP3: assumes variable bitrate around 64kbps
    const bytesPerSecond = 64 * 1024 / 8; // 64kbps in bytes per second
    return audioData.byteLength / bytesPerSecond;
  }

  // Private helper methods
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

    this.providerMonitoring.updateProviderMetrics(ModelProvider.AWS, metrics);
  }
}
