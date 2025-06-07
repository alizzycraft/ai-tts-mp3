import { Component, signal, computed, output, input, inject, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HISTORY_STORAGE_SERVICE } from '../../../../integration/tokens/history-storage.token';
import { IHistoryStorageService } from '../../../../integration/interfaces/services/history-storage.interface';
import { ModalService } from '../../../../integration/services/ui/modal.service';
import { HistoryListAreaComponent } from './components/history-list-area/history-list-area.component';
import { StorageInfoComponent } from './components/storage-info/storage-info.component';
import { FileSystemManagerComponent } from './components/file-system-manager/file-system-manager.component';
import { HistoryInteractionManagerService } from '../../../../integration/services/storage/history-interaction-manager.service';
import { FolderReconnectionPrompt } from '../../../../integration/interfaces/models/folder-reconnection-prompt.interface';
import { HistoryItem } from '../../../../integration/types/domain-types';
import { StorageStateIntegrationService } from '../../../../integration/services/storage/storage-state-integration.service';
import { StorageInitializationStateService } from '../../../../infrastructure/storage/storage-initialization-state.service';

@Component({
  selector: 'app-history-panel',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    HistoryListAreaComponent, 
    StorageInfoComponent, 
    FileSystemManagerComponent
    // ReconnectionPromptModalComponent removed: modal is now global only
  ],
  templateUrl: './history-panel.component.html',
  styleUrls: ['./history-panel.component.scss']
})
export class HistoryPanelComponent {  private historyService = inject<IHistoryStorageService>(HISTORY_STORAGE_SERVICE);
  private modalService = inject(ModalService);

  private historyInteractionManager = inject(HistoryInteractionManagerService);
  private initializationState = inject(StorageInitializationStateService);
  
  // Outputs for parent component communication
  historyItemSelected = output<HistoryItem>();
  playItem = output<HistoryItem>();
  downloadItem = output<HistoryItem>();
  
  // Selection state
  private _selectedItemId = signal<string | null>(null);
  
  // Inputs
  readonly playingItemId = input<string | null>();
  readonly isPlaying = input<boolean>();

  // Core state signals
  private readonly _searchQuery = signal('');
  private readonly _itemToDelete = signal<HistoryItem | null>(null); 

  // Public accessors for template
  readonly searchQuery = computed(() => this._searchQuery());
  readonly selectedItemId = computed(() => this.historyInteractionManager.selectedHistoryItem()?.id || null);
  readonly filteredHistory = computed(() => {
    const query = this._searchQuery().toLowerCase();
    const items = this.historyItems();
    console.log('[SIGNAL][HistoryPanelComponent] filteredHistory SIGNAL EMIT:', items, query);
    if (items.length > 0) {
      for (const item of items) {
        console.log('[HistoryPanelComponent] Item:', item, 'text:', item.text, 'typeof text:', typeof item.text);
      }
    }
    if (!query) return items;
    return items.filter(item => 
      typeof item.text === 'string' && item.text.toLowerCase().includes(query) ||
      (item.metadata?.title && item.metadata.title.toLowerCase().includes(query))
    );
  });

  // Reactive state derived from history service signals
  readonly historyItems = this.historyService.items;
  readonly storage = computed(() => this.historyService.storage());
  readonly fileSystem = computed(() => this.historyService.fileSystem());
  private readonly promptSignal = computed(() => this.historyService.reconnection());
  readonly historyLoaded = computed(() => this.historyService.historyLoaded ? this.historyService.historyLoaded() : true);

  // Computed UI state  
  readonly storageWarningLevel = computed(() => {
    const storage = this.storage();
    const percentage = storage.used / (storage.used + storage.available);
    if (percentage > 0.9) return 'critical';
    if (percentage > 0.8) return 'warning';
    return 'normal';
  });

