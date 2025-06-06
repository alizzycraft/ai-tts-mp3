// Modern AudioPlayerComponent with signal-based inputs and outputs
import { Component, computed, OnDestroy, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TTSResult } from '../../../../../integration/types/tts.types';
import { 
  FormatDatePipe,
  FormatDurationPipe,
  TruncateTextPipe 
} from '../../../../../integration/transforms/pipes';
import { PlaybackService } from '../../../../../integration/services/audio/playback.service';
import { AngularTTSService } from '../../../../../integration/services/audio/angular-tts.service';
import { SettingsService } from '../../../../../integration/services/settings/settings.service';

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
  private volumeSignal = signal(1.0); // 0.0 to 1.0

  // Computed properties
  displayText = computed(() => {
    const info = this.currentQueryInfo();
    if (!info) return '...';
    return info.title || info.text;
  });

  displayDuration = computed(() => {
    const info = this.currentQueryInfo();
    return info?.estimatedDuration || 0;
  });

  isPlaying = computed(() => {
    const result = this.currentResult();
    if (result && !this.isLoadingSignal()) {
      this.checkAndLoadAudio(result);
    }
    return this.playbackService.isPlaying();
  });

  currentTime = computed(() => this.playbackService.currentTime());
  duration = computed(() => this.playbackService.totalDuration());
  volume = computed(() => this.volumeSignal());
  
  progress = computed(() => {
    const current = this.currentTime();
    const total = this.duration();
    return total > 0 ? (current / total) * 100 : 0;
  });

  canPlay = computed(() => {
    return !!this.currentResult() && !this.isLoadingSignal();
  });

  // Helper method to load audio for a result
  private checkAndLoadAudio(result: TTSResult): void {
    if (!this.isLoadingSignal() && result.audioData) {      this.isLoadingSignal.set(true);
      
      // Create a new audio context and decode buffer
      const audioContext = new AudioContext();
      audioContext.decodeAudioData(result.audioData.buffer)
        .then(() => {
          // Successfully decoded audio buffer
          this.isLoadingSignal.set(false);
        })
        .catch(error => {
          console.error('[AudioPlayer] Failed to decode audio:', error);
          this.isLoadingSignal.set(false);
        });
    }
  }

  ngOnDestroy() {
    // Clean up resources
    this.stopPlayback();
  }

  // Player controls
  togglePlayPause(): void {
    if (this.playbackService.isPlaying()) {
      this.playbackService.pause();
    } else {
      this.playbackService.play();
    }
  }

  stopPlayback(): void {
    if (this.playbackService.isPlaying()) {
      this.playbackService.stop();
    }
  }

  updateVolume(value: number): void {
    const newVolume = Math.max(0, Math.min(1, value));
    this.volumeSignal.set(newVolume);
    // Volume control will be handled by audio service
  }

  updateProgress(position: number): void {
    const duration = this.duration();
    if (duration > 0) {
      const time = (position / 100) * duration;
      this.playbackService.seek(time);
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
      const newTime = ratio * this.duration();
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

   private seekTo(time: number): void {
    if (time >= 0 && time <= this.duration()) {
      this.playbackService.seek(time);
    }
  }
}

// Using Angular's built-in signal
