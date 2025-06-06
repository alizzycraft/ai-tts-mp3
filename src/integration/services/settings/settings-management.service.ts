// Orchestrating settings management service
import { Injectable, inject } from '@angular/core';
import { TTSSettings, ModelProvider } from '../../../domain/entities/tts.entity';
import { ApiKey } from '../../../common/value-objects/text/api-key';
import { UserPreferencesService, UserPreferences } from './user-preferences.service';
import { ProviderConfigurationService, ProviderConfiguration, ProviderValidationResult } from '../../../enactment/tts-providers/provider-configuration.service';
import { TTSSettingsService } from './tts-settings.service';
import { LoggingService } from '../../../common/services/logging.service';
import { MonitoringService } from '../../../enactment/monitoring/monitoring.service';
import { Result } from '../../../common/value-objects/query/result';

@Injectable({
  providedIn: 'root'
})
export class SettingsManagementService {
  private readonly userPreferences = inject(UserPreferencesService);
  private readonly providerConfig = inject(ProviderConfigurationService);
  private readonly ttsSettings = inject(TTSSettingsService);
  private readonly logging = inject(LoggingService);
  private readonly monitoring = inject(MonitoringService);

  constructor() {
    // No initialization logic needed anymore as dependencies are already injected
  }

  // User Preferences Management (delegated)
  async saveUserPreferences(preferences: UserPreferences): Promise<Result<void, string>> {
    return this.logging.trackPerformance(
      'saveUserPreferences',
      () => this.userPreferences.saveUserPreferences(preferences),
      'Settings'
    );
  }

  async loadUserPreferences(): Promise<Result<UserPreferences, string>> {
    return this.logging.trackPerformance(
      'loadUserPreferences',
      () => this.userPreferences.loadUserPreferences(),
      'Settings'
    );
  }

  async exportPreferences(): Promise<string> {
    return this.userPreferences.exportPreferences();
  }

  async importPreferences(data: string): Promise<Result<void, string>> {
    return this.userPreferences.importPreferences(data);
  }

  // Provider Configuration Management (delegated)
  async saveProviderConfiguration(config: ProviderConfiguration): Promise<Result<void, string>> {
    return this.providerConfig.saveProviderConfiguration(config);
  }

  async loadProviderConfiguration(provider: ModelProvider): Promise<Result<ProviderConfiguration | null, string>> {
    return this.providerConfig.loadProviderConfiguration(provider);
  }

  async loadAllProviderConfigurations(): Promise<Result<ProviderConfiguration[], string>> {
    return this.providerConfig.loadAllProviderConfigurations();
  }

