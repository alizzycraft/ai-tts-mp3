import { Injectable, signal, computed, PLATFORM_ID, inject } from "@angular/core";
import { LoggingService } from "../logging.service";
import { TTSSettings, TTSResult, QueryId, ModelProvider, TTSResultStatus } from "../../domain/entities/tts.entity";
import { Result } from "../../common/value-objects/query/result";
import { ProviderHealthMetrics, ProviderMonitoringService } from "../monitoring/provider-monitoring.service";
import { TTSProvider } from "./tts-provider.factory";
import { isPlatformBrowser } from "@angular/common";

interface AzureSettings extends TTSSettings {
  region?: string;
  subscriptionKey?: string;
  resourceKey?: string;
  customEndpoint?: string;
}

export interface AzureVoice {
  name: string;
  displayName: string;
  localName: string;
  shortName: string;
  gender: "Male" | "Female";
  locale: string;
  localeName: string;
  sampleRateHertz: string;
  voiceType: "Standard" | "Neural";
  status: string;
  wordCount?: number;
  characterCount?: number;
  styleList?: string[];
  secondaryLocales?: string[];
}

export interface AzureSSMLOptions {
  rate?: string; // x-slow, slow, medium, fast, x-fast, or percentage
  pitch?: string; // x-low, low, medium, high, x-high, or percentage
  volume?: string; // silent, x-soft, soft, medium, loud, x-loud, or percentage
  emphasis?: "strong" | "moderate" | "reduced";
  prosody?: {
    rate?: string;
    pitch?: string;
    volume?: string;
    contour?: string;
  };
}

@Injectable({
  providedIn: "root"
})
export class AzureTTSService implements TTSProvider {
  private logging = inject(LoggingService);
  private providerMonitoring = inject(ProviderMonitoringService);
  private platformId = inject(PLATFORM_ID);

  private readonly tokenUrl = "https://{{region}}.api.cognitive.microsoft.com/sts/v1.0/issueToken";
  private readonly ttsUrl = "https://{{region}}.tts.speech.microsoft.com/cognitiveservices/v1";
  private readonly voicesUrl = "https://{{region}}.tts.speech.microsoft.com/cognitiveservices/voices/list";
  
  // Reactive signals for state management
  private cachedVoices = signal<AzureVoice[] | null>(null);
  private cachedToken = signal<{ token: string; expiresAt: number; region: string } | null>(null);
  private isValidated = signal(false);
  private synthesisCount = signal(0);
  private errorCount = signal(0);
  private lastCheckTime = signal<Date>(new Date());
  private healthCheckInterval = signal(60000); // 1 minute
  private readonly initialized = signal(false);
  
  // Computed signals for reactive analytics
  readonly voicesCount = computed(() => this.cachedVoices()?.length ?? 0);
  readonly successRate = computed(() => {
    const total = this.synthesisCount();
    const errors = this.errorCount();
    return total > 0 ? ((total - errors) / total) * 100 : 0;
  });
  readonly providerHealth = computed(() => {
    return {
      status: this.providerStatus(),
      successRate: this.successRate(),
      requestCount: this.synthesisCount()
    };
  });
  readonly providerStatus = computed(() => {
    const status = !this.isValidated() ? "unconfigured"
      : this.errorCount() > this.synthesisCount() * 0.5 ? "degraded"
      : "healthy";

    if (status === "degraded") {
      this.logging.warn(`Azure provider status: ${status}`, "Azure", {
        synthesisCount: this.synthesisCount(),
        errorCount: this.errorCount(),
        successRate: this.successRate()
      });
    }

    this.updateProviderHealth();
    return status;
  });

  readonly tokenStatus = computed(() => {
    const tokenData = this.cachedToken();
    if (!tokenData) return { isValid: false, timeToExpiry: 0 };
    
    const now = Date.now();
    const isValid = now < tokenData.expiresAt;
    const timeToExpiry = Math.max(0, tokenData.expiresAt - now);
    
    return { isValid, timeToExpiry };
  });

  constructor() {
    if (!this.initialized() && isPlatformBrowser(this.platformId)) {
      this.initialized.set(true);
      this.logging.info("AzureTTSService initialized", "Azure");
    }
  }

