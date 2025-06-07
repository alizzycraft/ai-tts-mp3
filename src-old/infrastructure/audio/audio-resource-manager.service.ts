import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioResourceManager {
  private currentAudioUrl: string | null = null;
  private currentAudioData: ArrayBuffer | null = null;

  /**
   * Creates an audio URL from the provided audio data
   */
  createAudioUrl(audioData: Uint8Array): string {
    // Clean up any existing URL
    this.releaseAudioUrl();

    // Create and store new URL
    const blob = new Blob([audioData], { type: 'audio/mpeg' });
    this.currentAudioUrl = URL.createObjectURL(blob);
    this.currentAudioData = audioData.buffer;

    return this.currentAudioUrl;
  }

  /**
   * Checks if the provided audio data matches the currently loaded audio
   */
  isCurrentAudioData(audioData: Uint8Array): boolean {
    return this.currentAudioData === audioData.buffer;
  }

  /**
   * Releases the current audio URL and cleans up resources
   */
  releaseAudioUrl(): void {
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }
    this.currentAudioData = null;
  }

  /**
   * Gets the current audio URL
   */
  getCurrentAudioUrl(): string | null {
    return this.currentAudioUrl;
  }
}
