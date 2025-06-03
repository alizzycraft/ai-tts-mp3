import { Injectable, OnDestroy } from '@angular/core';
import { TTSResult } from '../../domain/tts.entity';
import { HistoryItem } from '../history-storage.service';
import { AudioStateManager } from './audio-state-manager.service';
import { AudioResourceManager } from './audio-resource-manager.service';
import { AudioPlayerService } from './audio-player.service';

@Injectable({
  providedIn: 'root'
})
export class PlaybackService implements OnDestroy {
  // Expose readonly signals from AudioStateManager
  readonly playingItemId = this.stateManager.playingItemId;
  readonly isPlaying = this.stateManager.isPlaying;
  readonly currentTime = this.stateManager.currentTime;
  readonly totalDuration = this.stateManager.totalDuration;
  readonly hasEnded = this.stateManager.hasEnded;

  constructor(
    private stateManager: AudioStateManager,
    private resourceManager: AudioResourceManager,
    private player: AudioPlayerService
  ) {}

  /**
   * Loads audio from a TTS result
   */
  loadAudio(result: TTSResult, itemId?: string): Promise<void> {
    return this.player.loadAudio(result, itemId);
  }

  /**
   * Plays a specific TTS result
   */
  async playResult(result: TTSResult, itemId?: string): Promise<void> {
    await this.loadAudio(result, itemId);
    await this.play();
  }

  /**
   * Starts or resumes playback
   */
  play(): Promise<void> {
    return this.player.play();
  }

  /**
   * Pauses playback
   */
  pause(): void {
    this.player.pause();
  }

  /**
   * Stops playback and optionally cleans up
   */
  stop(cleanup = true): void {
    this.player.stop(cleanup);
  }

  /**
   * Toggles play/pause for a specific TTSResult or HistoryItem
   */
  async togglePlayPause(itemOrResult?: HistoryItem | TTSResult | null, itemId?: string): Promise<void> {
    // Early exit if currently playing
    if (this.isPlaying()) {
      this.pause();
      return;
    }

    // Extract result and ID from input
    let result: TTSResult | null = null;
    let currentItemId = itemId;

    if (itemOrResult && 'result' in itemOrResult) {
      result = itemOrResult.result;
      currentItemId = itemOrResult.id;
    } else if (itemOrResult && 'queryId' in itemOrResult) {
      result = itemOrResult;
      currentItemId = currentItemId || result.queryId.getValue();
    }

    // Check if we have audio data
    if (!result?.audioData) {
      console.warn('togglePlayPause called with no audio data available.');
      return;
    }

    // Load and play if needed
    if (this.playingItemId() !== currentItemId) {
      await this.playResult(result, currentItemId);
    } else {
      await this.play();
    }
  }

  /**
   * Seeks to a specific time in seconds
   */
  async seek(timeInSeconds: number): Promise<void> {
    return this.player.seek(timeInSeconds);
  }

  /**
   * Seeks to a specific percentage of the duration
   */
  async seekToPercentage(percentage: number, shouldPlay?: boolean): Promise<void> {
    const duration = this.totalDuration();
    if (duration > 0) {
      const targetTime = (percentage / 100) * duration;
      await this.seek(targetTime);
      if (shouldPlay) {
        await this.play();
      }
    }
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