  // Core TTS functionality
  async synthesizeSpeech(
    text: string,
    settings: AzureSettings,
    queryId: QueryId
  ): Promise<Result<TTSResult, string>> {
    if (!settings.apiKey) {
      return Result.failure("Azure API key is required");
    }

    return this.logging.trackPerformance(
      "azureSynthesize",
      async () => {
        const startTime = Date.now();
        
        this.logging.info("Starting Azure synthesis", "Azure", {
          textLength: text.length,
          voice: settings.voice,
          apiRegion: settings.region
        });

        try {
          // Generate SSML
          const ssml = await this.generateSSML(text, settings);

          // Get access token
          const tokenResult = await this.getAccessToken(settings);
          if (tokenResult.isFailure()) {
            throw new Error(tokenResult.getError());
          }

          // Make TTS request
          const audioData = await this.makeTextToSpeechRequest(ssml, settings);
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

          this.logging.info("Azure synthesis completed successfully", "Azure", {
            fileSize: audioData.byteLength,
            duration: result.duration,
            processingTime
          });

          return Result.success(result);

        } catch (error) {
          const processingTime = Date.now() - startTime;
          this.errorCount.update(count => count + 1);
          this.updateProviderHealth();

          const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
          this.logging.error("Azure synthesis failed", error as Error, "Azure");

          const result: TTSResult = {
            queryId,
            status: TTSResultStatus.FAILED,
            createdAt: new Date(),
            updatedAt: new Date(),
            error: {
              code: "SYNTHESIS_ERROR",
              message: errorMessage,
              details: error
            },
            processingTime
          };

          return Result.success(result);
        }
      },
      "Azure"
    );
  }

