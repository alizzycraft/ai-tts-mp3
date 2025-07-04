/**
 * Infrastructure interface for TTS providers
 * Following onion architecture - this interface defines the contract
 * that external TTS services must implement
 */

import { Signal } from '@angular/core';
import { Result } from '../../../common/result';
import { TTSQuery } from '../../../domain/tts.entity';

export interface TTSResponse {
  readonly audioData: Uint8Array;
  readonly format: 'mp3' | 'wav' | 'ogg';
  readonly duration?: number;
  readonly sampleRate?: number;
}

export interface TTSProviderStatus {
  readonly isAvailable: boolean;
  readonly lastError?: string;
  readonly responseTime?: number;
}

/**
 * TTS Provider interface that all external TTS services must implement
 * Uses signal-based reactive patterns for state management
 */
export interface ITTSProvider {
  readonly name: string;
  readonly status: Signal<TTSProviderStatus>;
  
  /**
   * Generate TTS audio from text query
   * @param query - The TTS query containing text, settings, and configuration
   * @returns Result containing audio data or error
   */
  generateTTS(query: TTSQuery): Signal<Result<TTSResponse, string>>;
  
  /**
   * Check if provider is available and configured
   * @returns Signal indicating availability status
   */
  checkAvailability(): Signal<Result<boolean, string>>;
  
  /**
   * Validate API key and configuration
   * @returns Signal with validation result
   */
  validateConfiguration(): Signal<Result<boolean, string>>;
}

/**
 * Factory function type for creating TTS provider instances
 */
export type TTSProviderFactory = (apiKey: string) => ITTSProvider;
