// Settings Integration Manager - handles settings loading and coordination
import { Injectable, inject } from '@angular/core';
import { AngularTTSService } from '../../../../../integration/services/audio/angular-tts.service';
import { SettingsService } from '../../../../../integration/services/settings/settings.service';
import { Voice } from '../../../../../integration/types/tts.types';

@Injectable({
  providedIn: 'root'
})
export class SettingsIntegrationManagerService {
  private ttsService = inject(AngularTTSService);
  private settingsService = inject(SettingsService);

  /**
   * Load saved settings and apply them to the settings service
   */
  async loadSavedSettings(): Promise<void> {
    // Delegate settings loading to SettingsService, which reads from localStorage
    console.log('[SettingsIntegrationManager] Loading saved settings...');
    this.settingsService.loadSavedSettings();
    console.log('[SettingsIntegrationManager] Settings loaded successfully:', this.getSettingsSummary());
  }

  /**
   * Get current settings in TTS format
   */
  getCurrentTTSSettings() {
    return {
      provider: this.settingsService.selectedProvider(),
      model: this.settingsService.selectedModel(),
      voice: this.settingsService.selectedVoice(),
      apiKey: this.settingsService.apiKey()
    };
  }

  /**
   * Check if settings are valid for generation
   */
  areSettingsValid(): boolean {
    const settings = this.getCurrentTTSSettings();
    return !!(settings.provider && 
              settings.model && 
              settings.voice && 
              settings.apiKey?.trim());
  }

  /**
   * Get settings validation errors
   */
  getSettingsValidationErrors(): string[] {
    const errors: string[] = [];
    const settings = this.getCurrentTTSSettings();

    if (!settings.provider) {
      errors.push('Provider is required');
    }
    if (!settings.model) {
      errors.push('Model is required');
    }
    if (!settings.voice) {
      errors.push('Voice is required');
    }
    if (!settings.apiKey?.trim()) {
      errors.push('API key is required');
    }

    return errors;
  }

  /**
   * Reset settings to defaults
   */
  resetToDefaults(): void {
    console.log('[SettingsIntegrationManager] Resetting settings to defaults');
    
    this.settingsService.selectedModel.set('tts-1');
    this.settingsService.selectedVoice.set('alloy' as Voice);
    this.settingsService.apiKey.set('');
    this.settingsService.historyTitle.set('');
  }

  /**
   * Get settings summary for logging/debugging
   */
  getSettingsSummary() {
    const settings = this.getCurrentTTSSettings();
    return {
      provider: settings.provider,
      model: settings.model,
      voice: settings.voice,
      hasApiKey: !!settings.apiKey?.trim(),
      saveToHistory: this.settingsService.saveToHistory(),
      historyTitle: this.settingsService.historyTitle()
    };
  }
}
