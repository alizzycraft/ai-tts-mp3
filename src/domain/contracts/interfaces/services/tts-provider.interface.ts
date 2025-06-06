// Domain interface for TTS provider services
import { TTSSettings } from '../../../entities/tts.entity';

export interface ITTSProviderService {
  generateSpeech(text: string, settings: TTSSettings): Promise<Uint8Array>;
}
