import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../../shared/settings.service';
import { ModelProvider, Voice } from '../../../../integration/domain-types';
import { UserPreferencesService } from '../../../../integration/settings/user-preferences.service';

@Component({
  selector: 'app-settings-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-panel.component.html',
  styleUrl: './settings-panel.component.scss'
})
export class SettingsPanelComponent {
  // Inject the services
  public readonly settingsService = inject(SettingsService);
  private readonly userPreferences = inject(UserPreferencesService);

  // Expose ModelProvider enum for template
  readonly ModelProvider = ModelProvider;

  // Computed values from settings service
  readonly selectedProvider = computed(() => this.settingsService.selectedProvider());
  readonly selectedModel = computed(() => this.settingsService.selectedModel());
  readonly selectedVoice = computed(() => this.settingsService.selectedVoice());
  readonly apiKey = computed(() => this.settingsService.apiKey());
  readonly providers = computed(() => this.settingsService.providers);
  readonly models = computed(() => this.settingsService.models());
  readonly voices = computed(() => this.settingsService.voices());
  readonly enableMetrics = computed(() => this.userPreferences.getPreference('enableMetrics'));

  constructor() {
    // Load saved settings when component initializes - no effect needed
    this.settingsService.loadSavedSettings();
  }

  // Public methods for template access
  updateProvider(provider: ModelProvider) {
    this.settingsService.updateProvider(provider);
    this.onProviderChange();
  }

  updateModel(model: string) {
    this.settingsService.updateModel(model);
  }

  updateVoice(voice: string) {
    this.settingsService.updateVoice(voice as Voice);
  }

  updateApiKey(key: string) {
    this.settingsService.updateApiKey(key);
  }

  async toggleMetrics(event: Event) {
    const checkbox = event.target as HTMLInputElement;
    await this.userPreferences.updatePreference('enableMetrics', checkbox.checked);
  }

  private onProviderChange() {
    this.settingsService.onProviderChange();
  }
}
