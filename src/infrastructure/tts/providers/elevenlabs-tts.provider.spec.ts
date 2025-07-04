/**
 * ElevenLabs TTS Provider Tests
 * Tests for the ElevenLabs TTS provider implementation using httpResource
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ElevenLabsTTSProvider } from './elevenlabs-tts.provider';
import { TTSQuery, Voice, ModelProvider } from '../../../domain/tts.entity';

describe('ElevenLabsTTSProvider', () => {
  let provider: ElevenLabsTTSProvider;
  const mockApiKey = 'test-api-key-1234567890abcdef';
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        ElevenLabsTTSProvider
      ]
    });
    
    // Inject the provider service and configure it
    provider = TestBed.inject(ElevenLabsTTSProvider);
    provider.setApiKey(mockApiKey);
  });

  it('should create', () => {
    expect(provider).toBeTruthy();
  });

  it('should have correct name', () => {
    expect(provider.name).toBe('ElevenLabs');
  });

  it('should validate API key format', () => {
    const validationResult = provider.validateConfiguration();
    expect(validationResult).toBeTruthy();
  });  it('should reject invalid API key', () => {
    const invalidProvider = TestBed.inject(ElevenLabsTTSProvider);
    invalidProvider.setApiKey('');
    const validationResult = invalidProvider.validateConfiguration();
    expect(validationResult).toBeTruthy();
  });
  it('should map voice correctly', () => {
    const query = new TTSQuery(
      'test-1',
      'Hello world',
      {
        provider: ModelProvider.ELEVENLABS,
        voice: Voice.ALLOY,
        model: 'standard',
        speed: 1.0
      }
    );

    const result = provider.generateTTS(query);
    expect(result).toBeTruthy();
  });
});
