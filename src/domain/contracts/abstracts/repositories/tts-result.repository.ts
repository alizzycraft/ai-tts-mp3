import { TTSResult, QueryId } from '../../../entities/tts.entity';

export abstract class TTSResultRepository {
  abstract save(result: TTSResult): Promise<void>;
  abstract findByQueryId(queryId: QueryId): Promise<TTSResult | null>;
  abstract updateStatus(queryId: QueryId, status: TTSResult['status']): Promise<void>;
  abstract updateWithAudio(queryId: QueryId, audioData: Uint8Array, duration: number): Promise<void>;
  abstract updateWithError(queryId: QueryId, error: TTSResult['error']): Promise<void>;
  abstract delete(queryId: QueryId): Promise<void>;
}
