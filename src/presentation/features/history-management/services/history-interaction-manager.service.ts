// History Interaction Manager - handles history item selection and playback
import { Injectable, signal, inject, OnDestroy, computed } from '@angular/core';
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
export class HistoryInteractionManagerService implements OnDestroy {
  private historyService = inject(IntegratedHistoryStorageService);
  private playbackService = inject(PlaybackService);

  // Expose playback state from PlaybackService
  readonly playingItemId = this.playbackService.playingItemId;
  readonly isPlaying = this.playbackService.isPlaying;

  // State signals
  currentQueryInfo = signal<QueryInfo | null>(null);
  selectedHistoryItem = signal<HistoryItem | null>(null);
  tempHistoryItem = signal<HistoryItem | null>(null);

  // Computed signal to handle auto-selection of new items
  private readonly autoSelectLatest = computed(() => {    const items = this.historyService.items();
    if (items.length === 0) return;

    const latestItem = items[0]; // Items are in reverse chronological order
    const currentSelection = this.selectedHistoryItem();

    // Only auto-select if no item is currently selected or if it's a new item
    if (!currentSelection || latestItem.id !== currentSelection.id) {
      console.log('[HistoryInteractionManager] Auto-selecting new history item:', latestItem.id);
      queueMicrotask(() => this.selectHistoryItem(latestItem));
    }
  });

  constructor() {
    // Just ensure the computed signal is active
    this.autoSelectLatest();
  }
  ngOnDestroy() {
    // Reset stateful signals to initial values
    this.selectedHistoryItem.set(null);
    this.currentQueryInfo.set(null);
    this.tempHistoryItem.set(null);
  }

  /**
   * Handle history item selection
   */
  clearSelection(): void {
    this.selectHistoryItem(null).catch(error => {
      console.error('[HistoryInteractionManager] Error clearing selection:', error);
    });
  }

  async selectHistoryItem(item: HistoryItem | null): Promise<void> {
    try {
      if (item) {
        console.log('[HistoryInteractionManager] Selecting history item:', item.id);
        
        // Update selection state first
        this.selectedHistoryItem.set(item);
        
        // Update query info immediately
        this.updateQueryInfoFromHistoryItem(item);
        
        // Then load audio in background
        if (item.result) {
          await this.playbackService.loadAudio(item.result, item.id);
        }
      } else {
        this.selectedHistoryItem.set(null);
        this.currentQueryInfo.set(null);
        this.playbackService.stop(true);
      }
    } catch (error) {
      console.error('[HistoryInteractionManager] Error selecting history item:', error);
    }
  }

  // Add this method to handle new items
  setLatestHistoryItem(item: HistoryItem): void {
    console.log('[HistoryInteractionManager] Setting latest history item:', item.id);
    // Automatically select the new item
    this.selectHistoryItem(item).catch(error => {
      console.error('[HistoryInteractionManager] Error auto-selecting new item:', error);
    });
  }

  /**
   * Handle playing a history item (select and play)
   */  async playHistoryItem(item: HistoryItem): Promise<void> {
    try {
      console.log('[HistoryInteractionManager] Playing history item:', item.id);
      
      // Debug: Check if item result has audio data
      console.log('[HistoryInteractionManager] Item has audio data:', !!item.result?.audioData);
      
      // If this item is currently playing, toggle play/pause
      if (this.playbackService.playingItemId() === item.id) {
        console.log('[HistoryInteractionManager] Item is currently playing, toggling playback');
        if (!item.result?.audioData) {
          console.warn('[HistoryInteractionManager] Cannot toggle playback - no audio data available');
          return;
        }
        // Just toggle play/pause state
        if (this.playbackService.isPlaying()) {
          this.playbackService.pause();
        } else {
          this.playbackService.play();
        }
        return;
      }

      // First select the item to set it as current and load audio
      console.log('[HistoryInteractionManager] Selecting history item:', item.id);
      
      // Update selection state first for reactivity
      this.selectedHistoryItem.set(item);
      
      // Update query info immediately
      this.updateQueryInfoFromHistoryItem(item);
      
      // Verify we have audio data and explicitly load it
      if (!item.result?.audioData) {
        console.error('[HistoryInteractionManager] Cannot play item - no audio data available');
        return;
      }
      
      // Load the audio data first to ensure it's ready
      await this.playbackService.loadAudio(item.result, item.id);
      
      console.log('[HistoryInteractionManager] Audio loaded, playing now');
      // Play the loaded audio directly instead of using togglePlayPause
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

  /**
   * Update query info based on selected history item
   */
  private updateQueryInfoFromHistoryItem(item: HistoryItem): void {
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
  }

  /**
   * Download history item audio
   */
  async downloadHistoryItem(item: HistoryItem): Promise<void> {
    try {
      if (!item.result?.audioData) {
        console.error('[HistoryInteractionManager] Cannot download - no audio data available');
        return;
      }

      const blob = new Blob([item.result.audioData], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `tts-${item.metadata?.title || 'audio'}-${item.id.slice(0, 8)}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      console.log('[HistoryInteractionManager] History item downloaded:', item.id);
    } catch (error) {
      console.error('[HistoryInteractionManager] Error downloading history item:', error);
    }
  }
}
