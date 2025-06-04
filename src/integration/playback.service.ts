import { Injectable, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TTSResult } from '../domain/tts.entity';
import { HistoryItem } from './history-storage.service';
import { PlaybackService as InfraPlaybackService } from '../infrastructure/audio/playback.service';

@Injectable({
  providedIn: 'root'
})
export class PlaybackService implements OnDestroy {
  // Expose readonly signals
  readonly playingItemId;
  readonly isPlaying;
  readonly currentTime;
  readonly totalDuration;
  readonly hasEnded;

  constructor(
    private playbackService: InfraPlaybackService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {
    this.playingItemId = this.playbackService.playingItemId;
    this.isPlaying = this.playbackService.isPlaying;
    this.currentTime = this.playbackService.currentTime;
    this.totalDuration = this.playbackService.totalDuration;
    this.hasEnded = this.playbackService.hasEnded;
  }

  // Proxy all methods to infrastructure service
  loadAudio(result: TTSResult, itemId?: string): Promise<void> {
    return this.playbackService.loadAudio(result, itemId);
  }

  playResult(result: TTSResult, itemId?: string): Promise<void> {
    return this.playbackService.playResult(result, itemId);
  }
  play(): void {
    this.playbackService.play();
  }

  pause(): void {
    this.playbackService.pause();
  }

  stop(cleanup = true): void {
    this.playbackService.stop(cleanup);
  }

  async togglePlayPause(itemOrResult?: HistoryItem | TTSResult | null, itemId?: string): Promise<void> {
    let result: TTSResult | null = null;
    let currentItemId = itemId;

    // Extract the result and ID from the input
    if (itemOrResult && 'result' in itemOrResult) {
      result = itemOrResult.result;
      currentItemId = itemOrResult.id;
    } else if (itemOrResult && 'queryId' in itemOrResult) {
      result = itemOrResult;
      currentItemId = itemId || result.queryId?.getValue();
    }

    // If no platform support, exit early
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Delegate to infrastructure service
    return this.playbackService.togglePlayPause(itemOrResult, currentItemId);
  }

  seek(timeInSeconds: number): Promise<void> {
    return this.playbackService.seek(timeInSeconds);
  }

  seekToPercentage(percentage: number, shouldPlay?: boolean): Promise<void> {
    return this.playbackService.seekToPercentage(percentage, shouldPlay);
  }

  ngOnDestroy(): void {
    this.playbackService.stop();
  }
}
