/**
 * ElevenLabs TTS Provider Implementation
 * Implements the ITTSProvider interface for ElevenLabs text-to-speech API
 * Uses signal-based reactive patterns with httpResource and follows onion architecture principles
 */

import { Injectable, signal, Signal, computed } from '@angular/core';
import { httpResource, HttpResourceRequest } from '@angular/common/http';
import { Result, success, failure } from '../../../common/result';
import { Logger } from '../../../common/utils';
import { TTSQuery, Voice } from '../../../domain/tts.entity';
import { ITTSProvider, TTSResponse, TTSProviderStatus } from '../interfaces/tts-provider.interface';

@Injectable({
  providedIn: 'root'
})
export class ElevenLabsTTSProvider implements ITTSProvider {
  public readonly name = 'ElevenLabs';
  private readonly _apiKey = signal<string>('');
  
  // Signal-based state management
  private readonly _status = signal<TTSProviderStatus>({
    isAvailable: false,
    lastError: undefined,
    responseTime: undefined
  });
  
  // Signal for TTS request configuration
  private readonly _ttsRequest = signal<HttpResourceRequest | undefined>(undefined);
  
  // Signal for availability check request configuration
  private readonly _availabilityRequest = signal<HttpResourceRequest | undefined>(undefined);
  
  public readonly status: Signal<TTSProviderStatus> = this._status.asReadonly();
  
  // HTTP Resource for TTS generation using httpResource.arrayBuffer for binary data
  private readonly ttsResource = httpResource.arrayBuffer(() => this._ttsRequest());
  
  // HTTP Resource for availability check
  private readonly availabilityResource = httpResource(() => this._availabilityRequest());
  
  // Default ElevenLabs voice IDs
  private readonly voiceMap = new Map<Voice, string>([
    [Voice.ALLOY, 'ErXwobaYiN019PkySvjV'], // Antoni
    [Voice.ECHO, 'VR6AewLTigWG4xSOukaG'], // Arnold  
    [Voice.FABLE, 'pNInz6obpgDQGcFmaJgB'], // Adam
    [Voice.ONYX, 'Zlb1dXrM653N07WRdFW3'], // Erik
    [Voice.NOVA, 'EXAVITQu4vr4xnSDxMaL'], // Bella
    [Voice.SHIMMER, 'ThT5KcBeYPX3keUQqHPh'] // Dorothy
  ]);
  
  constructor() {
    Logger.info('ElevenLabs TTS Provider initialized', 'ElevenLabsTTSProvider');
  }
  
  /**
   * Set the API key for this provider
   */
  setApiKey(apiKey: string): void {
    this._apiKey.set(apiKey);
    this.validateConfiguration();
  }
  
  /**
   * Get the current API key
   */
  private get apiKey(): string {
    return this._apiKey();
  }generateTTS(query: TTSQuery): Signal<Result<TTSResponse, string>> {
    Logger.info(`Generating TTS for query: ${query.id}`, 'ElevenLabsTTSProvider');
    
    // Validate query
    const validation = this.validateQuery(query);
    if (!validation.isSuccess) {
      return signal(failure(validation.error)).asReadonly();
    }
    
    // Get voice ID
    const voiceId = this.voiceMap.get(query.settings.voice) || this.voiceMap.get(Voice.ALLOY)!;
    
    // Prepare request parameters
    const headers = {
      'xi-api-key': this.apiKey,
      'Content-Type': 'application/json'
    };
    
    const body = {
      text: query.text,
      model_id: this.mapModelToElevenLabs(query.settings.model),
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0,
        use_speaker_boost: true
      }
    };
    
