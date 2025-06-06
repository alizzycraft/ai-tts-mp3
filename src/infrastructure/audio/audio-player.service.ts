import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TTSResult } from '../../domain/entities/tts.entity';
import { AudioStateManager } from './audio-state-manager.service';
import { AudioResourceManager } from './audio-resource-manager.service';

@Injectable({
  providedIn: 'root'
})
export class AudioPlayerService {
  private platformId = inject(PLATFORM_ID);
  private stateManager = inject(AudioStateManager);
  private resourceManager = inject(AudioResourceManager);

  private audio: HTMLAudioElement | undefined;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.initializeAudioElement();
    }
  }

  private initializeAudioElement(): void {
    this.audio = new Audio();

    // Listen for time updates
    this.audio.ontimeupdate = () => {
      if (this.audio) {
        this.stateManager.setCurrentTime(this.audio.currentTime);
      }
    };

    // Listen for metadata load
    this.audio.onloadedmetadata = () => {
      if (this.audio) {
        this.stateManager.setTotalDuration(this.audio.duration);
      }
    };

    // Handle playback end
    this.audio.onended = () => {
      if (this.audio) {
        this.audio.pause();
        this.stateManager.setIsPlaying(false);
        this.stateManager.setHasEnded(true);
      }
    };

    // Update playing state
    this.audio.onplay = () => {
      this.stateManager.setIsPlaying(true);
    };

    this.audio.onpause = () => {
      this.stateManager.setIsPlaying(false);
    };
  }

  /**
   * Loads audio from a TTS result
   */
  async loadAudio(result: TTSResult, itemId?: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !this.audio) {
      return Promise.reject(new Error('Audio not available'));
    }

    if (!result.audioData) {
      return Promise.reject(new Error('No audio data'));
    }

    // Check if we're already playing this exact audio data
    if (this.resourceManager.isCurrentAudioData(result.audioData)) {
      return Promise.resolve();
    }

    // Stop current playback and create new audio URL
    this.stop();
    const audioUrl = this.resourceManager.createAudioUrl(result.audioData);
    this.audio.src = audioUrl;

    // Reset states
    this.stateManager.setHasEnded(false);
    this.stateManager.setPlayingItemId(itemId || null);

    // Wait for audio to be loaded
    return new Promise((resolve, reject) => {
      if (!this.audio) {
        reject(new Error('Audio element not available'));
        return;
      }

      const onReady = () => {
        this.audio?.removeEventListener('canplaythrough', onReady);
        this.audio?.removeEventListener('loadedmetadata', onReady);
        resolve();
      };

      const onError = () => {
        this.audio?.removeEventListener('canplaythrough', onReady);
        this.audio?.removeEventListener('loadedmetadata', onReady);
        this.audio?.removeEventListener('error', onError);
        this.stop();
        reject(new Error('Failed to load audio'));
      };

      this.audio.addEventListener('canplaythrough', onReady);
      this.audio.addEventListener('loadedmetadata', onReady);
      this.audio.addEventListener('error', onError);
    });
  }

  /**
   * Plays the loaded audio
   */
  async play(): Promise<void> {
    if (isPlatformBrowser(this.platformId) && this.audio) {
      try {
        await this.audio.play();
      } catch (error) {
        console.error('Error playing audio:', error);
        throw error;
      }
    }
  }

  /**
   * Pauses the current playback
   */
  pause(): void {
    if (isPlatformBrowser(this.platformId) && this.audio) {
      this.audio.pause();
    }
  }

  /**
   * Stops playback and optionally cleans up resources
   */
  stop(cleanup = true): void {
    if (isPlatformBrowser(this.platformId) && this.audio) {
      this.audio.pause();
      this.stateManager.setIsPlaying(false);

      if (cleanup) {
        this.audio.currentTime = 0;
        this.stateManager.reset();
        this.resourceManager.releaseAudioUrl();
      }
    }
  }

  /**
   * Seeks to a specific time in seconds
   */
  async seek(timeInSeconds: number): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !this.audio) {
      return;
    }

    if (this.audio.readyState >= 3) { // HAVE_FUTURE_DATA
      this.audio.currentTime = timeInSeconds;
    } else {
      await new Promise<void>(resolve => {
        const onCanPlay = () => {
          this.audio?.removeEventListener('canplay', onCanPlay);
          if (this.audio) {
            this.audio.currentTime = timeInSeconds;
          }
          resolve();
        };
        this.audio.addEventListener('canplay', onCanPlay);
      });
    }
  }
}