  async validateProviderConfiguration(provider: ModelProvider): Promise<Result<ProviderValidationResult, string>> {
    return this.providerConfig.validateProviderConfiguration(provider);
  }
  // TTS Settings Management (delegated) 
  private validateTTSSettings(settings: unknown): Result<void, string[]> {
    const errors: string[] = [];

    if (!settings || typeof settings !== 'object') {
      errors.push('Settings must be an object');
      return Result.failure(errors);
    }
    
    const candidate = settings as Record<string, unknown>;

    // Required provider check
    if (!candidate['provider'] || 
        typeof candidate['provider'] !== 'string' || 
        !Object.values(ModelProvider).includes(candidate['provider'] as ModelProvider)) {
      errors.push('Invalid or missing provider');
    }

    // Required model check
    if (!candidate['model'] || typeof candidate['model'] !== 'string' || !candidate['model'].trim()) {
      errors.push('Model is required');
    }

    // Required voice check
    if (!candidate['voice'] || typeof candidate['voice'] !== 'string' || !candidate['voice'].trim()) {
      errors.push('Voice is required');
    }

    // ApiKey validation helper
    const isApiKey = (value: unknown): value is ApiKey => {
      return value instanceof ApiKey;
    };

    // Optional apiKey check - must be ApiKey instance if present 
    if ('apiKey' in candidate && candidate['apiKey'] !== undefined && !isApiKey(candidate['apiKey'])) {
      errors.push('Invalid API key format');
    }

    return errors.length ? Result.failure(errors) : Result.success(undefined);
  }  private validateTTSSettingsShape(settings: unknown): Result<TTSSettings, string[]> {
    const errors: string[] = [];

    // Type check for object
    if (!settings || typeof settings !== 'object') {
      errors.push('Settings must be an object');
      return Result.failure(errors);
    }

    const data = settings as Record<string, unknown>;

    // Required field validation with strict type checking
    if (!data['provider'] || 
        typeof data['provider'] !== 'string' || 
        !Object.values(ModelProvider).includes(data['provider'] as ModelProvider)) {
      errors.push('Invalid or missing provider');
    }

    if (!data['model'] || typeof data['model'] !== 'string' || !data['model'].trim()) {
      errors.push('Invalid or missing model');
    }

    if (!data['voice'] || typeof data['voice'] !== 'string' || !data['voice'].trim()) {
      errors.push('Invalid or missing voice');
    }

    // Optional fields validation
    if ('apiKey' in data && data['apiKey'] !== undefined) {
      if (!(data['apiKey'] instanceof ApiKey)) {
        errors.push('If provided, apiKey must be an ApiKey instance');
      }
    }

    // Provider-specific optional fields validation
    if ('region' in data && data['region'] !== undefined) {
      if (typeof data['region'] !== 'string' || !data['region'].trim()) {
        errors.push('If provided, region must be a non-empty string');
      }
    }

    if ('location' in data && data['location'] !== undefined) {
      if (typeof data['location'] !== 'string' || !data['location'].trim()) {
        errors.push('If provided, location must be a non-empty string');
      }
    }

    if (errors.length > 0) {
      this.logging.warn('TTS settings validation failed', 'Settings', { errors });
      return Result.failure(errors);
    }

    // Create validated settings object with strict typing
    const validatedSettings: TTSSettings = {
      provider: data['provider'] as ModelProvider,
      model: data['model'] as string,
      voice: data['voice'] as string,
    };

    // Only add optional properties if they pass validation
    if (data['apiKey'] instanceof ApiKey) {
      (validatedSettings as TTSSettings & { apiKey?: ApiKey }).apiKey = data['apiKey'];
    }

    // Include provider-specific settings if they pass validation
    if (typeof data['region'] === 'string' && data['region'].trim()) {
      (validatedSettings as TTSSettings & { region?: string }).region = data['region'];
    }

    if (typeof data['location'] === 'string' && data['location'].trim()) {
      (validatedSettings as TTSSettings & { location?: string }).location = data['location'];
    }

    this.logging.info('TTS settings validation successful', 'Settings', { provider: validatedSettings.provider });
    return Result.success(validatedSettings);
  }

  async saveLastUsedSettings(settings: unknown): Promise<Result<void, string>> {
    const validation = this.validateTTSSettingsShape(settings);
    if (!validation.isSuccess()) {
      this.logging.warn('Invalid TTS settings shape', 'Settings', { errors: validation.getError() });
      return Result.failure('Invalid settings: ' + validation.getError().join(', '));
    }

    const validatedSettings = validation.getValue();
    const propertyValidation = this.validateTTSSettings(validatedSettings);
    if (!propertyValidation.isSuccess()) {
      this.logging.warn('Invalid TTS settings', 'Settings', { errors: propertyValidation.getError() });
      return Result.failure('Invalid settings: ' + propertyValidation.getError().join(', '));
    }

    return this.ttsSettings.saveLastUsedSettings(validatedSettings);
  }

  async loadLastUsedSettings(): Promise<Result<TTSSettings | null, string>> {
    return this.ttsSettings.loadLastUsedSettings();
  }

  // Combined Operations
  /**
   * Get effective settings by combining user preferences, provider configuration, and last used settings
   */
  async getEffectiveSettings(provider?: ModelProvider): Promise<Result<TTSSettings, string>> {
    try {
      this.logging.debug('Getting effective settings', 'Settings', { provider });

      // Try to load last used settings first
      const lastUsed = await this.ttsSettings.loadLastUsedSettings();
      if (lastUsed.isSuccess() && lastUsed.getValue()) {
        const settings = lastUsed.getValue()!;
        if (!provider || settings.provider === provider) {
          this.logging.info('Using last used settings', 'Settings');
          return Result.success(settings);
        }
      }

      // Determine target provider
      const targetProvider = provider || await this.getDefaultProvider();

      // Get default settings for the provider
      const defaultSettings = this.ttsSettings.getDefaultSettings(targetProvider);

      // Try to load API key from provider configuration
      const providerConfig = await this.providerConfig.loadProviderConfiguration(targetProvider);
      if (providerConfig.isSuccess() && providerConfig.getValue()?.apiKey) {
        const apiKey = ApiKey.fromString(providerConfig.getValue()!.apiKey!);
        const effectiveSettings = {
          ...defaultSettings,
          apiKey
        };
        
        this.logging.info('Using provider configuration with API key', 'Settings');
        return Result.success(effectiveSettings);
      }

      this.logging.info('Using default settings without API key', 'Settings');
      return Result.success(defaultSettings);
    } catch (error) {
      this.logging.error('Failed to get effective settings', error as Error, 'Settings');
      return Result.failure('Failed to load settings');
    }
  }

