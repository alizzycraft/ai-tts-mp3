import { TTSSettings } from '../../../entities/tts.entity';

// Settings Repository for local storage (optional persistence)
export abstract class TTSSettingsRepository {
  abstract save(settings: TTSSettings): /*todo:convert*/ Promise<void>;
  abstract load(): /*todo:convert*/ Promise<TTSSettings | null>;
  abstract clear(): /*todo:convert*/ Promise<void>;
}
