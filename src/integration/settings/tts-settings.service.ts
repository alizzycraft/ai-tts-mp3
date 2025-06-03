// TTS Settings management service
import { Injectable } from '@angular/core';
import { TTSSettings, ModelProvider } from '../../domain/tts.entity';
import { ApiKey } from '../../domain/value-objects/api-key';
import { Result } from '../../common/result';
import { Logger } from '../../common/utils';

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
      Logger.debug('Saving last used TTS settings', { 
        provider: settings.provider, 
        model: settings.model 
      });

      // Convert ApiKey to string for storage
      const storableSettings = {
        ...settings,
        apiKey: settings.apiKey?.getValue()
      };
      
      const serialized = JSON.stringify(storableSettings);
      localStorage.setItem(this.STORAGE_KEY, serialized);
      
      Logger.info('Last used TTS settings saved successfully');
      return Result.success(undefined);
    } catch (error) {
      Logger.error('Failed to save last used TTS settings', error as Error);
      return Result.failure('Failed to save settings');
    }
  }

  /**
   * Load the last used TTS settings
   */
  async loadLastUsedSettings(): Promise<Result<TTSSettings | null, string>> {
    try {
      Logger.debug('Loading last used TTS settings');

      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        Logger.debug('No last used settings found');
        return Result.success(null);
      }

      const parsed = JSON.parse(stored);
      
      // Convert string apiKey back to ApiKey value object
      const settings: TTSSettings = {
        ...parsed,
        apiKey: parsed.apiKey ? ApiKey.fromString(parsed.apiKey) : undefined
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
   */
  getDefaultSettings(provider: ModelProvider): TTSSettings {
    const baseSettings: TTSSettings = {
      provider,
      text: '',
      voice: this.getDefaultVoice(provider),
      model: this.getDefaultModel(provider),
      responseFormat: 'mp3',
      speed: 1.0
    };

    return baseSettings;
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
   */
  validateSettings(settings: TTSSettings): Result<void, string[]> {
    const errors: string[] = [];

    if (!settings.text?.trim()) {
      errors.push('Text is required');
    }

    if (settings.text && settings.text.length > 4000) {
      errors.push('Text cannot exceed 4000 characters');
    }

    if (!settings.voice?.trim()) {
      errors.push('Voice is required');
    }

    if (!settings.model?.trim()) {
      errors.push('Model is required');
    }

    if (settings.speed !== undefined) {
      if (settings.speed < 0.25 || settings.speed > 4.0) {
        errors.push('Speed must be between 0.25 and 4.0');
      }
    }

    if (errors.length > 0) {
      return Result.failure(errors);
    }

    return Result.success(undefined);
  }
}
