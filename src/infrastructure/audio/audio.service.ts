/**
 * Audio Service for handling audio playback and downloads
 * Uses signal-based reactive patterns and follows onion architecture
 */

import { signal, Signal, computed } from '@angular/core';
import { Result, success, failure } from '../../common/result';
import { Logger } from '../../common/utils';
import { TTSResponse } from '../tts/interfaces/tts-provider.interface';

export interface AudioState {
  readonly isPlaying: boolean;
  readonly isPaused: boolean;
  readonly duration: number;
  readonly currentTime: number;
  readonly volume: number;
  readonly error?: string;
}

export interface AudioDownloadOptions {
  readonly filename?: string;
  readonly format?: 'mp3' | 'wav' | 'ogg';
}

export class AudioService {
  
  // Signal-based state management
  private readonly _audioState = signal<AudioState>({
    isPlaying: false,
    isPaused: false,
    duration: 0,
    currentTime: 0,
    volume: 1.0,
    error: undefined
  });
  
  private readonly _currentAudio = signal<HTMLAudioElement | null>(null);
  
  public readonly audioState: Signal<AudioState> = this._audioState.asReadonly();
  
  public readonly canPlay = computed(() => {
    const audio = this._currentAudio();
    return audio !== null && !this._audioState().error;
  });
  
  public readonly isActive = computed(() => {
    const state = this._audioState();
    return state.isPlaying || state.isPaused;
  });
  
  /**
   * Load audio from TTS response
   */
  loadAudio(ttsResponse: TTSResponse): Result<boolean, string> {    try {
      Logger.info('Loading audio from TTS response', 'AudioService');
      
      // Stop current audio if playing
      this.stopAudio();
      
      // Create blob from audio data
      const blob = new Blob([ttsResponse.audioData], { 
        type: this.getMimeType(ttsResponse.format) 
      });
      
      // Create object URL
      const audioUrl = URL.createObjectURL(blob);
      
      // Create audio element
      const audio = new Audio(audioUrl);
      
      // Set up event listeners using signal-based approach
      this.setupAudioEventListeners(audio);
      
      // Update current audio
      this._currentAudio.set(audio);
      
      // Update state
      this._audioState.set({
        ...this._audioState(),
        error: undefined
      });
      
      Logger.info('Audio loaded successfully', 'AudioService');
      return success(true);
      
    } catch (error) {      const errorMessage = `Failed to load audio: ${error}`;
      Logger.error(errorMessage, 'AudioService');
      
      this._audioState.set({
        ...this._audioState(),
        error: errorMessage
      });
      
      return failure(errorMessage);
    }
  }
  
