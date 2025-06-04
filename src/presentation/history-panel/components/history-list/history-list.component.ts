import { Component, computed, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HistoryItem } from '../../../../integration/domain-types';
import { PlaybackService } from '../../../../integration/playback.service';
import { FormatDatePipe } from '../../../shared/pipes/format-date.pipe';
import { TruncateTextPipe } from '../../../shared/pipes/truncate-text.pipe';
import { FormatFileSizePipe } from '../../../shared/pipes/format-file-size.pipe';
import { FormatDurationPipe } from '../../../shared/pipes/format-duration.pipe';

@Component({
  selector: 'app-history-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FormatDatePipe,
    TruncateTextPipe,
    FormatFileSizePipe,
    FormatDurationPipe
  ],
  templateUrl: './history-list.component.html',
  styleUrls: ['./history-list.component.scss']
})
export class HistoryListComponent {
  // Dependency injection
  public playbackService = inject(PlaybackService);

  // Input signals
  searchQuery = input.required<string>();
  selectedItemId = input.required<string | null>();
  history = input.required<HistoryItem[]>();
  filteredHistory = input.required<HistoryItem[]>();

  // Clear button
  showClearButton = computed(() => this.history().length > 0);

  // Output emitters
  itemSelected = output<HistoryItem>();
  deleteItem = output<{ item: HistoryItem, event: Event }>();
  clearHistory = output<void>();
  downloadItem = output<{ item: HistoryItem, event: Event }>();
  playPauseItem = output<{ item: HistoryItem, event: Event }>();

  // Helper methods
  isPlaying(item: HistoryItem): boolean {
    return this.playbackService.playingItemId() === item.id && 
           this.playbackService.isPlaying();
  }

  // Event handlers
  onItemClick(item: HistoryItem): void {
    this.itemSelected.emit(item);
  }

  onPlayPauseClick(event: Event, item: HistoryItem): void {
    event.stopPropagation();
    this.playPauseItem.emit({ item, event });
  }

  onDownloadClick(event: Event, item: HistoryItem): void {
    event.stopPropagation();
    this.downloadItem.emit({ item, event });
  }

  onDeleteClick(event: Event, item: HistoryItem): void {
    event.stopPropagation();
    this.deleteItem.emit({ item, event });
  }

  onClearClick(event: Event): void {
    event.stopPropagation();
    this.clearHistory.emit();
  }

  // Utility methods for icon mapping
  getProviderIcon(provider: string): string {
    switch ((provider || '').toLowerCase()) {
      case 'openai': return 'robot';
      case 'elevenlabs': return 'music';
      case 'azure': return 'cloud';
      case 'google': return 'search';
      case 'aws': return 'package';
      default: return 'microphone';
    }
  }

  getVoiceIcon(voice: string): string {
    // For OpenAI voices, use actual icon names (only those available in assets)
    const openAIVoiceIcons: Record<string, string> = {
      'alloy': 'ghost-3',
      'echo': 'moon',
      'fable': 'clover',
      'onyx': 'carambola',
      'nova': 'flower',
      'shimmer': 'sunglasses',
      // Fallbacks for new voices
      'coral': 'ghost-3',
      'ash': 'ghost-3',
      'sage': 'ghost-3',
      'rachel': 'ghost-3',
      'drew': 'moon',
      'clyde': 'clover'
    };
    return openAIVoiceIcons[(voice || '').toLowerCase()] || 'microphone';
  }

  getVoiceDisplayText(voice: string, provider: string): string {
    // Special handling based on provider
    switch ((provider || '').toLowerCase()) {
      case 'elevenlabs':
        return voice;
      case 'azure':
        return voice.split('-')[0]; // Show just the language code for Azure
      default:
        return voice;
    }
  }
}
