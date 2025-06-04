import { Component, computed, input, output, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TTSResult, ModelProvider, Voice, HistoryItem } from '../../integration/domain-types';
import { FormatDatePipe } from '../shared/pipes/format-date.pipe';
import { FormatDurationPipe } from '../shared/pipes/format-duration.pipe';
import { TruncateTextPipe } from '../shared/pipes/truncate-text.pipe';
import { PlaybackService } from '../../integration/playback.service';
import { AngularTTSService } from '../../integration/angular-tts.service';
import { SettingsService } from '../shared/settings.service';

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
  selector: 'app-audio-player',
  standalone: true,
  imports: [CommonModule, FormatDatePipe, FormatDurationPipe, TruncateTextPipe],
  templateUrl: './audio-player.component.html',
  styleUrl: './audio-player.component.scss'
})
export class AudioPlayerComponent implements OnDestroy {
  // Inject services
  private ttsService = inject(AngularTTSService);
  protected settingsService = inject(SettingsService);
  public playbackService = inject(PlaybackService);

  // Input signals
  currentQueryInfo = input<CurrentQueryInfo | null>(null);
  currentResult = input<TTSResult | null>(null);

  // Output events
  clearResult = output<void>();

  // Computed properties
  readonly queryMetadata = computed(() => {
    const info = this.currentQueryInfo();
    if (!info) return null;
    
    // Log query info changes
    console.log('[AudioPlayer] Query Info Updated:', {
      text: info.text,
      title: info.title,
      settings: info.settings
    });
    
    return {
      title: info.title,
      text: info.text,
      settings: info.settings
    };
  });

  readonly resultMetadata = computed(() => {
    const result = this.currentResult();
    if (!result) return null;
    
    // Use PlaybackService duration instead of result duration
    const duration = this.playbackService.totalDuration();
    if (duration) {
      console.log('[AudioPlayer] Using PlaybackService duration:', duration);
    }
    
    return {
      duration: duration || 0, // Use PlaybackService duration or fall back to 0
      fileSize: result.fileSize
    };
  });

  // Computed property for display text - Using pipe
  displayText = computed(() => {
    const info = this.currentQueryInfo();
    if (!info) return '...'; // Or an appropriate placeholder
    // Prioritize title if available, otherwise use truncated text
    const textToDisplay = info.title || info.text;
    // The truncation pipe is applied in the template
    return textToDisplay;
  });

  // Computed property for display creation date - Using pipe
  displayCreatedAt = computed(() => {
    const info = this.currentQueryInfo();
    if (!info?.createdAt) return '-';
    // Rely on template usage of FormatDatePipe
    return info.createdAt.toISOString();
  });

  // Computed properties
  hasAudio = computed(() => {
    const result = this.currentResult();
    return result && result.status === 'completed';
  });
  // Computed property for progress percentage (using PlaybackService state)
  progressPercentage = computed(() => {
    const duration = this.playbackService.totalDuration();
    const currentTime = this.playbackService.currentTime();
    const isAtEnd = !this.playbackService.isPlaying() && this.playbackService.hasEnded();
    return duration > 0 ? (isAtEnd ? 100 : (currentTime / duration) * 100) : 0;
  });

  // Computed properties for metadata display
  displayProvider = computed(() => {
    return this.currentQueryInfo()?.settings?.provider || this.settingsService.selectedProvider();
  });

  displayModel = computed(() => {
    return this.currentQueryInfo()?.settings?.model || this.settingsService.selectedModel();
  });
  displayVoice = computed(() => {
    return this.currentQueryInfo()?.settings?.voice || this.settingsService.selectedVoice();
  });

  displayTitle = computed(() => {
    return this.currentQueryInfo()?.title || '';
  });

  displaySize = computed(() => {
    const result = this.currentResult();
    const queryInfo = this.currentQueryInfo(); // Get currentQueryInfo
    let bytes = 0;
    
    // Try to get file size from the TTSResult, fall back to audioSize from HistoryItem
    if (result?.fileSize) {
      bytes = result.fileSize;
    } else if (queryInfo?.audioSize) {
      bytes = queryInfo.audioSize;
    }
    
    // If we still don't have file size, check the status
    if (bytes === 0) {
      // Show appropriate message based on status
      if (!result || result.status === 'pending' || result.status === 'processing') {
        return 'Processing...';
      } else if (result.status === 'failed') {
        return 'Failed';
      } else {
        return 'Calculating...';
      }
    }
    
    // Format the byte size
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  });

  // Update display duration computed to always use PlaybackService duration
  displayDuration = computed(() => {
    const duration = this.playbackService.totalDuration();
    // Log the source of the duration we're using
    console.log('[AudioPlayer] Display duration from PlaybackService:', duration);
    return duration || 0;
  });