  /**
   * Get the default provider from user preferences
   */
  private async getDefaultProvider(): Promise<ModelProvider> {
    const preferences = await this.userPreferences.loadUserPreferences();
    if (preferences.isSuccess()) {
      return preferences.getValue().defaultProvider;
    }
    return ModelProvider.OPENAI; // Fallback default
  }

  /**
   * Check if a provider is properly configured
   */
  async isProviderConfigured(provider: ModelProvider): Promise<boolean> {
    const config = await this.providerConfig.loadProviderConfiguration(provider);
    return config.isSuccess() && 
           config.getValue() !== null && 
           config.getValue()!.enabled &&
           !!config.getValue()!.apiKey;
  }

  /**
   * Get all configured providers
   */
  async getConfiguredProviders(): Promise<ModelProvider[]> {
    const allConfigs = await this.providerConfig.loadAllProviderConfigurations();
    if (!allConfigs.isSuccess()) {
      return [];
    }

    return allConfigs.getValue()
      .filter(config => config.enabled && config.apiKey)
      .map(config => config.provider);
  }

  /**
   * Clear all stored settings data
   */
  async clearAllSettings(): Promise<Result<void, string>> {
    try {
      this.logging.info('Clearing all settings', 'Settings');

      const results = await Promise.allSettled([
        this.userPreferences.clearUserPreferences(),
        this.providerConfig.clearAllProviderConfigurations(),
        this.ttsSettings.clearLastUsedSettings()
      ]);

      const errors = results
        .filter(result => result.status === 'rejected')
        .map(result => (result as PromiseRejectedResult).reason);

      if (errors.length > 0) {
        this.logging.error('Some settings failed to clear', new Error(errors.join(', ')), 'Settings');
        return Result.failure('Failed to clear some settings');
      }

      this.logging.info('All settings cleared successfully', 'Settings');
      return Result.success(undefined);
    } catch (error) {
      this.logging.error('Failed to clear all settings', error as Error, 'Settings');
      return Result.failure('Failed to clear settings');
    }
  }

  /**
   * Export all settings for backup
   */
  async exportAllSettings(): Promise<Result<string, string>> {
    try {
      const [preferences, providerConfigs, lastUsedSettings] = await Promise.all([
        this.userPreferences.loadUserPreferences(),
        this.providerConfig.loadAllProviderConfigurations(),
        this.ttsSettings.loadLastUsedSettings()
      ]);

      const exportData = {
        userPreferences: preferences.isSuccess() ? preferences.getValue() : null,
        providerConfigurations: providerConfigs.isSuccess() ? providerConfigs.getValue() : [],
        lastUsedSettings: lastUsedSettings.isSuccess() ? lastUsedSettings.getValue() : null,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };

      const serialized = JSON.stringify(exportData, null, 2);
      this.logging.info('Settings exported successfully', 'Settings');
      return Result.success(serialized);
    } catch (error) {
      this.logging.error('Failed to export settings', error as Error, 'Settings');
      return Result.failure('Failed to export settings');
    }
  }

  // Type guards for settings validation
  private isUserPreferences(value: unknown): value is UserPreferences {
    if (!value || typeof value !== 'object') return false;
    const prefs = value as Record<string, unknown>;
    
    // Required string fields check
    const requiredStrings = ['defaultProvider', 'defaultModel', 'defaultVoice', 'language'];
    for (const field of requiredStrings) {
      if (typeof prefs[field] !== 'string') return false;
    }

    // Special case for defaultProvider - must be a valid ModelProvider
    if (!Object.values(ModelProvider).includes(prefs['defaultProvider'] as ModelProvider)) {
      return false;
    }

    // Required boolean fields check
    const requiredBooleans = [
      'autoSaveHistory', 
      'enableNotifications', 
      'darkMode', 
      'autoPlay', 
      'enableMetrics'
    ];
    for (const field of requiredBooleans) {
      if (typeof prefs[field] !== 'boolean') return false;
    }

    // Required numeric fields check
    if (typeof prefs['maxHistoryItems'] !== 'number' ||
        typeof prefs['volume'] !== 'number') {
      return false;
    }

    // Volume must be between 0 and 1
    if (prefs['volume'] < 0 || prefs['volume'] > 1) {
      return false;
    }

    // Audio quality must be one of the allowed values
    if (!['low', 'medium', 'high'].includes(prefs['audioQuality'] as string)) {
      return false;
    }

    return true;
  }

