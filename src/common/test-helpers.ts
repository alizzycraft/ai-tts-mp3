/**
 * Test Helper Utilities
 * Provides utilities for testing signal-based reactive patterns without zone.js
 */

import { Signal, signal } from '@angular/core';
import { Result, success, failure } from './result';

/**
 * Creates a mock signal for testing
 */
export function createMockSignal<T>(initialValue: T): Signal<T> {
  const mockSignal = signal(initialValue);
  return mockSignal.asReadonly();
}

/**
 * Mock TTS response for testing
 */
export function createMockTTSResponse(audioData?: Uint8Array): Result<{audioData: Uint8Array; contentType: string; duration: number}, string> {
  return success({
    audioData: audioData || new Uint8Array([1, 2, 3, 4]),
    contentType: 'audio/mpeg',
    duration: 5.5
  });
}

/**
 * Mock error response for testing
 */
export function createMockError<T>(message: string): Result<T, string> {
  return failure(message);
}

/**
 * Wait for signal-based operations to complete
 */
export async function waitForSignalUpdate(timeoutMs = 1000): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, timeoutMs);
  });
}

/**
 * Test utilities for audio testing
 */
export class AudioTestHelper {
  static createMockAudioBlob(): Blob {
    return new Blob([new ArrayBuffer(1024)], { type: 'audio/mpeg' });
  }

  static createMockAudioURL(): string {
    return 'blob:mock-audio-url';
  }
}

/**
 * Mock provider configuration for testing
 */
export interface MockProviderConfig {
  provider: string;
  apiKey: string;
  isEnabled: boolean;
}

export function createMockProviderConfig(overrides?: Partial<MockProviderConfig>): MockProviderConfig {
  return {
    provider: 'openai',
    apiKey: 'test-api-key',
    isEnabled: true,
    ...overrides
  };
}
