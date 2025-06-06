// TTS Settings management service
import { Injectable } from '@angular/core';
import { TTSSettings, ModelProvider } from '../../../domain/entities/tts.entity';
import { ApiKey } from '../../../common/value-objects/text/api-key';
import { Result } from '../../../common/value-objects/query/result';
import { Logger } from '../../../common/utils/logger.util';

@Injectable({
  providedIn: 'root'
})
export class TTSSettingsService {
  private readonly STORAGE_KEY = 'tts_last_used_settings';

  /**
   * Save the last used TTS settings
   */
  async saveLastUsedSettings(settings: TTSSettings): Promise<Result<void, string>> {
    try {
      // Create sanitized settings without sensitive data
      const sanitizedSettings = {
        provider: settings.provider,
        model: settings.model,
        voice: settings.voice,
        // Do not copy the API key
      } as TTSSettings;

      Logger.info('Saving last used TTS settings', { 
        provider: settings.provider, 
        model: settings.model, 
        voice: settings.voice 
      });

      const serialized = JSON.stringify(sanitizedSettings);
      localStorage.setItem(this.STORAGE_KEY, serialized);
      
      Logger.info('Last used TTS settings saved (excluding sensitive data)');
      return Result.success(undefined);
    } catch (error) {
      Logger.error('Failed to save TTS settings', error as Error);
      return Result.failure('Failed to save settings');
    }
  }

  private isValidTTSSettings(value: unknown): value is TTSSettings {
    if (!value || typeof value !== 'object') return false;
    const settings = value as Record<string, unknown>;
    
    // Required fields
    if (typeof settings['provider'] !== 'string' ||
        !Object.values(ModelProvider).includes(settings['provider'] as ModelProvider)) {
      return false;
    }
    
    // Optional fields with type validation
    if ('model' in settings && typeof settings['model'] !== 'string') return false;
    if ('voice' in settings && typeof settings['voice'] !== 'string') return false;
    if ('apiKey' in settings && settings['apiKey'] !== undefined && !(settings['apiKey'] instanceof ApiKey)) return false;
    
    return true;
  }

  /**
   * Load the last used TTS settings
   */
  async loadLastUsedSettings(): Promise<Result<TTSSettings | null, string>> {
    try {
      Logger.info('Loading last used TTS settings');

      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        Logger.info('No last used settings found');
        return Result.success(null);
      }      const parsed = JSON.parse(stored);
      if (!this.isValidTTSSettings(parsed)) {
        Logger.warn('Invalid stored TTS settings format', { parsed });
        return Result.success(null);
      }

      // Convert string apiKey back to ApiKey value object if present
      const apiKeyStr = parsed.apiKey !== undefined ? parsed.apiKey.toString() : undefined;
      const settings: TTSSettings = {
        ...parsed,
        apiKey: typeof apiKeyStr === 'string' ? ApiKey.fromString(apiKeyStr) : undefined
      };

      Logger.info('Last used TTS settings loaded successfully');
      return Result.success(settings);
    } catch (error) {
      Logger.error('Failed to load last used TTS settings', error as Error);
      return Result.success(null);
    }
  }

  /**
   * Clear stored TTS settings
   */
  async clearLastUsedSettings(): Promise<Result<void, string>> {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      Logger.info('Last used TTS settings cleared');
      return Result.success(undefined);
    } catch (error) {
      Logger.error('Failed to clear last used TTS settings', error as Error);
      return Result.failure('Failed to clear settings');
    }
  }

  /**
   * Get default TTS settings for a provider
   */  getDefaultSettings(provider: ModelProvider): TTSSettings {
    return {
      provider,
      voice: this.getDefaultVoice(provider),
      model: this.getDefaultModel(provider)
    };
  }

  /**
   * Get default voice for a provider
   */
  private getDefaultVoice(provider: ModelProvider): string {
    switch (provider) {
      case ModelProvider.OPENAI:
        return 'alloy';
      case ModelProvider.ELEVENLABS:
        return 'rachel';
      case ModelProvider.AZURE:
        return 'en-US-AriaNeural';
      case ModelProvider.AWS:
        return 'Joanna';
      case ModelProvider.GOOGLE:
        return 'en-US-Wavenet-D';
      default:
        return 'alloy';
    }
  }

  /**
   * Get default model for a provider
   */
  private getDefaultModel(provider: ModelProvider): string {
    switch (provider) {
      case ModelProvider.OPENAI:
        return 'tts-1';
      case ModelProvider.ELEVENLABS:
        return 'eleven_monolingual_v1';
      case ModelProvider.AZURE:
        return 'tts';
      case ModelProvider.AWS:
        return 'neural';
      case ModelProvider.GOOGLE:
        return 'standard';
      default:
        return 'tts-1';
    }
  }

  /**
   * Validate TTS settings
   */  validateSettings(settings: TTSSettings): Result<void, string[]> {
    const errors: string[] = [];

    if (!settings.provider) {
      errors.push('Provider is required');
    }

    if (!settings.voice?.trim()) {
      errors.push('Voice is required');
    }

    if (!settings.model?.trim()) {
      errors.push('Model is required');
    }

    if (errors.length > 0) {
      return Result.failure(errors);
    }

    return Result.success(undefined);
  }
}
