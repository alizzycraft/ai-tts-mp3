/**
 * Storage Domain Entities
 * Core business logic for TTS history storage and management
 */

import { TTSQuery, TTSSettings } from './tts.entity';

export enum StorageMode {
  NONE = 'none',
  LOCAL_STORAGE = 'localStorage',
  FILE_SYSTEM = 'fileSystem'
}

export interface HistoryItem {
  readonly id: string;
  readonly text: string;
  readonly settings: TTSSettings;
  readonly audioData: Uint8Array;
  readonly audioSize: number;
  readonly createdAt: Date;
  readonly duration?: number;
  readonly metadata?: {
    readonly title?: string;
    readonly tags?: string[];
  };
}

export interface StorageInfo {
  readonly used: number;        // Bytes used
  readonly available: number;   // Bytes available  
  readonly total: number;       // Total bytes
  readonly usedPercentage: number; // 0.0 to 1.0
  readonly itemCount: number;   // Number of items
  readonly isNearFull: boolean; // > 80% capacity
  readonly isCritical: boolean; // > 90% capacity
}

export interface StorageState {
  readonly mode: StorageMode;
  readonly isReady: boolean;
  readonly info: StorageInfo;
  readonly history: readonly HistoryItem[];
  readonly error?: string;
}

/**
 * Factory for creating HistoryItem from TTS generation
 */
export class HistoryItemFactory {
  static fromTTSGeneration(
    query: TTSQuery,
    audioData: Uint8Array,
    duration?: number,
    metadata?: HistoryItem['metadata']
  ): HistoryItem {
    return {
      id: query.id,
      text: query.text,
      settings: query.settings,
      audioData,
      audioSize: audioData.byteLength,
      createdAt: query.timestamp,
      duration,
      metadata
    };
  }

  static withMetadata(item: HistoryItem, metadata: HistoryItem['metadata']): HistoryItem {
    return {
      ...item,
      metadata: { ...item.metadata, ...metadata }
    };
  }
}

/**
 * Storage capacity calculator and management utilities
 */
export class StorageCapacityManager {
  private static readonly MAX_STORAGE_BYTES = 20 * 1024 * 1024; // 20MB
  private static readonly NEAR_FULL_THRESHOLD = 0.8; // 80%
  private static readonly CRITICAL_THRESHOLD = 0.9; // 90%

  static calculateStorageInfo(history: readonly HistoryItem[]): StorageInfo {
    const used = history.reduce((sum, item) => sum + item.audioSize, 0);
    const total = this.MAX_STORAGE_BYTES;
    const available = Math.max(0, total - used);
    const usedPercentage = total > 0 ? used / total : 0;
    
    return {
      used,
      available,
      total,
      usedPercentage,
      itemCount: history.length,
      isNearFull: usedPercentage > this.NEAR_FULL_THRESHOLD,
      isCritical: usedPercentage > this.CRITICAL_THRESHOLD
    };
  }
  static getItemsToRemove(
    history: readonly HistoryItem[], 
    newItemSize: number
  ): readonly HistoryItem[] {
    const currentUsed = history.reduce((sum, item) => sum + item.audioSize, 0);
    const totalAfterAdd = currentUsed + newItemSize;
    
    if (totalAfterAdd <= this.MAX_STORAGE_BYTES) {
      return [];
    }

    // Sort by creation date (oldest first) to implement FIFO cleanup
    const sortedHistory = [...history].sort((a, b) => 
      a.createdAt.getTime() - b.createdAt.getTime()
    );

    const itemsToRemove: HistoryItem[] = [];
    let bytesToFree = totalAfterAdd - this.MAX_STORAGE_BYTES;

    for (const item of sortedHistory) {
      if (bytesToFree <= 0) break;
      
      itemsToRemove.push(item);
      bytesToFree -= item.audioSize;
    }

    return itemsToRemove;
  }
  static canStoreItem(
    history: readonly HistoryItem[], 
    itemSize: number
  ): boolean {
    const currentUsed = history.reduce((sum, item) => sum + item.audioSize, 0);
    return (currentUsed + itemSize) <= this.MAX_STORAGE_BYTES;
  }
}