  // Add a new computed for metadata display duration
  metadataDuration = computed(() => {
    const duration = this.playbackService.totalDuration();
    return duration || 0;
  });

  ngOnDestroy(): void {
    this.playbackService.stop();
  }

  async downloadAudio() {
    const result = this.currentResult();
    if (!result || !result.audioData) return;

    try {
      const queryInfo = this.currentQueryInfo();
      const title = queryInfo?.title || 'audio';
      const timestamp = Date.now();
      const blob = new Blob([result.audioData], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tts-${title}-${timestamp}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download audio:', error);
    }
  }
  onClearResult() {
    this.clearResult.emit();
  }

  async onProgressBarClick(event: MouseEvent) {
    const progressBar = event.currentTarget as HTMLElement;
    const rect = progressBar.getBoundingClientRect();
    const offsetX = Math.min(Math.max(0, event.clientX - rect.left), rect.width);
    const percentage = offsetX / rect.width;
    
    const result = this.currentResult();
    const queryInfo = this.currentQueryInfo();
    
    // Ensure audio is loaded
    if (result && (!this.playbackService.totalDuration() || this.playbackService.totalDuration() === 0)) {
      await this.playbackService.loadAudio(result, queryInfo?.id);
    }

    // Always play when seeking to a new position, unless the seek is to 100%
    const isSeekingToEnd = Math.abs(percentage * 100 - 100) < 0.1;
    const shouldPlay = !isSeekingToEnd;
    await this.playbackService.seekToPercentage(percentage * 100, shouldPlay);
  }

  onProgressBarKeydown(event: KeyboardEvent) {      const seekPercentage = 5; // Seek by 5% of total duration
      const currentPercentage = (this.playbackService.currentTime() / this.playbackService.totalDuration()) * 100;      
      let newPercentage: number;
      let isSeekingToEnd: boolean;
      let shouldPlay: boolean;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          newPercentage = Math.max(0, currentPercentage - seekPercentage);
          // Always play when seeking to a new position, unless seeking to 100%
          isSeekingToEnd = Math.abs(newPercentage - 100) < 0.1;
          shouldPlay = !isSeekingToEnd;
          this.playbackService.seekToPercentage(newPercentage, shouldPlay);
          break;
        case 'ArrowRight':
          event.preventDefault();
          newPercentage = Math.min(100, currentPercentage + seekPercentage);
          // Always play when seeking to a new position, unless seeking to 100%
          isSeekingToEnd = Math.abs(newPercentage - 100) < 0.1;
          shouldPlay = !isSeekingToEnd;
          this.playbackService.seekToPercentage(newPercentage, shouldPlay);
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          this.playbackService.togglePlayPause(this.currentResult(), this.currentQueryInfo()?.id); // Toggle play/pause
          break;
      }
    }

    // Helper method to construct HistoryItem for playback
    private constructHistoryItem(): HistoryItem | null {
      const info = this.currentQueryInfo();
      const result = this.currentResult();
      
      if (!info || !result) return null;

      return {
        id: info.id || result.queryId?.getValue() || 'current',
        text: info.text,
        settings: {
          provider: (info.settings?.provider || this.settingsService.selectedProvider()) as ModelProvider,
          model: info.settings?.model || this.settingsService.selectedModel(),
          voice: (info.settings?.voice || this.settingsService.selectedVoice()) as Voice,
          apiKey: undefined // Not needed for playback
        },
        result: result,
        createdAt: info.createdAt || result.createdAt || new Date(),
        audioSize: result.fileSize || 0,
        metadata: info.title ? { title: info.title } : undefined
      };
    }

    // Handle play/pause click
    async onPlayPauseClick(): Promise<void> {
      console.log('[AudioPlayer] onPlayPauseClick called');
      const result = this.currentResult();
      const queryInfo = this.currentQueryInfo(); // Get queryInfo
      const itemId = queryInfo?.id; // Get item ID from queryInfo

      console.log('[AudioPlayer] onPlayPauseClick: currentResult =', result); // Added log for currentResult
      console.log('[AudioPlayer] onPlayPauseClick: currentQueryInfo =', queryInfo); // Added log for currentQueryInfo
      console.log('[AudioPlayer] onPlayPauseClick: itemId =', itemId); // Added log for itemId

      if (result) { // Ensure there's a result before attempting to toggle playback
         // The togglePlayPause method in PlaybackService now handles loading and playing
         // based on the current state and the provided item ID.
         await this.playbackService.togglePlayPause(result, itemId); // Pass result and itemId
         // Manually trigger change detection to ensure the play/pause button updates
      } else {
         console.warn('[AudioPlayer] onPlayPauseClick: Cannot toggle playback, currentResult is null.');
      }
    }
  }