  /**
   * Play loaded audio
   */
  playAudio(): Result<boolean, string> {
    const audio = this._currentAudio();
    
    if (!audio) {
      return failure('No audio loaded');
    }
    
    try {
      const playPromise = audio.play();
      
      // Handle play promise (modern browsers)
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          Logger.error(`Audio play failed: ${error}`, 'AudioService');
          this._audioState.set({
            ...this._audioState(),
            isPlaying: false,
            error: `Failed to play audio: ${error}`
          });
        });
      }
      
      return success(true);
        } catch (error) {
      const errorMessage = `Failed to play audio: ${error}`;
      Logger.error(errorMessage, 'AudioService');
      return failure(errorMessage);
    }
  }
  
  /**
   * Pause audio playback
   */
  pauseAudio(): Result<boolean, string> {
    const audio = this._currentAudio();
    
    if (!audio) {
      return failure('No audio loaded');
    }
    
    try {
      audio.pause();
      return success(true);
        } catch (error) {
      const errorMessage = `Failed to pause audio: ${error}`;
      Logger.error(errorMessage, 'AudioService');
      return failure(errorMessage);
    }
  }
  
  /**
   * Stop audio playback
   */
  stopAudio(): Result<boolean, string> {
    const audio = this._currentAudio();
    
    if (!audio) {
      return success(true); // Already stopped
    }
    
    try {
      audio.pause();
      audio.currentTime = 0;
      
      // Clean up object URL
      if (audio.src && audio.src.startsWith('blob:')) {
        URL.revokeObjectURL(audio.src);
      }
      
      // Update state
      this._audioState.set({
        isPlaying: false,
        isPaused: false,
        duration: 0,
        currentTime: 0,
        volume: this._audioState().volume,
        error: undefined
      });
      
      this._currentAudio.set(null);
      
      return success(true);
        } catch (error) {
      const errorMessage = `Failed to stop audio: ${error}`;
      Logger.error(errorMessage, 'AudioService');
      return failure(errorMessage);
    }
  }
  
  /**
   * Set audio volume (0.0 to 1.0)
   */
  setVolume(volume: number): Result<boolean, string> {
    if (volume < 0 || volume > 1) {
      return failure('Volume must be between 0.0 and 1.0');
    }
    
    const audio = this._currentAudio();
    
    if (audio) {
      audio.volume = volume;
    }
    
    this._audioState.set({
      ...this._audioState(),
      volume
    });
    
    return success(true);
  }
  
  /**
   * Seek to specific time in audio
   */
  seekTo(time: number): Result<boolean, string> {
    const audio = this._currentAudio();
    
    if (!audio) {
      return failure('No audio loaded');
    }
    
    if (time < 0 || time > audio.duration) {
      return failure('Seek time out of range');
    }
    
    try {
      audio.currentTime = time;
      return success(true);
        } catch (error) {
      const errorMessage = `Failed to seek audio: ${error}`;
      Logger.error(errorMessage, 'AudioService');
      return failure(errorMessage);
    }
  }
  
  /**
   * Download audio as file
   */
  downloadAudio(ttsResponse: TTSResponse, options: AudioDownloadOptions = {}): Result<boolean, string> {    try {
      Logger.info('Downloading audio file', 'AudioService');
      
      const filename = options.filename || this.generateFilename(options.format || ttsResponse.format);
      const mimeType = this.getMimeType(options.format || ttsResponse.format);
      
      // Create blob
      const blob = new Blob([ttsResponse.audioData], { type: mimeType });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      Logger.info(`Audio downloaded as ${filename}`, 'AudioService');
      return success(true);
        } catch (error) {
      const errorMessage = `Failed to download audio: ${error}`;
      Logger.error(errorMessage, 'AudioService');
      return failure(errorMessage);
    }
  }
  
  private setupAudioEventListeners(audio: HTMLAudioElement): void {
    // Play event
    audio.addEventListener('play', () => {
      this._audioState.set({
        ...this._audioState(),
        isPlaying: true,
        isPaused: false,
        error: undefined
      });
    });
    
    // Pause event
    audio.addEventListener('pause', () => {
      this._audioState.set({
        ...this._audioState(),
        isPlaying: false,
        isPaused: true
      });
    });
    
    // Ended event
    audio.addEventListener('ended', () => {
      this._audioState.set({
        ...this._audioState(),
        isPlaying: false,
        isPaused: false,
        currentTime: 0
      });
    });
    
    // Duration loaded
    audio.addEventListener('loadedmetadata', () => {
      this._audioState.set({
        ...this._audioState(),
        duration: audio.duration || 0
      });
    });
    
    // Time update
    audio.addEventListener('timeupdate', () => {
      this._audioState.set({
        ...this._audioState(),
        currentTime: audio.currentTime || 0
      });
    });
      // Error event
    audio.addEventListener('error', (_event) => {
      const error = audio.error;
      const errorMessage = error ? `Audio error: ${error.message}` : 'Unknown audio error';
      
      Logger.error(errorMessage, 'AudioService');
      this._audioState.set({
        ...this._audioState(),
        isPlaying: false,
        isPaused: false,
        error: errorMessage
      });
    });
  }
  
  private getMimeType(format: string): string {
    switch (format.toLowerCase()) {
      case 'mp3':
        return 'audio/mpeg';
      case 'wav':
        return 'audio/wav';
      case 'ogg':
        return 'audio/ogg';
      default:
        return 'audio/mpeg';
    }
  }
  
  private generateFilename(format: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `tts-audio-${timestamp}.${format}`;
  }
}
