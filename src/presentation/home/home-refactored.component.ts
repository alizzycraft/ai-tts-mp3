// Refactored Home Component - coordinates focused services for TTS functionality
import { Component, signal, computed, inject, ViewChild, PLATFORM_ID, OnInit, AfterViewInit, ElementRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HistoryPanelComponent } from '../history-panel/history-panel.component';
import { SettingsPanelComponent } from '../settings-panel/settings-panel.component';
import { EditorComponent } from '../editor/editor.component';
import { AudioPlayerComponent } from '../audio-player/audio-player.component';
import { TruncateTextPipe } from '../shared/pipes/truncate-text.pipe';
import { FormatDatePipe } from '../shared/pipes/format-date.pipe';
import { FormatFileSizePipe } from '../shared/pipes/format-file-size.pipe';
import { HistoryItem } from '../../integration/history-storage.service';

// Import focused services
import { TTSGenerationManagerService, GenerationResult } from '../features/tts-generation/services/tts-generation-manager.service';
import { HistoryInteractionManagerService } from '../features/history-management/services/history-interaction-manager.service';
import { SettingsIntegrationManagerService } from '../features/settings-management/services/settings-integration-manager.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule, 
    HistoryPanelComponent, 
    SettingsPanelComponent, 
    EditorComponent, 
    AudioPlayerComponent, 
    TruncateTextPipe, 
    FormatDatePipe, 
    FormatFileSizePipe
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, AfterViewInit {
  @ViewChild(HistoryPanelComponent) private historyPanel?: HistoryPanelComponent;

  // Inject focused services
  private ttsGenerationManager = inject(TTSGenerationManagerService);
  private historyInteractionManager = inject(HistoryInteractionManagerService);
  private settingsIntegrationManager = inject(SettingsIntegrationManagerService);
  private platformId = inject(PLATFORM_ID);
  
  private isBrowser = isPlatformBrowser(this.platformId);

  // Component state
  inputText = signal('');
  showRemovalPreview = false;

  // Computed properties that delegate to focused services
  canGenerate = computed(() => {
    return this.ttsGenerationManager.canGenerate(this.inputText(), this.isBrowser);
  });

  // Expose service state through computed properties
  isProcessing = computed(() => this.ttsGenerationManager.isProcessing());
  currentResult = computed(() => this.ttsGenerationManager.currentResult());
  errorMessage = computed(() => this.ttsGenerationManager.errorMessage());
  storageWarning = computed(() => this.ttsGenerationManager.storageWarning()());
  currentQueryInfo = computed(() => this.historyInteractionManager.currentQueryInfo());

  constructor(private elementRef: ElementRef) {
    // Initialization logic that is safe for both browser and SSR
  }

  ngOnInit() {
    // Code that should only run in the browser
    if (this.isBrowser) {
      this.initializeBrowserFeatures();
    }
  }

  ngAfterViewInit() {
    // Additional browser-specific initialization after view is ready
    if (this.isBrowser) {
      this.loadSavedSettings();
    }
  }

  // Text editor event handlers
  onTextChange(text: string) {
    this.inputText.set(text);
  }

  // Generation workflow - delegate to TTSGenerationManagerService
  async generateSpeech() {
    if (!this.canGenerate()) {
      return;
    }

    const result: GenerationResult = await this.ttsGenerationManager.generateSpeech(this.inputText());

    if (result.success && result.result && result.historyItem) {
      // Update history interaction manager with the new result
      this.historyInteractionManager.updateQueryInfoFromGeneration(
        this.inputText(),
        result.result,
        result.historyItem.metadata?.title,
        result.historyItem.settings
      );

      // If not saving to history, set as temporary item
      if (!result.historyItem.id) { // No ID means it wasn't saved to history
        this.historyInteractionManager.setTempHistoryItem(result.historyItem);
        
        // Clear any existing selection in the history panel
        if (this.historyPanel) {
          this.historyPanel.clearSelection();
        }
      }
    }
  }

  // Storage warning methods - delegate to TTSGenerationManagerService
  dismissStorageWarning(): void {
    this.ttsGenerationManager.dismissStorageWarning();
  }

  cancelGeneration(): void {
    this.showRemovalPreview = false;
    this.ttsGenerationManager.cancelGeneration();
  }

  async proceedWithGeneration(): Promise<void> {
    this.showRemovalPreview = false;
    await this.generateSpeech(); // This will now proceed without storage check
  }

  // History interaction methods - delegate to HistoryInteractionManagerService
  async onHistoryItemSelected(item: HistoryItem | null): Promise<void> {
    await this.historyInteractionManager.selectHistoryItem(item);
    
    // Update input text with the selected item's text
    if (item) {
      this.inputText.set(item.text);
    }
  }

  async onHistoryPanelPlayItem(item: HistoryItem): Promise<void> {
    await this.historyInteractionManager.playHistoryItem(item);
    
    // Update input text and ensure item is selected in panel
    this.inputText.set(item.text);
  }

  clearResult() {
    this.ttsGenerationManager.clearResult();
    this.historyInteractionManager.clearAll();
  }

  // Private helper methods
  private async initializeBrowserFeatures(): Promise<void> {
    try {
      // Any browser-specific initialization that doesn't require settings
      console.log('[HomeComponent] Browser features initialized');
    } catch (error) {
      console.error('[HomeComponent] Error initializing browser features:', error);
    }
  }

  private async loadSavedSettings(): Promise<void> {
    if (!this.isBrowser) return;
    
    try {
      await this.settingsIntegrationManager.loadSavedSettings();
      console.log('[HomeComponent] Settings loaded successfully');
    } catch (error) {
      console.error('[HomeComponent] Failed to load saved settings:', error);
    }
  }

  // Utility methods for template access
  getSettingsSummary() {
    return this.settingsIntegrationManager.getSettingsSummary();
  }

  getCurrentItem(): HistoryItem | null {
    return this.historyInteractionManager.getCurrentItem();
  }

  hasSelection(): boolean {
    return this.historyInteractionManager.hasSelection();
  }
}
