import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioStateManager {
  // State signals
  private _playingItemId = signal<string | null>(null);
  private _isPlaying = signal<boolean>(false);
  private _currentTime = signal<number>(0);
  private _totalDuration = signal<number>(0);
  private _hasEnded = signal<boolean>(false);

  // Public signals (computed for read-only access)
  readonly playingItemId = this._playingItemId.asReadonly();
  readonly isPlaying = this._isPlaying.asReadonly();
  readonly currentTime = this._currentTime.asReadonly();
  readonly totalDuration = this._totalDuration.asReadonly();
  readonly hasEnded = this._hasEnded.asReadonly();

  setPlayingItemId(id: string | null): void {
    this._playingItemId.set(id);
  }

  setIsPlaying(playing: boolean): void {
    this._isPlaying.set(playing);
  }

  setCurrentTime(time: number): void {
    this._currentTime.set(time);
  }

  setTotalDuration(duration: number): void {
    this._totalDuration.set(duration);
  }

  setHasEnded(ended: boolean): void {
    this._hasEnded.set(ended);
  }

  reset(): void {
    this._playingItemId.set(null);
    this._isPlaying.set(false);
    this._currentTime.set(0);
    this._totalDuration.set(0);
    this._hasEnded.set(false);
  }
}
