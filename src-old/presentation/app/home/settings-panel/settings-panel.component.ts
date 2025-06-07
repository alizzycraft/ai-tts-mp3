import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../../../integration/services/settings/settings.service';
import { ModelProvider, Voice } from '../../../../integration/types/tts.types';

@Component({
  selector: 'app-settings-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-panel.component.html',
  styleUrl: './settings-panel.component.scss'
})
export class SettingsPanelComponent {
  public readonly settingsService = inject(SettingsService);

  // Public computed properties
  readonly selectedProvider = computed(() => this.settingsService.selectedProvider());
  readonly selectedModel = computed(() => this.settingsService.selectedModel());
  readonly selectedVoice = computed(() => this.settingsService.selectedVoice());
  readonly models = computed(() => this.settingsService.models());
  readonly voices = computed(() => this.settingsService.voices());
  readonly providers = computed(() => this.settingsService.providers);
  readonly apiKey = computed(() => this.settingsService.apiKey());

  constructor() {
    this.settingsService.loadSavedSettings();
  }

  // Event handlers and public methods
  onProviderChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    if (Object.values(ModelProvider).includes(value as ModelProvider)) {
      this.updateProvider(value as ModelProvider);
    }
  }

  updateProvider(provider: ModelProvider) {
    this.settingsService.updateProvider(provider);
  }

  updateModel(model: string) {
    this.settingsService.updateModel(model);
  }

  updateVoice(voice: string) {
    this.settingsService.updateVoice(voice as Voice);
  }

  updateApiKey(apiKey: string) {
    this.settingsService.updateApiKey(apiKey);
  }
}
