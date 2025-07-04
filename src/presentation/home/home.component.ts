import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  TTSIntegrationService,
  TTSQuery, 
  TTSSettings, 
  ModelProvider, 
  Voice,
  QueryId
} from '../../integration';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="home-container">
      <header class="app-header">
        <h1 class="app-title">
          <span class="title-icon">🎤</span>
          AI-TTS-MP3
        </h1>
        <p class="app-subtitle">Text to Speech Converter</p>
      </header>

      <main class="main-content">
        <div class="editor-section">
          <div class="input-group">
            <label for="text-input" class="input-label">Enter text to convert:</label>
            <textarea
              id="text-input"
              class="text-input"
              [value]="inputText()"
              (input)="onTextChange($event)"
              placeholder="Type your text here..."
              rows="6"
            ></textarea>
          </div>

          <div class="controls-section">
            <div class="settings-row">
              <div class="setting-group">
                <label for="provider-select" class="setting-label">Provider:</label>                <select
                  id="provider-select"
                  class="setting-select"
                  [value]="selectedProvider()"
                  (change)="onProviderChange($event)"
                >
                  <option value="openai">OpenAI</option>
                  <option value="elevenlabs">ElevenLabs</option>
                  <option value="edge">Microsoft Edge TTS</option>
                </select>
              </div>              <div class="setting-group">
                <label for="voice-select" class="setting-label">Voice:</label>
                <select
                  id="voice-select"
                  class="setting-select"
                  [value]="selectedVoice()"
                  (change)="onVoiceChange($event)"
                >
                  @for (voice of availableVoices(); track voice.value) {
                    <option [value]="voice.value">{{ voice.label }}</option>
                  }
                </select>
              </div>
            </div>

            <div class="api-key-group">
              <label for="api-key" class="setting-label">API Key:</label>
              <input
                id="api-key"
                type="password"
                class="api-key-input"
                [value]="apiKey()"
                (input)="onApiKeyChange($event)"
                placeholder="Enter your API key"
              />
            </div>

            <button
              class="generate-btn"
              [disabled]="!canGenerate()"
              [class.loading]="isProcessing()"
              (click)="generateSpeech()"
            >
              {{ isProcessing() ? 'Generating...' : 'Generate Speech' }}
            </button>
          </div>
        </div>        <div class="result-section" *ngIf="currentResult()">
          <div class="result-card">
            <h3 class="result-title">Generated Audio</h3>
            <div class="result-info">
              <p><strong>Provider:</strong> {{ currentResult()?.provider }}</p>
              <p><strong>Generated:</strong> {{ currentResult()?.generatedAt | date:'short' }}</p>
            </div>
            <div class="audio-controls">
              <div class="audio-player-wrapper">
                <audio
                  controls
                  class="audio-player"
                  [src]="currentResult()?.audioUrl"
                >
                  Your browser does not support the audio element.
                </audio>
              </div>
              <div class="custom-controls">
                <button 
                  class="control-btn play-btn" 
                  (click)="playAudio()"
                  [disabled]="audioState().isPlaying"
                >
                  {{ audioState().isPlaying ? '⏸️' : '▶️' }}
                </button>
                <button 
                  class="control-btn pause-btn" 
                  (click)="pauseAudio()"
                  [disabled]="!audioState().isPlaying"
                >
                  ⏸️
                </button>
                <span class="audio-time">
                  {{ formatTime(audioState().currentTime) }} / {{ formatTime(audioState().duration) }}
                </span>
              </div>
            </div>
            <div class="result-actions">
              <button class="action-btn download-btn" (click)="downloadAudio()">
                📥 Download
              </button>
              <button class="action-btn clear-btn" (click)="clearResult()">
                🗑️ Clear
              </button>
            </div>
          </div>
        </div>

        <div class="error-section" *ngIf="errorMessage()">
          <div class="error-card">
            <h3 class="error-title">Error</h3>
            <p class="error-message">{{ errorMessage() }}</p>
            <button class="error-dismiss" (click)="clearError()">Dismiss</button>
          </div>
        </div>        <!-- Development Status -->
        <div class="status-section" *ngIf="isDevelopment()">
          <div class="status-card">
            <h3 class="status-title">🔧 Development Status</h3>
            <div class="status-grid">
              <div class="status-item">
                <span class="status-label">Environment:</span>
                <span class="status-value">{{ applicationStatus().environment }}</span>
              </div>
              <div class="status-item">
                <span class="status-label">Zoneless:</span>
                <span class="status-value" [class.status-success]="applicationStatus().zoneless">
                  {{ applicationStatus().zoneless ? '✅ Active' : '❌ Zone.js detected' }}
                </span>
              </div>
              <div class="status-item">
                <span class="status-label">Provider:</span>
                <span class="status-value">{{ applicationStatus().provider }}</span>
              </div>
              <div class="status-item">
                <span class="status-label">Voice:</span>
                <span class="status-value">{{ applicationStatus().voice }}</span>
              </div>
              <div class="status-item">
                <span class="status-label">API Key:</span>
                <span class="status-value" [class.status-success]="applicationStatus().hasApiKey">
                  {{ applicationStatus().hasApiKey ? '✅ Configured' : '❌ Missing' }}
                </span>
              </div>
              <div class="status-item">
                <span class="status-label">Ready:</span>
                <span class="status-value" [class.status-success]="applicationStatus().canGenerate">
                  {{ applicationStatus().canGenerate ? '✅ Ready' : '❌ Not Ready' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .home-container {
      min-height: 100vh;
      background: #0d1117;
      color: #e6edf3;
      padding: 2rem;
    }

    .app-header {
      text-align: center;
      margin-bottom: 3rem;
    }

    .app-title {
      font-size: 2.5rem;
      font-weight: bold;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .title-icon {
      font-size: 2rem;
    }

    .app-subtitle {
      font-size: 1.125rem;
      color: #7d8590;
      margin: 0.5rem 0 0 0;
    }

    .main-content {
      max-width: 800px;
      margin: 0 auto;
    }

    .editor-section {
      margin-bottom: 2rem;
    }

    .input-group {
      margin-bottom: 1.5rem;
    }

    .input-label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
    }

    .text-input {
      width: 100%;
      padding: 1rem;
      background: #21262d;
      border: 1px solid #30363d;
      border-radius: 8px;
      color: #e6edf3;
      font-size: 1rem;
      resize: vertical;
      min-height: 120px;
    }

    .text-input:focus {
      outline: none;
      border-color: #58a6ff;
      box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.25);
    }

    .controls-section {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .settings-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .setting-group {
      display: flex;
      flex-direction: column;
    }

    .setting-label {
      margin-bottom: 0.5rem;
      font-weight: 500;
      font-size: 0.875rem;
    }

    .setting-select, .api-key-input {
      padding: 0.75rem;
      background: #21262d;
      border: 1px solid #30363d;
      border-radius: 6px;
      color: #e6edf3;
      font-size: 0.875rem;
    }

    .setting-select:focus, .api-key-input:focus {
      outline: none;
      border-color: #58a6ff;
      box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.25);
    }

    .api-key-group {
      display: flex;
      flex-direction: column;
    }

    .generate-btn {
      padding: 1rem 2rem;
      background: #238636;
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .generate-btn:hover:not(:disabled) {
      background: #2ea043;
    }

    .generate-btn:disabled {
      background: #30363d;
      color: #7d8590;
      cursor: not-allowed;
    }

    .generate-btn.loading {
      background: #6f42c1;
    }

    .result-section, .error-section {
      margin-top: 2rem;
    }

    .result-card, .error-card {
      background: #21262d;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 1.5rem;
    }

    .error-card {
      border-color: #f85149;
      background: #0d1117;
    }

    .result-title, .error-title {
      margin: 0 0 1rem 0;
      font-size: 1.125rem;
    }

    .error-title {
      color: #f85149;
    }

    .audio-player {
      width: 100%;
      margin-bottom: 1rem;
    }

    .result-actions {
      display: flex;
      gap: 0.5rem;
    }

    .action-btn {
      padding: 0.5rem 1rem;
      border: 1px solid #30363d;
      border-radius: 6px;
      background: #21262d;
      color: #e6edf3;
      cursor: pointer;
      font-size: 0.875rem;
    }

    .action-btn:hover {
      background: #30363d;
    }

    .download-btn:hover {
      border-color: #238636;
      color: #238636;
    }

    .clear-btn:hover {
      border-color: #f85149;
      color: #f85149;
    }

    .error-message {
      color: #f85149;
      margin: 0 0 1rem 0;
    }

    .error-dismiss {
      padding: 0.5rem 1rem;
      background: #f85149;
      border: none;
      border-radius: 6px;
      color: white;
      cursor: pointer;
    }

    .result-info {
      margin-bottom: 1rem;
      font-size: 0.875rem;
      color: #7d8590;
    }

    .result-info p {
      margin: 0.25rem 0;
    }

    .audio-controls {
      margin-bottom: 1.5rem;
    }

    .audio-player-wrapper {
      margin-bottom: 1rem;
    }

    .custom-controls {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .control-btn {
      padding: 0.5rem;
      background: #238636;
      border: none;
      border-radius: 6px;
      color: white;
      cursor: pointer;
      font-size: 1rem;
      min-width: 40px;
    }

    .control-btn:hover:not(:disabled) {
      background: #2ea043;
    }

    .control-btn:disabled {
      background: #30363d;
      cursor: not-allowed;
    }

    .audio-time {
      font-size: 0.875rem;
      color: #7d8590;
      font-family: monospace;
    }    .status-section {
      margin-top: 2rem;
      padding: 1.5rem;
      background: #21262d;
      border: 1px solid #30363d;
      border-radius: 8px;
    }

    .status-card {
      background: transparent;
      border: none;
      padding: 0;
    }

    .status-title {
      margin: 0 0 1rem 0;
      font-size: 1.125rem;
      color: #58a6ff;
    }

    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .status-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
    }

    .status-label {
      font-weight: 500;
      color: #7d8590;
      font-size: 0.875rem;
    }

    .status-value {
      font-weight: 600;
      color: #e6edf3;
      font-size: 0.875rem;
    }

    .status-success {
      color: #238636 !important;
    }

    @media (max-width: 640px) {
      .home-container {
        padding: 1rem;
      }

      .settings-row {
        grid-template-columns: 1fr;
      }

      .app-title {
        font-size: 2rem;
      }
    }
  `]
})
export class HomeComponent {
  // Inject TTS integration service
  private readonly ttsService = inject(TTSIntegrationService);
  
  // State signals
  inputText = signal('');
  selectedProvider = signal<ModelProvider>(ModelProvider.OPENAI);
  selectedVoice = signal<Voice>(Voice.ALLOY);
  apiKey = signal('');
  errorMessage = signal('');
  showAdvanced = signal(false);

  // TTS service state
  serviceState = this.ttsService.serviceState;
  audioState = this.ttsService.audioState;
  // Computed properties
  canGenerate = computed(() => {
    const hasText = this.inputText().trim().length > 0;
    const isNotGenerating = !this.serviceState().isGenerating;
    
    // Edge TTS doesn't require API key
    if (this.selectedProvider() === ModelProvider.EDGE) {
      return hasText && isNotGenerating;
    }
    
    // Other providers require API key
    const hasApiKey = this.apiKey().trim().length > 0;
    return hasText && hasApiKey && isNotGenerating;
  });

  isProcessing = computed(() => this.serviceState().isGenerating);
  
  // Available voices based on selected provider
  availableVoices = computed(() => {
    switch (this.selectedProvider()) {
      case ModelProvider.OPENAI:
        return [
          { value: Voice.ALLOY, label: 'Alloy' },
          { value: Voice.ECHO, label: 'Echo' },
          { value: Voice.FABLE, label: 'Fable' },
          { value: Voice.ONYX, label: 'Onyx' },
          { value: Voice.NOVA, label: 'Nova' },
          { value: Voice.SHIMMER, label: 'Shimmer' }
        ];
      case ModelProvider.ELEVENLABS:
        return [
          { value: Voice.ALLOY, label: 'Alloy' },
          { value: Voice.ECHO, label: 'Echo' },
          { value: Voice.FABLE, label: 'Fable' },
          { value: Voice.ONYX, label: 'Onyx' },
          { value: Voice.NOVA, label: 'Nova' },
          { value: Voice.SHIMMER, label: 'Shimmer' }
        ];
      case ModelProvider.EDGE:
        return [
          { value: Voice.ARIA, label: 'Aria' },
          { value: Voice.JENNY, label: 'Jenny' },
          { value: Voice.GUY, label: 'Guy' },
          { value: Voice.DAVIS, label: 'Davis' },
          { value: Voice.JANE, label: 'Jane' },
          { value: Voice.JASON, label: 'Jason' },
          { value: Voice.NANCY, label: 'Nancy' },
          { value: Voice.TONY, label: 'Tony' },
          { value: Voice.SONIA, label: 'Sonia' },
          { value: Voice.RYAN, label: 'Ryan' }
        ];
      default:
        return [
          { value: Voice.ALLOY, label: 'Alloy' },
          { value: Voice.ECHO, label: 'Echo' },
          { value: Voice.FABLE, label: 'Fable' },
          { value: Voice.ONYX, label: 'Onyx' },
          { value: Voice.NOVA, label: 'Nova' },
          { value: Voice.SHIMMER, label: 'Shimmer' }
        ];
    }
  });
  
  currentResult = computed(() => {
    const lastGeneration = this.serviceState().lastGeneration;
    if (!lastGeneration) return null;
    
    // Create object URL for audio playback
    const blob = new Blob([lastGeneration.response.audioData], { 
      type: 'audio/mpeg' 
    });
    const audioUrl = URL.createObjectURL(blob);
    
    return {
      audioUrl,
      text: lastGeneration.query.text,
      generatedAt: lastGeneration.generatedAt,
      provider: lastGeneration.provider
    };
  });
  // Status computed properties
  isZoneless = computed(() => {
    // SSR-safe zone.js detection
    if (typeof globalThis === 'undefined') {
      return true; // Assume zoneless during SSR
    }
    return typeof (globalThis as unknown as { Zone?: unknown }).Zone === 'undefined';
  });
    isDevelopment = computed(() => {
    // SSR-safe development detection
    if (typeof window === 'undefined') {
      return true; // Assume development during SSR
    }
    return !window.location.hostname.includes('github.io') && 
           (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  });
  
  applicationStatus = computed(() => ({
    environment: this.isDevelopment() ? 'development' : 'production',
    zoneless: this.isZoneless(),
    provider: this.selectedProvider(),
    voice: this.selectedVoice(),
    hasApiKey: this.apiKey().length > 0,
    canGenerate: this.canGenerate(),
    isProcessing: this.isProcessing()
  }));
  constructor() {
    // Initialize TTS and Storage services
    const initResult = this.ttsService.initialize();
    if (!initResult.isSuccess) {
      console.warn('TTS service initialization failed:', initResult.error);
      this.errorMessage.set(`Service initialization failed: ${initResult.error}`);
    }
  }
  // Event handlers
  onTextChange(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.inputText.set(target.value);
  }  onProviderChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const providerValue = target.value;
    
    // Map string values to ModelProvider enum
    switch (providerValue) {
      case 'openai':
        this.selectedProvider.set(ModelProvider.OPENAI);
        this.selectedVoice.set(Voice.ALLOY);
        break;
      case 'elevenlabs':
        this.selectedProvider.set(ModelProvider.ELEVENLABS);
        this.selectedVoice.set(Voice.ALLOY);
        break;
      case 'edge':
        this.selectedProvider.set(ModelProvider.EDGE);
        this.selectedVoice.set(Voice.ARIA);
        break;
      default:
        this.selectedProvider.set(ModelProvider.OPENAI);
        this.selectedVoice.set(Voice.ALLOY);
    }
  }
  onVoiceChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const voiceValue = target.value;
    
    // Map string values to Voice enum
    switch (voiceValue) {
      // OpenAI voices
      case 'alloy':
        this.selectedVoice.set(Voice.ALLOY);
        break;
      case 'echo':
        this.selectedVoice.set(Voice.ECHO);
        break;
      case 'fable':
        this.selectedVoice.set(Voice.FABLE);
        break;
      case 'onyx':
        this.selectedVoice.set(Voice.ONYX);
        break;
      case 'nova':
        this.selectedVoice.set(Voice.NOVA);
        break;
      case 'shimmer':
        this.selectedVoice.set(Voice.SHIMMER);
        break;
      // Edge TTS voices
      case 'aria':
        this.selectedVoice.set(Voice.ARIA);
        break;
      case 'jenny':
        this.selectedVoice.set(Voice.JENNY);
        break;
      case 'guy':
        this.selectedVoice.set(Voice.GUY);
        break;
      case 'davis':
        this.selectedVoice.set(Voice.DAVIS);
        break;
      case 'jane':
        this.selectedVoice.set(Voice.JANE);
        break;
      case 'jason':
        this.selectedVoice.set(Voice.JASON);
        break;
      case 'nancy':
        this.selectedVoice.set(Voice.NANCY);
        break;
      case 'tony':
        this.selectedVoice.set(Voice.TONY);
        break;
      case 'sonia':
        this.selectedVoice.set(Voice.SONIA);
        break;
      case 'ryan':
        this.selectedVoice.set(Voice.RYAN);
        break;
      default:
        this.selectedVoice.set(Voice.ALLOY);
    }
  }

  onApiKeyChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.apiKey.set(target.value);
  }  async generateSpeech(): Promise<void> {
    if (!this.canGenerate()) return;    this.errorMessage.set('');

    try {
      // Configure the selected provider
      const configResult = this.ttsService.configureProvider({
        provider: this.selectedProvider(),
        apiKey: this.apiKey(),
        isEnabled: true
      });

      if (!configResult.isSuccess) {
        this.errorMessage.set(configResult.error);
        return;
      }      // Create TTS query
      const queryId = QueryId.generate();
      const settings: TTSSettings = {
        provider: this.selectedProvider(),
        model: 'standard',
        voice: this.selectedVoice(),
        apiKey: this.apiKey(),
        speed: 1.0
      };

      const query = new TTSQuery(queryId.getValue(), this.inputText(), settings);

      // Generate TTS
      const generationSignal = this.ttsService.generateTTS(query, this.selectedProvider());
      
      // Monitor the generation result
      const result = generationSignal();
      if (!result.isSuccess && result.error !== 'Generation in progress...') {
        this.errorMessage.set(result.error);
      }

    } catch (error) {
      this.errorMessage.set(`Failed to generate speech: ${error}`);
    }
  }

  playAudio(): void {
    const result = this.ttsService.playAudio();
    if (!result.isSuccess) {
      this.errorMessage.set(result.error);
    }
  }

  pauseAudio(): void {
    const result = this.ttsService.pauseAudio();
    if (!result.isSuccess) {
      this.errorMessage.set(result.error);
    }
  }

  downloadAudio(): void {
    const result = this.currentResult();
    if (!result) return;

    const downloadResult = this.ttsService.downloadAudio(`tts-${Date.now()}.mp3`);
    if (!downloadResult.isSuccess) {
      this.errorMessage.set(downloadResult.error);
    }
  }

  clearResult(): void {
    this.ttsService.stopAudio();
  }
  clearError(): void {
    this.errorMessage.set('');
  }

  formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}
