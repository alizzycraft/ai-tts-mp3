import { Component, computed, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HistoryItem } from '../../../../integration/domain-types';
import { PlaybackService } from '../../../../integration/playback.service';
import { FormatDatePipe } from '../../../shared/pipes/format-date.pipe';
import { TruncateTextPipe } from '../../../shared/pipes/truncate-text.pipe';
import { FormatFileSizePipe } from '../../../shared/pipes/format-file-size.pipe';

@Component({
  selector: 'app-history-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FormatDatePipe,
    TruncateTextPipe,
    FormatFileSizePipe
  ],  template: `
    <!-- History List Template -->
    <div class="history-list">
      @if (history().length > 0) {
        <div class="clear-history">
          <button 
            class="clear-button"
            (click)="onClearClick($event)"
            aria-label="Clear all history">
            Clear All
          </button>
        </div>
      }
      <div class="history-items">
        @for (item of filteredHistory(); track item.id) {
          <div 
            class="history-item" 
            [class.selected]="selectedItemId() === item.id"
            (click)="onItemClick(item)"
            role="button"
            tabindex="0"
            [attr.aria-selected]="selectedItemId() === item.id"
            (keyup.enter)="onItemClick(item)"
            (keyup.space)="onItemClick(item)">
            <div class="item-content">
              <div class="item-text">{{ item.text | truncateText:50 }}</div>
              <div class="item-meta">
                <span>{{ item.createdAt | formatDate }}</span>
                <span>{{ item.audioSize | formatFileSize }}</span>
              </div>
            </div>
            <div class="item-actions">
              <button 
                class="play-button"
                (click)="onPlayPauseClick($event, item)"
                [attr.aria-label]="isPlaying(item) ? 'Pause' : 'Play'">
                {{ isPlaying(item) ? '⏸️' : '▶️' }}
              </button>
              <button 
                class="download-button"
                (click)="onDownloadClick($event, item)"
                aria-label="Download">
                ⬇️
              </button>
              <button 
                class="delete-button"
                (click)="onDeleteClick($event, item)"
                aria-label="Delete">
                🗑️
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .history-list {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .search-bar {
      padding: 1rem;
      border-bottom: 1px solid var(--border-color);
    }

    .history-items {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
    }

    .history-item {
      padding: 1rem;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      margin-bottom: 1rem;
      cursor: pointer;

      &:hover {
        background: var(--hover-bg);
      }

      &.selected {
        border-color: var(--accent-color);
        background: var(--selected-bg);
      }
    }

    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .item-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .provider-icon, .voice-icon {
      width: 16px;
      height: 16px;
    }

    .item-actions {
      display: flex;
      gap: 0.5rem;
    }

    .item-metadata {
      display: flex;
      gap: 1rem;
      font-size: 0.9em;
      color: var(--text-muted);
    }    .clear-history {
      padding: 0.5rem;
      margin-bottom: 0.5rem;
      text-align: right;
    }

    .clear-button {
      padding: 0.5rem 1rem;
      background: transparent;
      border: 1px solid var(--error-color);
      color: var(--error-color);
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(218, 54, 51, 0.1);
        transform: translateY(-1px);
      }
    }  `]
})
export class HistoryListComponent {
    // Dependency injection
  public playbackService = inject(PlaybackService);

  // Input signals  searchQuery = input.required<string>();
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

  // Helpers
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
  }  onDeleteClick(event: Event, item: HistoryItem): void {
    event.stopPropagation();
    this.deleteItem.emit({ item, event });
  }

  onClearClick(event: Event): void {
    event.stopPropagation();
    this.clearHistory.emit();
  }
}