  private isProviderConfiguration(value: unknown): value is ProviderConfiguration {
    if (typeof value !== 'object' || value === null) return false;
    const config = value as Record<string, unknown>;
    
    return (
      typeof config['provider'] === 'string' &&
      Object.values(ModelProvider).includes(config['provider'] as ModelProvider) &&
      (!('apiKey' in config) || (config['apiKey'] instanceof ApiKey || config['apiKey'] === null)) &&
      (!('region' in config) || typeof config['region'] === 'string' || config['region'] === null) &&
      (!('location' in config) || typeof config['location'] === 'string' || config['location'] === null) &&
      (!('subscriptionKey' in config) || typeof config['subscriptionKey'] === 'string' || config['subscriptionKey'] === null)
    );
  }

  private isTTSSettings(value: unknown): value is TTSSettings {
    if (typeof value !== 'object' || value === null) return false;
    const settings = value as Record<string, unknown>;
    
    // Required fields check
    if (typeof settings['provider'] !== 'string' || 
        !Object.values(ModelProvider).includes(settings['provider'] as ModelProvider)) {
      return false;
    }

    // Model and voice are required strings
    if (typeof settings['model'] !== 'string' || 
        typeof settings['voice'] !== 'string') {
      return false;
    }

    // Optional fields with type validation
    if ('apiKey' in settings && 
        settings['apiKey'] !== undefined && 
        settings['apiKey'] !== null && 
        !(settings['apiKey'] instanceof ApiKey)) {
      return false;  
    }

    // Optional provider-specific settings
    if ('region' in settings && 
        settings['region'] !== undefined && 
        settings['region'] !== null && 
        typeof settings['region'] !== 'string') {
      return false;
    }

    if ('location' in settings && 
        settings['location'] !== undefined && 
        settings['location'] !== null && 
        typeof settings['location'] !== 'string') {
      return false;
    }

    return true;
  }

  /**
   * Import all settings from backup
   */
  async importAllSettings(data: string): Promise<Result<void, string>> {
    try {
      this.logging.info('Importing settings', 'Settings');

      const parsedData = JSON.parse(data);
      if (!parsedData || typeof parsedData !== 'object') {
        return Result.failure('Invalid settings data format');
      }

      const parsed = parsedData as Record<string, unknown>;
      const errors: string[] = [];

      // Import user preferences
      if (parsed['userPreferences']) {
        if (!this.isUserPreferences(parsed['userPreferences'])) {
          errors.push('Invalid user preferences format');
        } else {
          const result = await this.userPreferences.saveUserPreferences(parsed['userPreferences']);
          if (!result.isSuccess()) {
            errors.push(`User preferences: ${result.getError()}`);
          }
        }
      }

      // Import provider configurations
      if (parsed['providerConfigurations'] && Array.isArray(parsed['providerConfigurations'])) {
        for (const config of parsed['providerConfigurations']) {
          if (!this.isProviderConfiguration(config)) {
            errors.push(`Invalid provider configuration format: ${JSON.stringify(config)}`);
            continue;
          }
          const result = await this.providerConfig.saveProviderConfiguration(config);
          if (!result.isSuccess()) {
            errors.push(`Provider ${config.provider}: ${result.getError()}`);
          }
        }
      }

      // Import last used settings
      if (parsed['lastUsedSettings']) {
        const settingsData = parsed['lastUsedSettings'];
        if (!this.isTTSSettings(settingsData)) {
          errors.push('Invalid TTS settings format');
        } else {
          // Create new settings object with optional fields
          const settingsToSave: TTSSettings = {
            provider: settingsData.provider,
            model: settingsData.model,
            voice: settingsData.voice
          };

          // Add optional fields if they exist
          if (settingsData.apiKey instanceof ApiKey) {
            Object.assign(settingsToSave, { apiKey: settingsData.apiKey });
          }
          
          if ('region' in settingsData && typeof settingsData.region === 'string') {
            Object.assign(settingsToSave, { region: settingsData.region });
          }
          
          if ('location' in settingsData && typeof settingsData.location === 'string') {
            Object.assign(settingsToSave, { location: settingsData.location });
          }

          const result = await this.ttsSettings.saveLastUsedSettings(settingsToSave);
          if (!result.isSuccess()) {
            errors.push(`Last used settings: ${result.getError()}`);
          }
        }
      }

      if (errors.length > 0) {
        this.logging.warn('Some settings failed to import', 'Settings', { errors });
        return Result.failure(`Import partially failed: ${errors.join(', ')}`);
      }

      this.logging.info('Settings imported successfully', 'Settings');
      return Result.success(undefined);
    } catch (error) {
      this.logging.error('Failed to import settings', error as Error, 'Settings');
      return Result.failure('Failed to import settings');
    }
  }
}
