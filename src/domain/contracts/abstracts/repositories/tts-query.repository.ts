import { TTSQuery, QueryId } from '../../../entities/tts.entity';

// Domain Repository Contracts
export abstract class TTSQueryRepository {
  abstract save(query: TTSQuery): Promise<void>;
  abstract findById(id: QueryId): Promise<TTSQuery | null>;
  abstract findRecent(limit?: number): Promise<TTSQuery[]>;
  abstract delete(id: QueryId): Promise<void>;
}