  // Voice management
  async getAvailableVoices(settings: AzureSettings): Promise<Result<AzureVoice[], string>> {
    const cachedVoicesValue = this.cachedVoices();
    if (cachedVoicesValue) {
      return Result.success(cachedVoicesValue);
    }

    return this.logging.trackPerformance(
      "azureGetVoices",
      async () => {
        try {
          const token = await this.getAccessToken(settings);
          
          if (token.isFailure()) {
            return Result.failure(token.getError());
          }

          const url = this.voicesUrl.replace("{{region}}", settings.region || "eastus");
          const response = await fetch(url, {
            headers: {
              "Authorization": `Bearer ${token.getValue()}`,
              "Accept": "application/json"
            }
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch voices: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          const voices = this.transformAzureVoices(data);
          if (!voices) {
            throw new Error('Invalid voice data received from Azure');
          }
          this.cachedVoices.set(voices);

          this.logging.info(`Retrieved ${voices.length} Azure voices`, "Azure");
          return Result.success(voices);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to fetch voices";
          this.logging.error("Failed to fetch Azure voices", error as Error, "Azure");
          return Result.failure(errorMessage);
        }
      },
      "Azure"
    );
  }

  // Validation and capabilities
  async validateConfiguration(settings: AzureSettings): Promise<Result<boolean, string>> {
    try {
      this.logging.info('Validating Azure configuration', 'Azure');

      if (!settings.apiKey?.getValue()) {
        this.isValidated.set(false);
        return Result.failure('Azure API key is required');
      }

      if (!settings.region) {
        this.isValidated.set(false);
        return Result.failure('Azure region is required');
      }

      // Test credentials by fetching access token
      const tokenResult = await this.getAccessToken(settings);
      if (tokenResult.isFailure()) {
        this.isValidated.set(false);
        this.updateProviderHealth();
        return Result.failure(`Invalid Azure credentials: ${tokenResult.getError()}`);
      }

      this.isValidated.set(true);
      this.updateProviderHealth();
      this.logging.info('Azure configuration validated successfully', 'Azure');
      return Result.success(true);

    } catch (error) {
      this.isValidated.set(false);
      this.updateProviderHealth();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logging.error('Azure configuration validation failed', error as Error, 'Azure');
      return Result.failure(`Configuration validation error: ${errorMessage}`);
    }
  }

  getCapabilities() {
    return {
      maxTextLength: 1000, // Azure TTS character limit
      supportedFormats: ['mp3', 'wav', 'webm', 'ogg'],
      supportsSSML: true,
      supportsStreaming: true,
      defaultModel: 'tts',
      defaultVoice: 'en-US-AriaNeural',
      requiresApiKey: true,
      requiresRegion: true,
      features: {
        customVoices: false,
        voiceCloning: false,
        emotionalTones: true,
        languageDetection: true,
        ssmlSupport: true
      }
    };
  }

  // Private helper methods
  private async getAccessToken(settings: AzureSettings): Promise<Result<string, string>> {
    if (!settings.apiKey || !settings.region) {
      return Result.failure("API key and region are required");
    }

    // Check computed token status for the given region
    const status = this.tokenStatus();
    const tokenData = this.cachedToken();
    
    if (status.isValid && tokenData && tokenData.region === settings.region) {
      return Result.success(tokenData.token);
    }

    try {
      const url = this.tokenUrl.replace("{{region}}", settings.region);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": settings.apiKey.getValue()
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`);
      }

      const token = await response.text();
      this.cachedToken.set({
        token,
        region: settings.region,
        expiresAt: Date.now() + 9 * 60 * 1000 // Token expires in 10 minutes, refresh after 9
      });

      return Result.success(token);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to get access token";
      this.logging.error("Failed to get Azure access token", error as Error, "Azure");
      return Result.failure(errorMessage);
    }
  }

  private async generateSSML(text: string, settings: AzureSettings): Promise<string> {
    const voice = settings.voice || "en-US-JennyNeural";
    let ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">`;
    ssml += `<voice name="${voice}">`;
    ssml += text;
    ssml += "</voice>";
    ssml += "</speak>";
    return ssml;
  }

  private async makeTextToSpeechRequest(
    ssml: string,
    settings: AzureSettings
  ): Promise<Uint8Array> {
    const token = await this.getAccessToken(settings);
    if (token.isFailure()) {
      throw new Error(token.getError());
    }

    const url = this.ttsUrl.replace("{{region}}", settings.region || "eastus");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token.getValue()}`,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3"  
      },
      body: ssml
    });

    if (!response.ok) {
      throw new Error(`TTS request failed: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  private estimateAudioDuration(audioData: Uint8Array): number {
    // Rough estimation for MP3: assumes 48kbps bitrate (Azure default)
    const bytesPerSecond = 48 * 1024 / 8; // 48kbps in bytes per second
    return Math.round(audioData.byteLength / bytesPerSecond);
  }
  private updateProviderHealth(): void {
    const metrics: ProviderHealthMetrics = {
      status: this.providerStatus(),
      synthesisCount: this.synthesisCount(),
      errorCount: this.errorCount(),
      successRate: this.successRate(),
      lastCheckTime: this.lastCheckTime()
    };

    this.providerMonitoring.updateProviderMetrics(ModelProvider.AZURE, metrics);
  }

  clearCache(): void {
    this.cachedVoices.set(null);
    this.cachedToken.set(null);
    this.logging.info("Azure cache cleared", "Azure");
  }

  private transformAzureVoices(azureVoices: unknown): AzureVoice[] | null {
    if (!Array.isArray(azureVoices)) return null;

    return azureVoices
      .filter((voice): voice is Record<string, unknown> => (
        typeof voice === 'object' && 
        voice !== null
      ))
      .filter(voice => (
        typeof voice['Name'] === 'string' &&
        typeof voice['DisplayName'] === 'string' &&
        typeof voice['LocalName'] === 'string' &&
        typeof voice['ShortName'] === 'string' &&
        typeof voice['Gender'] === 'string' &&
        (voice['Gender'] === 'Male' || voice['Gender'] === 'Female') &&
        typeof voice['Locale'] === 'string' &&
        typeof voice['LocaleName'] === 'string' &&
        typeof voice['SampleRateHertz'] === 'string' &&
        typeof voice['Status'] === 'string'
      ))
      .map(voice => ({
        name: voice['Name'] as string,
        displayName: voice['DisplayName'] as string,
        localName: voice['LocalName'] as string,
        shortName: voice['ShortName'] as string,
        gender: voice['Gender'] as 'Male' | 'Female',
        locale: voice['Locale'] as string,
        localeName: voice['LocaleName'] as string,
        sampleRateHertz: voice['SampleRateHertz'] as string,
        voiceType: ((voice['VoiceType'] as string)?.toLowerCase() === 'neural' ? 'Neural' : 'Standard'),
        status: voice['Status'] as string,
        wordCount: voice['WordsPerMinute'] as number | undefined,
        characterCount: voice['CharactersPerMinute'] as number | undefined,
        styleList: Array.isArray(voice['StyleList']) ? voice['StyleList'] as string[] : undefined,
        secondaryLocales: Array.isArray(voice['SecondaryLocales']) ? voice['SecondaryLocales'] as string[] : undefined
      }));
  }
}