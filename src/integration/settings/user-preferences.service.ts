// User preferences management service
import { Injectable, inject } from '@angular/core';
import { LoggingService } from '../logging.service';
import { Result } from '../../common/value-objects/query/result';
import { ModelProvider } from '../../domain/entities/tts.entity';
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
  private readonly logging = inject(LoggingService);
  private cachedPreferences?: UserPreferences;
  private preferences = signal<UserPreferences>(this.getDefaultUserPreferences());

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
      maxHistoryItems: 100,      enableNotifications: true,
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
      // First validate the JSON structure
      const data = JSON.parse(jsonData);
      if (!data || typeof data !== 'object') {
        return Result.failure('Invalid preferences format: not a valid JSON object');
      }
      
      // Validate preferences property exists and is an object
      if (!data.preferences || typeof data.preferences !== 'object') {
        return Result.failure('Invalid preferences format: missing or invalid preferences object');
      }

      // Type guard for preferences object
      if (!this.isPartialUserPreferences(data.preferences)) {
        return Result.failure('Invalid preferences format: preferences object has invalid structure');
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

  async clearUserPreferences(): Promise<Result<void, string>> {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      this.cachedPreferences = undefined;
      this.preferences.set(this.getDefaultUserPreferences());
      this.logging.info('User preferences cleared', 'UserPreferences');
      return Result.success(undefined);
    } catch (error) {
      this.logging.error('Failed to clear user preferences', error as Error, 'UserPreferences');
      return Result.failure('Failed to clear preferences: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }
  private validateAndMergePreferences(partialPrefs: unknown): UserPreferences {
    if (!this.isPartialUserPreferences(partialPrefs)) {
      this.logging.warn('Invalid preferences format, using defaults', 'UserPreferences');
      return this.getDefaultUserPreferences();
    }

    const defaultPrefs = this.getDefaultUserPreferences();
    const result: UserPreferences = { ...defaultPrefs };

    // Now we can safely type cast since we validated it
    const validPrefs = partialPrefs as Partial<UserPreferences>;

    // Validate and merge each field with type checking
    if (typeof validPrefs.defaultProvider === 'string' && 
        Object.values(ModelProvider).includes(validPrefs.defaultProvider as ModelProvider)) {
      result.defaultProvider = validPrefs.defaultProvider as ModelProvider;
    }

    if (typeof partialPrefs.defaultModel === 'string') {
      result.defaultModel = partialPrefs.defaultModel;
    }

    if (typeof partialPrefs.defaultVoice === 'string') {
      result.defaultVoice = partialPrefs.defaultVoice;
    }

    if (typeof partialPrefs.autoSaveHistory === 'boolean') {
      result.autoSaveHistory = partialPrefs.autoSaveHistory;
    }

    if (typeof partialPrefs.maxHistoryItems === 'number' && partialPrefs.maxHistoryItems > 0) {
      result.maxHistoryItems = partialPrefs.maxHistoryItems;
    }

    if (typeof partialPrefs.enableNotifications === 'boolean') {
      result.enableNotifications = partialPrefs.enableNotifications;
    }

    if (typeof partialPrefs.darkMode === 'boolean') {
      result.darkMode = partialPrefs.darkMode;
    }

    if (typeof partialPrefs.language === 'string') {
      result.language = partialPrefs.language;
    }

    if (typeof partialPrefs.audioQuality === 'string' && 
        ['low', 'medium', 'high'].includes(partialPrefs.audioQuality)) {
      result.audioQuality = partialPrefs.audioQuality;
    }

    if (typeof partialPrefs.autoPlay === 'boolean') {
      result.autoPlay = partialPrefs.autoPlay;
    }

    if (typeof partialPrefs.volume === 'number' && 
        partialPrefs.volume >= 0 && 
        partialPrefs.volume <= 1) {
      result.volume = partialPrefs.volume;
    }

    if (typeof partialPrefs.enableMetrics === 'boolean') {
      result.enableMetrics = partialPrefs.enableMetrics;
    }

    return result;
  }

  private isPartialUserPreferences(value: unknown): value is Partial<UserPreferences> {
    if (!value || typeof value !== 'object') return false;
    const prefs = value as Record<string, unknown>;

    // Check all present fields have correct types
    for (const [key, val] of Object.entries(prefs)) {
      switch (key) {
        case 'defaultProvider':
          if (typeof val !== 'string' || !Object.values(ModelProvider).includes(val as ModelProvider)) {
            return false;
          }
          break;
        case 'defaultModel':
        case 'defaultVoice':
        case 'language':
          if (typeof val !== 'string') {
            return false;
          }
          break;
        case 'audioQuality':
          if (typeof val !== 'string' || !['low', 'medium', 'high'].includes(val)) {
            return false;
          }
          break;
        case 'autoSaveHistory':
        case 'enableNotifications':
        case 'darkMode':
        case 'autoPlay':
        case 'enableMetrics':
          if (typeof val !== 'boolean') {
            return false;
          }
          break;
        case 'maxHistoryItems':
          if (typeof val !== 'number' || val < 0) {
            return false;
          }
          break;
        case 'volume':
          if (typeof val !== 'number' || val < 0 || val > 1) {
            return false;
          }
          break;
        default:
          return false; // Unknown property
      }
    }

    return true;
  }

  private isValidPartialPreferences(prefs: Partial<UserPreferences>): boolean {
    for (const [key, value] of Object.entries(prefs)) {
      switch (key) {
        case 'defaultProvider':
          if (typeof value !== 'string' || !Object.values(ModelProvider).includes(value as ModelProvider)) {
            return false;
          }
          break;
        case 'defaultModel':
        case 'defaultVoice':
        case 'language':
          if (typeof value !== 'string') {
            return false;
          }
          break;
        case 'autoSaveHistory':
        case 'enableNotifications':
        case 'darkMode':
        case 'autoPlay':
        case 'enableMetrics':
          if (typeof value !== 'boolean') {
            return false;
          }
          break;
        case 'maxHistoryItems':
          if (typeof value !== 'number' || value < 0) {
            return false;
          }
          break;
        case 'volume':
          if (typeof value !== 'number' || value < 0 || value > 1) {
            return false;
          }
          break;
        case 'audioQuality':
          if (!['low', 'medium', 'high'].includes(value as string)) {
            return false;
          }
          break;
        default:
          return false; // Reject unknown properties
      }
    }
    return true;
  }

  async updatePreferences(partialPrefs: Partial<UserPreferences>): Promise<Result<void, string>> {
    if (!this.isValidPartialPreferences(partialPrefs)) {
      return Result.failure('Invalid preference values provided');
    }

    const currentPrefs = await this.loadUserPreferences();
    if (!currentPrefs.isSuccess()) {
      return Result.failure('Failed to load current preferences');
    }

    const updatedPrefs = { ...currentPrefs.getValue(), ...partialPrefs };
    return this.saveUserPreferences(updatedPrefs);
  }
}
