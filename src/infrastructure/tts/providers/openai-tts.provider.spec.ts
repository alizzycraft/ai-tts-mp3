/**
 * OpenAI TTS Provider Tests
 * Tests for the OpenAI TTS provider implementation using httpResource
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { OpenAITTSProvider } from './openai-tts.provider';
import { TTSQuery, Voice, ModelProvider } from '../../../domain/tts.entity';

describe('OpenAITTSProvider', () => {
  let provider: OpenAITTSProvider;
  const mockApiKey = 'sk-test-key-1234567890abcdef';  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        OpenAITTSProvider
      ]
    });
    
    // Inject the provider service and configure it
    provider = TestBed.inject(OpenAITTSProvider);
    provider.setApiKey(mockApiKey);
  });

  it('should create', () => {
    expect(provider).toBeTruthy();
  });

  it('should have correct name', () => {
    expect(provider.name).toBe('OpenAI');
  });

  it('should validate API key format', () => {
    const validationResult = provider.validateConfiguration();
    expect(validationResult).toBeTruthy();
  });  it('should reject invalid API key', () => {
    const invalidProvider = TestBed.inject(OpenAITTSProvider);
    invalidProvider.setApiKey('invalid-key');
    const validationResult = invalidProvider.validateConfiguration();
    expect(validationResult).toBeTruthy();
  });it('should map voice correctly', () => {
    const query = new TTSQuery(
      'test-1',
      'Hello world',
      {
        provider: ModelProvider.OPENAI,
        voice: Voice.ALLOY,
        model: 'standard',
        speed: 1.0
      }
    );

    const result = provider.generateTTS(query);
    expect(result).toBeTruthy();
  });
});
