// Integration layer re-exports for domain entities
// This allows the presentation layer to access domain entities through the integration layer

// Consolidated exports from tts.entity
export type {
  TTSResult,
  TTSSettings,
  TTSQuery,
  QueryId,
  QueryText
} from '../domain/entities/tts.entity';
export { ModelProvider, TTSResultStatus, ApiKey, Voice } from '../domain/entities/tts.entity';

// Export from provider.entity
export type { ProviderError } from '../domain/entities/provider.entity';

// Types for storage services
import { HistoryItem, StorageInfo } from '../domain/types/storage-types';
import { FileSystemStorageState, FolderReconnectionPrompt } from '../domain/services/storage-state.service';

export type { HistoryItem, StorageInfo, FileSystemStorageState, FolderReconnectionPrompt };
