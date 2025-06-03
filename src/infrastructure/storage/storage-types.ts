// Storage-related type definitions
import { TTSResult, TTSSettings } from '../../domain/tts.entity';

export interface HistoryItem {
  id: string;
  text: string;
  settings: TTSSettings;
  result: TTSResult;
  createdAt: Date;
  audioSize: number; // Size in bytes
  metadata?: {
    title?: string;
    tags?: string[];
    duration?: number;
  };
}

export interface StorageInfo {
  used: number;       // Bytes used
  available: number;  // Bytes available
  total: number;      // Total bytes
  usedPercentage: number; // 0.0 to 1.0
  itemCount: number;  // Number of items
}
