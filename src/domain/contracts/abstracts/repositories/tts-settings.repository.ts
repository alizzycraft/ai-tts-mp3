import { TTSSettings } from '../../../entities/tts.entity';

// Settings Repository for local storage (optional persistence)
export abstract class TTSSettingsRepository {
  abstract save(settings: TTSSettings): Promise<void>;
  abstract load(): Promise<TTSSettings | null>;
  abstract clear(): Promise<void>;
}
