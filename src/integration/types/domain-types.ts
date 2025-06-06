// Integration layer re-exports for domain entities
// This allows the presentation layer to access domain entities through the integration layer

// Consolidated exports from tts.entity
export type {
  TTSResult,
  TTSSettings,
  TTSQuery,
  QueryText
} from '../../domain/entities/tts.entity';
export { ModelProvider, TTSResultStatus, ApiKey, Voice } from '../../domain/entities/tts.entity';

export type{ QueryId } from '../../common/value-objects/query/query-id';

// Export from provider.entity
export type { ProviderError } from '../../domain/entities/provider.entity';

// Types for storage services

export type { HistoryItem, StorageInfo } from '../../domain/types/storage-types';
export type { FileSystemStorageState, FolderReconnectionPrompt } from '../../domain/services/storage-state.service';

