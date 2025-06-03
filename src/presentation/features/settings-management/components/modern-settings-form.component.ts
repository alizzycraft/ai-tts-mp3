// Modern Settings Form Component using signal-based forms
import { Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModelProvider, Voice } from '../../../../integration/domain-types';
import { SettingsService } from '../../../shared/settings.service';

interface SettingsFormModel {
  provider: string;
  model: string;
  voice: string;
  apiKey: string;
  saveToHistory: boolean;
  historyTitle?: string;
}

interface SettingsFormErrors {
  provider?: string;
  model?: string;
  voice?: string;
  apiKey?: string;
  historyTitle?: string;
}

@Component({
  selector: 'app-modern-settings-form',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modern-settings-form.component.html',
  styleUrls: ['./modern-settings-form.component.scss']
})
export class ModernSettingsFormComponent {
  // Inject services
  private settingsService = inject(SettingsService);
  
  // Input for initial values
  initialValues = input<Partial<SettingsFormModel>>({});
  
  // Output events
  formSubmit = output<SettingsFormModel>();
  formCancel = output<void>();
  
  // Form signals
  private provider = signal(this.initialValues()?.provider || ModelProvider.OPENAI);
  private model = signal(this.initialValues()?.model || '');
  private voice = signal(this.initialValues()?.voice || '');
  private apiKey = signal(this.initialValues()?.apiKey || '');
  private saveToHistory = signal(this.initialValues()?.saveToHistory ?? true);
  private historyTitle = signal(this.initialValues()?.historyTitle || '');
  
  // Available options signals - these would typically come from a service
  availableProviders = computed(() => [
    { id: ModelProvider.OPENAI, name: 'OpenAI' },
    { id: ModelProvider.ELEVENLABS, name: 'ElevenLabs' },
    { id: ModelProvider.AZURE, name: 'Azure' },
    { id: ModelProvider.GOOGLE, name: 'Google' },
    { id: ModelProvider.AWS, name: 'AWS' }
  ]);
  
  availableModels = computed(() => {
    const currentProvider = this.provider();
    
    // Return models based on the selected provider
    // This would typically come from a service
    switch (currentProvider) {
      case ModelProvider.OPENAI:
        return [
          { id: 'tts-1', name: 'TTS-1 (Standard)' },
          { id: 'tts-1-hd', name: 'TTS-1-HD (High Definition)' }
        ];
      case ModelProvider.ELEVENLABS:
        return [
          { id: 'eleven_multilingual_v2', name: 'Multilingual V2' },
          { id: 'eleven_turbo_v2_5', name: 'Turbo V2.5' }
        ];
      // Add cases for other providers
      default:
        return [];
    }
  });
  
  availableVoices = computed(() => {
    const currentProvider = this.provider();
    
    // Return voices based on the selected provider
    // This would typically come from a service
    switch (currentProvider) {
      case ModelProvider.OPENAI:
        return [
          { id: Voice.ALLOY, name: 'Alloy' },
          { id: Voice.ECHO, name: 'Echo' },
          { id: Voice.FABLE, name: 'Fable' },
          { id: Voice.ONYX, name: 'Onyx' },
          { id: Voice.NOVA, name: 'Nova' },
          { id: Voice.SHIMMER, name: 'Shimmer' }
        ];
      // Add cases for other providers
      default:
        return [];
    }
  });
  
  // Form validation
  errors = computed<SettingsFormErrors>(() => {
    const errors: SettingsFormErrors = {};
    
    if (!this.provider()) {
      errors.provider = 'Provider is required';
    }
    
    if (!this.model()) {
      errors.model = 'Model is required';
    }
    
    if (!this.voice()) {
      errors.voice = 'Voice is required';
    }
    
    if (!this.apiKey()) {
      errors.apiKey = 'API Key is required';
    }
    
    const title = this.historyTitle();
    if (title && title.trim().length > 50) {
      errors.historyTitle = 'Title must be 50 characters or less';
    }
    
    return errors;
  });
  
  formValid = computed(() => {
    const errorValues = Object.values(this.errors());
    return errorValues.length === 0;
  });
  
  // Expose form values as a computed property
  formValues = computed<SettingsFormModel>(() => {
    return {
      provider: this.provider(),
      model: this.model(),
      voice: this.voice(),
      apiKey: this.apiKey(),
      saveToHistory: this.saveToHistory(),
      historyTitle: this.historyTitle()
    };
  });
  
  // Form submission
  onSubmit(): void {
    if (this.formValid()) {
      this.formSubmit.emit(this.formValues());
    }
  }
  
  onCancel(): void {
    this.formCancel.emit();
  }
  
  // Form field change handlers
  onProviderChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.provider.set(select.value);
    
    // Reset model and voice when provider changes
    const models = this.availableModels();
    this.model.set(models.length > 0 ? models[0].id : '');
    
    const voices = this.availableVoices();
    this.voice.set(voices.length > 0 ? voices[0].id : '');
  }
  
  onModelChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.model.set(select.value);
  }
  
  onVoiceChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.voice.set(select.value);
  }
  
  onApiKeyChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.apiKey.set(input.value);
  }
  
  onSaveToHistoryChange(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    this.saveToHistory.set(checkbox.checked);
  }
  
  onHistoryTitleChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.historyTitle.set(input.value);
  }
  
  // Helper functions for checking field validity
  hasError(fieldName: keyof SettingsFormErrors): boolean {
    return !!this.errors()[fieldName];
  }
  
  getError(fieldName: keyof SettingsFormErrors): string | undefined {
    return this.errors()[fieldName];
  }
}

// Helper function for signal - recreating the signal function that isn't exported directly
function signal<T>(initialValue: T) {
  return { 
    value: initialValue, 
    set(newValue: T) { this.value = newValue; }, 
    get() { return this.value; } 
  };
}
