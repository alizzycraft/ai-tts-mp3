// Modern AudioPlayerComponent with signal-based inputs and outputs
import { Component, computed, effect, OnDestroy, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TTSResult } from '../../../../integration/domain-types';
import { FormatDatePipe } from '../../../shared/pipes/format-date.pipe';
import { FormatDurationPipe } from '../../../shared/pipes/format-duration.pipe';
import { TruncateTextPipe } from '../../../shared/pipes/truncate-text.pipe';
import { PlaybackService } from '../../../../integration/playback.service';
import { AngularTTSService } from '../../../../integration/angular-tts.service';
import { SettingsService } from '../../../shared/settings.service';

// Define a type for currentQueryInfo
interface CurrentQueryInfo {
  text: string;
  title?: string;
  settings?: { provider: string; model: string; voice: string; };
  estimatedDuration?: number;
  createdAt?: Date;
  id?: string;
  audioSize?: number;
}

@Component({
  selector: 'app-audio-player-modern',
  standalone: true,
  imports: [CommonModule, FormatDatePipe, FormatDurationPipe, TruncateTextPipe],
  templateUrl: './audio-player-modern.component.html',
  styleUrl: './audio-player.component.scss' // Reuse existing styles
})
export class AudioPlayerModernComponent implements OnDestroy {
  // Inject services
  private ttsService = inject(AngularTTSService);
  protected settingsService = inject(SettingsService);
  public playbackService = inject(PlaybackService);

  // Modern signal-based inputs
  currentQueryInfo = input<CurrentQueryInfo | null>(null);
  currentResult = input<TTSResult | null>(null);

  // Output events
  clearResult = output<void>();

  // Internal state signals
  private isLoadingSignal = signal(false);
  private isPlayingSignal = signal(false);
  private currentTimeSignal = signal(0);
  private durationSignal = signal(0);
  private volumeSignal = signal(1.0); // 0.0 to 1.0

  // Computed properties
  displayText = computed(() => {
    const info = this.currentQueryInfo();
    if (!info) return '...';
    return info.title || info.text;
  });

  displayDuration = computed(() => {
    return this.durationSignal() || this.currentQueryInfo()?.estimatedDuration || 0;
  });

  isPlaying = computed(() => this.isPlayingSignal());
  currentTime = computed(() => this.currentTimeSignal());
  duration = computed(() => this.durationSignal());
  volume = computed(() => this.volumeSignal());
  
  progress = computed(() => {
    const current = this.currentTimeSignal();
    const total = this.durationSignal();
    return total > 0 ? (current / total) * 100 : 0;
  });

  canPlay = computed(() => {
    return !!this.currentResult() && !this.isLoadingSignal();
  });

  constructor() {
    // Set up side effects when inputs change
    effect(() => {
      const result = this.currentResult();
      if (result) {
        this.loadAudioForResult(result);
      }
    });

    // Sync with playback service state
    effect(() => {
      this.isPlayingSignal.set(this.playbackService.isPlaying());
      this.currentTimeSignal.set(this.playbackService.currentTime());
      this.durationSignal.set(this.playbackService.totalDuration());
    });
  }

  ngOnDestroy() {
    // Clean up resources
    this.stopPlayback();
  }

  // Player controls
  togglePlayPause(): void {
    if (this.isPlayingSignal()) {
      this.playbackService.pause();
    } else {
      this.playbackService.play();
    }
    // No need to update isPlayingSignal here, it's handled by the effect
  }

  stop(): void {
    this.stopPlayback();
  }
  seekTo(time: number): void {
    this.playbackService.seek(time);
  }

  setVolume(volume: number): void {
    if (volume >= 0 && volume <= 1) {
      this.volumeSignal.set(volume);
      // Store volume in a signal since PlaybackService doesn't have volume control
    }
  }

  onClearClick(): void {
    this.stopPlayback();
    this.clearResult.emit();
  }

  onProgressBarClick(event: Event): void {
    // Check if the event is a MouseEvent
    if (event instanceof MouseEvent) {
      const progressBar = event.currentTarget as HTMLElement;
      const rect = progressBar.getBoundingClientRect();
      const ratio = (event.clientX - rect.left) / rect.width;
      const newTime = ratio * this.durationSignal();
      this.seekTo(newTime);
    } else if (event instanceof KeyboardEvent) {
       // Handle keyboard events if needed in the future, for now do nothing
       console.log('Keyboard event on progress bar:', event.key);
    }
  }
  onRateChange(rate: number): void {
    // Playback rate control would need to be implemented in PlaybackService
    console.log('Playback rate changed to:', rate);
  }

  // Helper methods
  private async loadAudioForResult(result: TTSResult): Promise<void> {
    this.isLoadingSignal.set(true);
    try {
      await this.playbackService.loadAudio(result);
      this.durationSignal.set(this.playbackService.totalDuration());
    } catch (error) {
      console.error('[AudioPlayer] Error loading audio:', error);
    } finally {
      this.isLoadingSignal.set(false);
    }
  }

  private stopPlayback(): void {
    this.playbackService.stop();
    this.currentTimeSignal.set(0);
  }

  // Format time helper functions (could be moved to a pipe)
  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // Method to download the audio file
  downloadAudio(): void {
    const result = this.currentResult();
    if (!result || !result.audioData) {
      return;
    }

    const blob = new Blob([result.audioData], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Use title from query info or fallback to a default name
    const info = this.currentQueryInfo();
    const filename = info?.title 
      ? `${info.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3` 
      : `tts_audio_${new Date().getTime()}.mp3`;
    
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Using Angular's built-in signal
