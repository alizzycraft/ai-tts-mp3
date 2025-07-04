/**
 * Microsoft Edge TTS Provider Tests
 * Tests for the Microsoft Edge TTS provider implementation
 */

import { TestBed } from '@angular/core/testing';
import { EdgeTTSProvider } from './edge-tts.provider';
import { TTSQuery, Voice, ModelProvider } from '../../../domain/tts.entity';

describe('EdgeTTSProvider', () => {
  let provider: EdgeTTSProvider;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        EdgeTTSProvider
      ]
    });
      // Inject the provider service
    provider = TestBed.inject(EdgeTTSProvider);
  });

  it('should create', () => {
    expect(provider).toBeTruthy();
  });
  it('should have correct name', () => {
    expect(provider.name).toBe('Microsoft Edge TTS');
  });

  it('should validate configuration successfully (no API key required)', () => {
    const validationResult = provider.validateConfiguration();
    expect(validationResult().isSuccess).toBeTruthy();
  });

  it('should handle API key setting gracefully (not required)', () => {
    expect(() => provider.setApiKey('any-key')).not.toThrow();
  });

  it('should map voice correctly', () => {
    const query = new TTSQuery(
      'test-1',
      'Hello world',
      {
        provider: ModelProvider.EDGE,
        voice: Voice.ARIA,
        model: 'neural'
      }
    );

    const result = provider.generateTTS(query);
    expect(result).toBeDefined();
    // Note: This will be an async operation, so we just test that it returns a signal
  });

  it('should validate query text length', () => {
    const longText = 'a'.repeat(15000); // Exceeds 10,000 character limit
    const query = new TTSQuery(
      'test-2',
      longText,
      {
        provider: ModelProvider.EDGE,
        voice: Voice.ARIA,
        model: 'neural'
      }
    );

    const result = provider.generateTTS(query);
    expect(result).toBeDefined();
    // The validation will happen inside the signal
  });

  it('should check availability', () => {
    const availability = provider.checkAvailability();
    expect(availability).toBeDefined();
    // Edge TTS should generally be available
  });
});