    // Create HttpResourceRequest and trigger the HTTP resource
    this._ttsRequest.set({
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    
    // Return a computed signal that maps the resource result to our Result type
    return computed(() => {
      const startTime = Date.now();
      
      if (this.ttsResource.isLoading()) {
        return failure('Request in progress...');
      }
      
      if (this.ttsResource.error()) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        const errorMessage = this.extractErrorMessage(this.ttsResource.error());
        
        Logger.error(`TTS generation failed: ${errorMessage}`, 'ElevenLabsTTSProvider');
        
        this._status.set({
          isAvailable: false,
          lastError: errorMessage,
          responseTime
        });
        
        return failure(errorMessage);
      }
      
      const resourceData = this.ttsResource.value();
      if (resourceData) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        Logger.info(`TTS generation completed in ${responseTime}ms`, 'ElevenLabsTTSProvider');
        
        this._status.set({
          isAvailable: true,
          lastError: undefined,
          responseTime
        });
        
        const ttsResponse: TTSResponse = {
          audioData: new Uint8Array(resourceData),
          format: 'mp3' as const,
          duration: undefined,
          sampleRate: undefined
        };
        
        return success(ttsResponse);
      }
      
      return failure('No data available');
    });
  }
    checkAvailability(): Signal<Result<boolean, string>> {
    // Prepare availability check request parameters
    const headers = {
      'xi-api-key': this.apiKey
    };
    
    // Create HttpResourceRequest and trigger the availability check
    this._availabilityRequest.set({
      url: 'https://api.elevenlabs.io/v1/user',
      method: 'GET',
      headers
    });
    
    // Return a computed signal that maps the resource result to our Result type
    return computed(() => {
      if (this.availabilityResource.isLoading()) {
        return failure('Checking availability...');
      }
      
      if (this.availabilityResource.error()) {
        const errorMessage = this.extractErrorMessage(this.availabilityResource.error());
        
        Logger.error(`ElevenLabs TTS availability check failed: ${errorMessage}`, 'ElevenLabsTTSProvider');
        
        this._status.set({
          isAvailable: false,
          lastError: errorMessage,
          responseTime: undefined
        });
        
        return failure(errorMessage);
      }
      
      if (this.availabilityResource.value()) {
        Logger.info('ElevenLabs TTS service is available', 'ElevenLabsTTSProvider');
        
        this._status.set({
          isAvailable: true,
          lastError: undefined,
          responseTime: undefined
        });
        
        return success(true);
      }
      
      return failure('Service unavailable');
    });
  }
  
  validateConfiguration(): Signal<Result<boolean, string>> {
    const validationSignal = signal<Result<boolean, string>>(
      failure('Validating configuration...')
    );
    
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      const error = 'ElevenLabs API key is required';
      this._status.set({
        isAvailable: false,
        lastError: error,
        responseTime: undefined
      });
      validationSignal.set(failure(error));
      return validationSignal.asReadonly();
    }
    
    if (this.apiKey.length < 20) {
      const error = 'Invalid ElevenLabs API key format';
      this._status.set({
        isAvailable: false,
        lastError: error,
        responseTime: undefined
      });
      validationSignal.set(failure(error));
      return validationSignal.asReadonly();
    }
    
    // API key format is valid
    validationSignal.set(success(true));
    this._status.set({
      isAvailable: true,
      lastError: undefined,
      responseTime: undefined
    });
    
    return validationSignal.asReadonly();
  }
  
  private validateQuery(query: TTSQuery): Result<boolean, string> {
    if (!query.text || query.text.trim().length === 0) {
      return failure('Text is required for TTS generation');
    }
    
    if (query.text.length > 5000) {
      return failure('Text exceeds maximum length of 5000 characters');
    }
    
    return success(true);
  }
  
  private mapModelToElevenLabs(model: string): string {
    switch (model) {
      case 'standard':
        return 'eleven_monolingual_v1';
      case 'hd':
        return 'eleven_multilingual_v2';
      case 'turbo':
        return 'eleven_turbo_v2';
      default:
        return 'eleven_monolingual_v1';
    }
  }
  private extractErrorMessage(error: unknown): string {
    const httpError = error as {
      error?: { 
        detail?: { message?: string };
        message?: string;
      };
      message?: string;
      status?: number;
      statusText?: string;
    };
    
    if (httpError?.error?.detail?.message) {
      return httpError.error.detail.message;
    }
    
    if (httpError?.error?.message) {
      return httpError.error.message;
    }
    
    if (httpError?.message) {
      return httpError.message;
    }
    
    if (httpError?.status) {
      switch (httpError.status) {
        case 401:
          return 'Invalid API key or authentication failed';
        case 403:
          return 'Access forbidden - check API key permissions';
        case 429:
          return 'Rate limit exceeded - please try again later';
        case 500:
          return 'ElevenLabs service temporarily unavailable';
        default:
          return `HTTP ${httpError.status}: ${httpError.statusText || 'Unknown error'}`;
      }
    }
    
    return 'Unknown error occurred during TTS generation';
  }
}
