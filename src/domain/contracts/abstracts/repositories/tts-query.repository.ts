import { TTSQuery, QueryId } from '../../../entities/tts.entity';

// Domain Repository Contracts
export abstract class TTSQueryRepository {
  abstract save(query: TTSQuery): /*todo:convert*/ Promise<void>;
  abstract findById(id: QueryId): /*todo:convert*/ Promise<TTSQuery | null>;
  abstract findRecent(limit?: number): /*todo:convert*/ Promise<TTSQuery[]>;
  abstract delete(id: QueryId): /*todo:convert*/ Promise<void>;
}
