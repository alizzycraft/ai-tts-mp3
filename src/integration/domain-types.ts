// Integration layer re-exports for domain entities
// This allows the presentation layer to access domain entities through the integration layer

// Consolidated exports from tts.entity
export type {
  TTSResult,
  TTSSettings,
  TTSQuery,
  QueryId,
  QueryText
} from '../domain/tts.entity';
export { ModelProvider, TTSResultStatus, ApiKey, Voice } from '../domain/tts.entity';

// Export from provider.entity
export type { ProviderError } from '../domain/provider.entity';

// Types for storage services
import { HistoryItem, StorageInfo } from '../infrastructure/storage/storage-types';
import { FileSystemStorageState, FolderReconnectionPrompt } from '../infrastructure/storage/storage-state.service';

export type { HistoryItem, StorageInfo, FileSystemStorageState, FolderReconnectionPrompt };
