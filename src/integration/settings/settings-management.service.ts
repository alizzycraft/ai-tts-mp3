// Orchestrating settings management service
import { Injectable } from '@angular/core';
import { TTSSettings, ModelProvider } from '../../domain/tts.entity';
import { ApiKey } from '../../domain/value-objects/api-key';
import { UserPreferencesService, UserPreferences } from './user-preferences.service';
import { ProviderConfigurationService, ProviderConfiguration } from './provider-configuration.service';
import { TTSSettingsService } from './tts-settings.service';
import { LoggingService } from '../logging.service';
import { MonitoringService } from '../monitoring/monitoring.service';
import { Result } from '../../common/result';

@Injectable({
  providedIn: 'root'
})
export class SettingsManagementService {
  constructor(
    private userPreferences: UserPreferencesService,
    private providerConfig: ProviderConfigurationService,
    private ttsSettings: TTSSettingsService,
    private logging: LoggingService,
    private monitoring: MonitoringService
  ) {
    this.logging.info('SettingsManagementService initialized', 'Settings');
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

  async exportUserPreferences(): Promise<Result<string, string>> {
    return this.userPreferences.exportUserPreferences();
  }

  async importUserPreferences(data: string): Promise<Result<void, string>> {
    return this.userPreferences.importUserPreferences(data);
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

  async testProviderConnection(provider: ModelProvider): Promise<Result<void, string>> {
    return this.providerConfig.testProviderConnection(provider);
  }

  // TTS Settings Management (delegated)
  async saveLastUsedSettings(settings: TTSSettings): Promise<Result<void, string>> {
    return this.ttsSettings.saveLastUsedSettings(settings);
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

  /**
   * Import all settings from backup
   */
  async importAllSettings(data: string): Promise<Result<void, string>> {
    try {
      this.logging.info('Importing settings', 'Settings');

      const parsed = JSON.parse(data);
      const errors: string[] = [];

      // Import user preferences
      if (parsed.userPreferences) {
        const result = await this.userPreferences.saveUserPreferences(parsed.userPreferences);
        if (!result.isSuccess()) {
          errors.push(`User preferences: ${result.getError()}`);
        }
      }

      // Import provider configurations
      if (parsed.providerConfigurations && Array.isArray(parsed.providerConfigurations)) {
        for (const config of parsed.providerConfigurations) {
          const result = await this.providerConfig.saveProviderConfiguration(config);
          if (!result.isSuccess()) {
            errors.push(`Provider ${config.provider}: ${result.getError()}`);
          }
        }
      }

      // Import last used settings
      if (parsed.lastUsedSettings) {
        const result = await this.ttsSettings.saveLastUsedSettings(parsed.lastUsedSettings);
        if (!result.isSuccess()) {
          errors.push(`Last used settings: ${result.getError()}`);
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

  /**
   * Get settings summary for monitoring
   */
  async getSettingsSummary(): Promise<{
    configuredProviders: number;
    hasUserPreferences: boolean;
    hasLastUsedSettings: boolean;
  }> {
    const [providers, preferences, lastUsed] = await Promise.all([
      this.getConfiguredProviders(),
      this.userPreferences.loadUserPreferences(),
      this.ttsSettings.loadLastUsedSettings()
    ]);

    return {
      configuredProviders: providers.length,
      hasUserPreferences: preferences.isSuccess(),
      hasLastUsedSettings: lastUsed.isSuccess() && lastUsed.getValue() !== null
    };
  }
}
