import { Signal } from '@angular/core';
import { HistoryItem } from '../../../types/storage-types';
import { TTSSettings, TTSResult } from '../../../entities/tts.entity';

export interface IHistoryManagementService {
  history: Signal<HistoryItem[]>;
  loadHistory(): Promise<void>;
  addToHistory(
    text: string,
    settings: TTSSettings,
    result: TTSResult,
    metadata?: { title?: string; tags?: string[]; duration?: number }
  ): Promise<{ success: boolean; warnings?: string[]; removed?: HistoryItem[] }>;
  removeFromHistory(id: string): Promise<void>;
  clearHistory(): Promise<void>;
}
