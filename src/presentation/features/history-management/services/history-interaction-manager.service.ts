// History Interaction Manager - handles history item selection and playback
import { Injectable, signal, inject } from '@angular/core';
import { IntegratedHistoryStorageService, HistoryItem } from '../../../../integration/history-storage.service';
import { PlaybackService } from '../../../../integration/playback.service';
import { TTSResult } from '../../../../integration/domain-types';

export interface QueryInfo {
  text: string;
  title?: string;
  settings?: {
    provider: string;
    model: string;
    voice: string;
  };
  estimatedDuration?: number; // in seconds
  createdAt: Date;
  id?: string;
  audioSize?: number;
}

@Injectable({
  providedIn: 'root'
})
export class HistoryInteractionManagerService {
  private historyService = inject(IntegratedHistoryStorageService);
  private playbackService = inject(PlaybackService);

  // Expose playback state from PlaybackService for UI coordination
  readonly playingItemId = this.playbackService.playingItemId;
  readonly isPlaying = this.playbackService.isPlaying;

  // State signals
  currentQueryInfo = signal<QueryInfo | null>(null);
  selectedHistoryItem = signal<HistoryItem | null>(null);
  tempHistoryItem = signal<HistoryItem | null>(null);

  /**
   * Handle history item selection
   */
  async selectHistoryItem(item: HistoryItem | null): Promise<void> {
    try {
      if (item) {
        console.log('[HistoryInteractionManager] Selecting history item:', item.id);

        this.selectedHistoryItem.set(item);

        // Update the current query info based on the selected history item
        this.currentQueryInfo.set({
          text: item.text,
          title: item.metadata?.title,
          settings: item.settings ? {
            provider: item.settings.provider,
            model: item.settings.model,
            voice: item.settings.voice
          } : undefined,
          estimatedDuration: item.result?.duration,
          createdAt: item.createdAt,
          id: item.id,
          audioSize: item.audioSize
        });

        // Load audio into the player. Do NOT automatically play when selecting.
        if (item.result) {
          await this.playbackService.loadAudio(item.result, item.id);
        }

        console.log('[HistoryInteractionManager] History item selected successfully');
      } else {
        // Handle deselection
        console.log('[HistoryInteractionManager] Deselecting history item');
        
        this.selectedHistoryItem.set(null);
        this.currentQueryInfo.set(null);
        this.playbackService.stop(true); // Stop playback and clear loaded audio on deselection
      }
    } catch (error) {
      console.error('[HistoryInteractionManager] Error selecting history item:', error);
    }
  }

  /**
   * Handle playing a history item (select and play)
   */
  async playHistoryItem(item: HistoryItem): Promise<void> {
    try {
      console.log('[HistoryInteractionManager] Playing history item:', item.id);

      // If this item is currently playing, toggle pause
      if (this.playbackService.playingItemId() === item.id) {
        await this.playbackService.togglePlayPause();
        return;
      }

      // First select the item (loads audio without playing)
      await this.selectHistoryItem(item);

      // Then explicitly play the loaded audio
      this.playbackService.play();

      console.log('[HistoryInteractionManager] History item playback started');
    } catch (error) {
      console.error('[HistoryInteractionManager] Error playing history item:', error);
    }
  }

  /**
   * Set temporary history item (when saving is disabled)
   */
  setTempHistoryItem(item: HistoryItem | null): void {
    this.tempHistoryItem.set(item);
    
    if (item) {
      // Automatically select the temporary item
      this.selectHistoryItem(item);
    }
  }

  /**
   * Update current query info from generation result
   */
  updateQueryInfoFromGeneration(
    text: string,
    result: TTSResult,
    title?: string,
    settings?: {
      provider: string;
      model: string;
      voice: string;
    }
  ): void {
    this.currentQueryInfo.set({
      text,
      title,
      settings,
      estimatedDuration: result.duration,
      createdAt: result.createdAt,
      id: result.queryId?.getValue(),
      audioSize: result.fileSize || result.audioData?.byteLength || 0
    });
  }

  /**
   * Update query info with duration after audio loading
   */
  updateQueryInfoDuration(duration: number): void {
    this.currentQueryInfo.update(info => {
      if (!info) return null;
      return { ...info, estimatedDuration: duration };
    });
  }

  /**
   * Clear all current state
   */
  clearAll(): void {
    this.selectedHistoryItem.set(null);
    this.currentQueryInfo.set(null);
    this.tempHistoryItem.set(null);
    this.playbackService.stop(true);
  }

  /**
   * Get current state
   */
  getCurrentState() {
    return {
      currentQueryInfo: this.currentQueryInfo(),
      selectedHistoryItem: this.selectedHistoryItem(),
      tempHistoryItem: this.tempHistoryItem()
    };
  }

  /**
   * Check if an item is currently selected
   */
  hasSelection(): boolean {
    return this.selectedHistoryItem() !== null || this.tempHistoryItem() !== null;
  }

  /**
   * Get the currently active item (selected or temporary)
   */
  getCurrentItem(): HistoryItem | null {
    return this.selectedHistoryItem() || this.tempHistoryItem();
  }
}
