/**
 * Microsoft Edge TTS Configuration
 * Configuration for the free Microsoft Edge Text-to-Speech service
 */

import { ModelProvider } from '../../../domain/tts.entity';

export interface EdgeTTSConfig {
  readonly baseUrl: string;
  readonly voices: readonly string[];
  readonly models: readonly string[];
  readonly maxCharsPerRequest: number;
  readonly rateLimit: {
    readonly requestsPerSecond: number;
    readonly charactersPerMinute: number;
  };
  readonly supportedFeatures: {
    readonly ssml: boolean;
    readonly neuralVoices: boolean;
    readonly multiLanguage: boolean;
    readonly prosody: boolean;
  };
}

export const EDGE_TTS_CONFIG: EdgeTTSConfig = {
  baseUrl: 'speech.platform.bing.com/consumer/speech/synthesize/readaloud',
  voices: [
    'en-US-AriaNeural',
    'en-US-JennyNeural', 
    'en-US-GuyNeural',
    'en-US-DavisNeural',
    'en-US-JaneNeural',
    'en-US-JasonNeural',
    'en-US-NancyNeural',
    'en-US-TonyNeural',
    'en-US-SoniaNeural',
    'en-US-RyanNeural'
  ],
  models: [
    'edge-tts-standard', // Standard Edge TTS model
    'edge-tts-neural'    // Neural Edge TTS model (if available)
  ],
  maxCharsPerRequest: 10000, // Conservative limit for Edge TTS
  rateLimit: {
    requestsPerSecond: 20,  // Conservative rate limit
    charactersPerMinute: 50000 // Conservative character limit per minute
  },
  supportedFeatures: {
    ssml: true,
    neuralVoices: true,
    multiLanguage: true,
    prosody: true
  }
};

export const EDGE_PROVIDER = ModelProvider.EDGE;
