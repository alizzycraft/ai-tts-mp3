// User preferences management service
import { Injectable } from '@angular/core';
import { LoggingService } from '../logging.service';
import { Result } from '../../common/result';
import { ModelProvider } from '../../domain/tts.entity';
import { signal } from '@angular/core';

export interface UserPreferences {
  defaultProvider: ModelProvider;
  defaultModel: string;
  defaultVoice: string;
  autoSaveHistory: boolean;
  maxHistoryItems: number;
  enableNotifications: boolean;
  darkMode: boolean;
  language: string;
  audioQuality: 'low' | 'medium' | 'high';
  autoPlay: boolean;
  volume: number;
  enableMetrics: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UserPreferencesService {
  private readonly STORAGE_KEY = 'tts_user_preferences';
  private cachedPreferences?: UserPreferences;
  private preferences = signal<UserPreferences>(this.getDefaultUserPreferences());

  constructor(private logging: LoggingService) {}

  getPreference<K extends keyof UserPreferences>(key: K): UserPreferences[K] {
    return this.preferences()[key];
  }

  async updatePreference<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ): Promise<Result<void, string>> {
    const result = await this.loadUserPreferences();
    if (!result.isSuccess()) {
      return Result.failure('Failed to load preferences');
    }
    
    const preferences = { ...result.getValue(), [key]: value };
    return this.saveUserPreferences(preferences);
  }

  private getDefaultUserPreferences(): UserPreferences {
    return {
      defaultProvider: ModelProvider.OPENAI,
      defaultModel: 'tts-1',
      defaultVoice: 'alloy',
      autoSaveHistory: true,
      maxHistoryItems: 100,
      enableNotifications: true,
      darkMode: false,
      language: 'en',
      audioQuality: 'medium',
      autoPlay: false,
      volume: 0.8,
      enableMetrics: false // Metrics collection disabled by default
    };
  }

  async saveUserPreferences(preferences: UserPreferences): Promise<Result<void, string>> {
    return this.logging.trackPerformance(
      'saveUserPreferences',
      async () => {
        try {
          this.logging.info('Saving user preferences', 'UserPreferences', { 
            defaultProvider: preferences.defaultProvider,
            autoSaveHistory: preferences.autoSaveHistory,
            darkMode: preferences.darkMode
          });

          const serialized = JSON.stringify(preferences);
          localStorage.setItem(this.STORAGE_KEY, serialized);
          
          this.cachedPreferences = preferences;
          this.preferences.set(preferences);
          
          this.logging.info('User preferences saved successfully', 'UserPreferences');
          return Result.success(undefined);
        } catch (error) {
          this.logging.error('Failed to save user preferences', error as Error, 'UserPreferences');
          return Result.failure('Failed to save preferences: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
      },
      'UserPreferences'
    );
  }

  async loadUserPreferences(): Promise<Result<UserPreferences, string>> {
    return this.logging.trackPerformance(
      'loadUserPreferences',
      async () => {
        try {
          // Return cached preferences if available
          if (this.cachedPreferences) {
            return Result.success(this.cachedPreferences);
          }

          this.logging.debug('Loading user preferences from storage', 'UserPreferences');

          const stored = localStorage.getItem(this.STORAGE_KEY);
          if (!stored) {
            this.logging.info('No stored preferences found, returning defaults', 'UserPreferences');
            const defaults = this.getDefaultUserPreferences();
            await this.saveUserPreferences(defaults);
            return Result.success(defaults);
          }

          const preferences = JSON.parse(stored) as UserPreferences;
          
          // Validate and merge with defaults for new properties
          const validatedPreferences = this.validateAndMergePreferences(preferences);
          
          this.cachedPreferences = validatedPreferences;
          this.preferences.set(validatedPreferences);
          
          this.logging.info('User preferences loaded successfully', 'UserPreferences');
          return Result.success(validatedPreferences);
        } catch (error) {
          this.logging.error('Failed to load user preferences', error as Error, 'UserPreferences');
          const defaults = this.getDefaultUserPreferences();
          this.cachedPreferences = defaults;
          this.preferences.set(defaults);
          return Result.success(defaults);
        }
      },
      'UserPreferences'
    );
  }

  async resetToDefaults(): Promise<Result<void, string>> {
    this.logging.info('Resetting user preferences to defaults', 'UserPreferences');
    const defaults = this.getDefaultUserPreferences();
    this.cachedPreferences = undefined; // Clear cache
    return this.saveUserPreferences(defaults);
  }

  async exportPreferences(): Promise<string> {
    const result = await this.loadUserPreferences();
    const preferences = result.isSuccess() ? result.getValue() : this.getDefaultUserPreferences();
    
    return JSON.stringify({
      version: '1.0',
      timestamp: new Date().toISOString(),
      preferences
    }, null, 2);
  }

  async importPreferences(jsonData: string): Promise<Result<void, string>> {
    try {
      const data = JSON.parse(jsonData);
      
      if (!data.preferences) {
        return Result.failure('Invalid preferences format: missing preferences object');
      }

      const validatedPreferences = this.validateAndMergePreferences(data.preferences);
      
      this.logging.info('Importing user preferences', 'UserPreferences', {
        version: data.version,
        timestamp: data.timestamp
      });

      return this.saveUserPreferences(validatedPreferences);
    } catch (error) {
      this.logging.error('Failed to import preferences', error as Error, 'UserPreferences');
      return Result.failure('Failed to import preferences: ' + (error instanceof Error ? error.message : 'Invalid JSON'));
    }
  }

  private validateAndMergePreferences(preferences: Partial<UserPreferences>): UserPreferences {
    const defaults = this.getDefaultUserPreferences();
    
    return {
      defaultProvider: this.isValidProvider(preferences.defaultProvider) ? preferences.defaultProvider : defaults.defaultProvider,
      defaultModel: typeof preferences.defaultModel === 'string' ? preferences.defaultModel : defaults.defaultModel,
      defaultVoice: typeof preferences.defaultVoice === 'string' ? preferences.defaultVoice : defaults.defaultVoice,
      autoSaveHistory: typeof preferences.autoSaveHistory === 'boolean' ? preferences.autoSaveHistory : defaults.autoSaveHistory,
      maxHistoryItems: typeof preferences.maxHistoryItems === 'number' && preferences.maxHistoryItems > 0 ? preferences.maxHistoryItems : defaults.maxHistoryItems,
      enableNotifications: typeof preferences.enableNotifications === 'boolean' ? preferences.enableNotifications : defaults.enableNotifications,
      darkMode: typeof preferences.darkMode === 'boolean' ? preferences.darkMode : defaults.darkMode,
      language: typeof preferences.language === 'string' ? preferences.language : defaults.language,
      audioQuality: this.isValidAudioQuality(preferences.audioQuality) ? preferences.audioQuality : defaults.audioQuality,
      autoPlay: typeof preferences.autoPlay === 'boolean' ? preferences.autoPlay : defaults.autoPlay,
      volume: typeof preferences.volume === 'number' && preferences.volume >= 0 && preferences.volume <= 1 ? preferences.volume : defaults.volume,
      enableMetrics: typeof preferences.enableMetrics === 'boolean' ? preferences.enableMetrics : defaults.enableMetrics
    };
  }

  private isValidProvider(provider: unknown): provider is ModelProvider {
    return typeof provider === 'string' && 
           Object.values(ModelProvider).includes(provider as ModelProvider);
  }

  private isValidAudioQuality(quality: unknown): quality is 'low' | 'medium' | 'high' {
    return typeof quality === 'string' && 
           ['low', 'medium', 'high'].includes(quality);
  }
}