  readonly showStorageBar = computed(() => !this.fileSystem().isEnabled);  readonly storageInfo = computed(() => {
    const storage = this.storage();
    const fileSystem = this.fileSystem();
    const items = this.historyItems();

    return {
      used: storage.used,
      available: storage.available,
      isFileSystem: fileSystem.isEnabled,
      usedPercentage: storage.used / (storage.used + storage.available),
      itemCount: items.length,
      folderName: fileSystem.selectedPath || undefined
    };
  });  // UI state for modal and loading
  readonly initState = computed(() => {
    const state = this.initializationState.state();
    console.log('[SIGNAL][HistoryPanelComponent] initState SIGNAL EMIT:', state);
    return state;
  });
  get showReconnectionModal() {
    const s = this.initState();
    const result = s.waitingForReconnectionPrompt && !!s.reconnectionPrompt;
    console.log('[SIGNAL][HistoryPanelComponent] showReconnectionModal SIGNAL EMIT:', result, s);
    return result;
  }
  get showLoadingSpinner() {
    const s = this.initState();
    const result = s.isInitializing;
    console.log('[SIGNAL][HistoryPanelComponent] showLoadingSpinner SIGNAL EMIT:', result, s);
    return result;
  }

  constructor() {
    // No polling, no effect, state-driven only
  }

  // Event handlers
  onSearchQueryChange(query: string): void {
    console.log('[STATE][HistoryPanelComponent] _searchQuery set:', query);
    this._searchQuery.set(query);
  }

  async onItemSelect(item: HistoryItem): Promise<void> {
    try {
      this.historyInteractionManager.clearSelection();
      await this.historyInteractionManager.selectHistoryItem(item);
      this._selectedItemId.set(item.id);
      this.historyItemSelected.emit(item);
    } catch (error) {
      console.error('[HistoryPanel] Error selecting item:', error);
    }
  }
  async onPlayItemClick(item: HistoryItem): Promise<void> {
    try {
      // Just call the historyInteractionManager to handle the playback directly
      // No need to emit an event as we're handling it here
      await this.historyInteractionManager.playHistoryItem(item);
    } catch (error) {
      console.error('[HistoryPanel] Error playing item:', error);
    }
  }

  async onDownloadItemClick(item: HistoryItem): Promise<void> {
    await this.historyInteractionManager.downloadHistoryItem(item);
    this.downloadItem.emit(item);
  }

  onToggleStorage(): void {
    const state = this.fileSystem();    if (state.isEnabled) {
      this.historyService.disableFileSystemStorage();
    } else {
      this.historyService.enableFileSystemStorage();
    }
  }

  async onChangeFolder(): Promise<void> {
    await this.historyService.enableFileSystemStorage();
  }

  async onReconnectConfirm(shouldReconnect: boolean): Promise<void> {
    await this.historyService.handleFolderReconnection(shouldReconnect);
  }

  // Helper: show a queue-based confirmation modal
  private showConfirmationModal(title: string, message: string): Promise<boolean> {
    return new Promise(resolve => {
      // Create a template ref for the modal content
      // For now, use window.confirm as a placeholder
      // In a real app, you would use a dedicated modal component or ng-template
      const confirmed = window.confirm(message);
      resolve(confirmed);
    });
  }

  async deleteItem(item: HistoryItem): Promise<void> {
    const confirmed = await this.showConfirmationModal('Delete Item', 'Are you sure you want to delete this item from history? This action cannot be undone.');
    if (confirmed) {
      this.historyService.deleteHistoryItem(item.id);
    }
  }

  async onClearAllConfirm(): Promise<void> {
    if (this.historyItems().length === 0) return;
    const confirmed = await this.showConfirmationModal('Clear All History', 'Are you sure you want to clear all history? This action cannot be undone.');
    if (confirmed) {
      this.historyService.clearHistory();
    }
  }

  clearSelection(): void {
    this.historyInteractionManager.clearSelection();
  }

  handlePlayItem(event: { item: HistoryItem; event: Event }): void {
    event.event.preventDefault();
    event.event.stopPropagation();
    this.playItem.emit(event.item);
  }

  protected getItemCount(): number {
    return this.historyItems().length;
  }

  protected formatSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  updateSearchQuery(query: string): void {
    this._searchQuery.set(query);
  }

  public storageStateIntegration = inject(StorageStateIntegrationService);
}
