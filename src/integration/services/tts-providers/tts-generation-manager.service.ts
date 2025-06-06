// TTS Generation Manager - handles the speech generation workflow
import { Injectable, signal, computed, inject } from '@angular/core';
import { AngularTTSService } from '../audio/angular-tts.service';
import { IHistoryStorageService } from '../../../domain/contracts/interfaces/services/history-storage.interface';
import { HISTORY_STORAGE_SERVICE } from '../../../domain/contracts/tokens/history-storage.token';
import { SettingsService } from '../settings/settings.service';
import { PlaybackService } from '../audio/playback.service';
import { 
  TTSSettings, 
  TTSResult
} from '../../types/tts.types';
import { HistoryItem } from '../../../domain/types/storage-types';
import { ApiKey } from '../../../common/value-objects/text/api-key';

export interface GenerationResult {
  success: boolean;
  result?: TTSResult;
  error?: string;
  warnings?: string[];
  historyItem?: HistoryItem;
}

export interface StorageWarning {
  level: 'warning' | 'critical';
  message: string;
  itemsToRemove?: HistoryItem[];
}

@Injectable({
  providedIn: 'root'
})
export class TTSGenerationManagerService {
  private ttsService = inject(AngularTTSService);
  private historyService = inject<IHistoryStorageService>(HISTORY_STORAGE_SERVICE);
  private settingsService = inject(SettingsService);
  private playbackService = inject(PlaybackService);

  // State signals
  isProcessing = signal(false);
  currentResult = signal<TTSResult | null>(null);
  errorMessage = signal('');
  private storageWarningState = signal<StorageWarning | null>(null);

  // Computed properties
  get storageWarning() {
    return computed(() => this.storageWarningState());
  }

  /**
   * Check if generation is possible
   */
  canGenerate(inputText: string, isBrowser: boolean): boolean {
    return inputText.trim().length > 0 &&
           this.settingsService.apiKey().trim().length > 0 && 
           !this.isProcessing() &&
           isBrowser;
  }

  /**
   * Initiate speech generation with storage check
   */
  async generateSpeech(inputText: string): Promise<GenerationResult> {
    if (!this.canGenerate(inputText, true)) {
      return { success: false, error: 'Cannot generate speech at this time' };
    }

    try {
      this.isProcessing.set(true);
      this.errorMessage.set('');
      this.storageWarningState.set(null);
      this.currentResult.set(null);

      // Check storage before generation if saving to history
      if (this.settingsService.saveToHistory()) {
        const estimatedSize = inputText.length * 100; // Rough estimate: 100 bytes per character
        const itemsToRemove = this.historyService.getItemsToBeRemoved(estimatedSize);
        
        if (itemsToRemove.length > 0) {
          const storageInfo = this.historyService.getStorageInfo();
          const level = storageInfo.usedPercentage > 0.9 ? 'critical' : 'warning';
          const message = `Storage ${Math.round(storageInfo.usedPercentage * 100)}% full. ${itemsToRemove.length} item(s) will be removed.`;
          
          this.storageWarningState.set({
            level,
            message,
            itemsToRemove
          });
          
          this.isProcessing.set(false);
          return { success: false, error: 'Storage warning requires user confirmation' };
        }
      }

      return await this.proceedWithGeneration(inputText);

    } catch (error) {
      console.error('[TTSGenerationManager] Error in generateSpeech:', error);
      this.errorMessage.set(error instanceof Error ? error.message : 'Unknown error occurred');
      this.isProcessing.set(false);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
    }
  }

  /**
   * Proceed with generation after storage warning confirmation
   */
  async proceedWithGeneration(inputText: string): Promise<GenerationResult> {
    try {
      this.storageWarningState.set(null);
      
      const settings: TTSSettings = {
        provider: this.settingsService.selectedProvider(),
        model: this.settingsService.selectedModel(),
        voice: this.settingsService.selectedVoice(),
        apiKey: ApiKey.fromString(this.settingsService.apiKey())
      };

      // Save settings for next time
      await this.ttsService.saveSettings(settings);

      // Capture title before it might get cleared
      const currentTitle = this.settingsService.historyTitle() || undefined;
      
      // Generate speech
      const result = await this.ttsService.generateSpeech(inputText, settings);
      if (!result) {
        this.errorMessage.set('Failed to generate speech');
        this.isProcessing.set(false);
        return { success: false, error: 'Failed to generate speech' };
      }

      // Set audio player data immediately with the generated result
      this.currentResult.set(result);

      // Load audio in the player to get duration and make it ready for playback
      await this.playbackService.loadAudio(result, result.queryId?.getValue());

      // Update result with actual duration
      const actualDuration = this.playbackService.totalDuration();
      const updatedResult: TTSResult = {
        ...result,
        duration: actualDuration,
        fileSize: result.audioData?.byteLength || 0
      };

      this.currentResult.set(updatedResult);

      // Create the HistoryItem object
      const historyItem: HistoryItem = {
        id: updatedResult.queryId?.getValue(),
        text: inputText,
        settings: {
          provider: settings.provider,
          model: settings.model,
          voice: settings.voice,
        },
        result: updatedResult,
        createdAt: new Date(),
        audioSize: updatedResult.fileSize || 0,
        metadata: currentTitle ? { title: currentTitle } : undefined,
      };

      let warnings: string[] = [];

      // Add the item to history if saving is enabled
      if (this.settingsService.saveToHistory()) {
        const historyResult = await this.historyService.addToHistory(
          historyItem.text,
          historyItem.settings!,
          historyItem.result,
          {
            title: historyItem.metadata?.title,
          }
        );

        if (historyResult.warnings && historyResult.warnings.length > 0) {
          warnings = historyResult.warnings;
          console.warn('[TTSGenerationManager] History warnings:', warnings);
        }

        // Clear the title after saving
        this.settingsService.historyTitle.set('');
      }

      this.isProcessing.set(false);

      return {
        success: true,
        result: updatedResult,
        warnings,
        historyItem
      };

    } catch (error) {
      console.error('[TTSGenerationManager] Error in proceedWithGeneration:', error);
      this.errorMessage.set(error instanceof Error ? error.message : 'Unknown error occurred');
      this.isProcessing.set(false);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
    }
  }

  /**
   * Dismiss storage warning
   */
  dismissStorageWarning(): void {
    this.storageWarningState.set(null);
  }

  /**
   * Cancel generation
   */
  cancelGeneration(): void {
    this.storageWarningState.set(null);
    this.isProcessing.set(false);
  }

  /**
   * Clear current result and error state
   */
  clearResult(): void {
    this.currentResult.set(null);
    this.errorMessage.set('');
  }

  /**
   * Get current processing state
   */  getProcessingState() {
    return {
      isProcessing: this.isProcessing(),
      currentResult: this.currentResult(),
      errorMessage: this.errorMessage(),
      storageWarning: this.storageWarning()
    };
  }
}