import { Component, signal, computed, output, input, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HISTORY_STORAGE_TOKEN } from '../../integration/tokens';
import { IHistoryStorage } from '../../integration/interfaces';
import { ModalService } from '../../integration/modal.service';
import { HistoryListAreaComponent } from './components/history-list-area/history-list-area.component';
import { StorageInfoComponent } from './components/storage-info/storage-info.component';
import { FileSystemManagerComponent } from './components/file-system-manager/file-system-manager.component';
import { HistoryItem, FolderReconnectionPrompt } from '../../integration/domain-types';
import { HistoryInteractionManagerService } from '../home/services/history-interaction-manager.service';

@Component({
  selector: 'app-history-panel',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    HistoryListAreaComponent, 
    StorageInfoComponent, 
    FileSystemManagerComponent
  ],
  templateUrl: './history-panel.component.html',
  styleUrls: ['./history-panel.component.scss']
})
export class HistoryPanelComponent {
  private historyInteractionManager = inject(HistoryInteractionManagerService);
  
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
  private readonly _showDeleteModal = signal(false);
  private readonly _showClearModal = signal(false);

  // Public accessors for template
  readonly searchQuery = computed(() => this._searchQuery());
  readonly selectedItemId = computed(() => this.historyInteractionManager.selectedHistoryItem()?.id || null);
  readonly showDeleteModal = computed(() => this._showDeleteModal());
  readonly showClearModal = computed(() => this._showClearModal());
  readonly filteredHistory = computed(() => {
    const query = this._searchQuery().toLowerCase();
    if (!query) return this.historyItems();
    
    return this.historyItems().filter(item => 
      item.text.toLowerCase().includes(query) ||
      (item.metadata?.title && item.metadata.title.toLowerCase().includes(query))
    );
  });

  // Reactive state derived from history service signals
  readonly historyItems = computed(() => this.historyService.items());
  readonly storage = computed(() => this.historyService.storage());
  readonly fileSystem = computed(() => this.historyService.fileSystem());
  private readonly promptSignal = computed(() => this.historyService.reconnection());

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
  });  constructor(
    @Inject(HISTORY_STORAGE_TOKEN) private historyService: IHistoryStorage,
    private modalService: ModalService
  ) {
    // Set up signal monitoring for reconnection prompts
    // This will monitor the signal value and show modal when needed
    this.monitorReconnectionPrompt();
  }

  private monitorReconnectionPrompt(): void {
    // Check for existing prompt immediately
    const currentPrompt = this.promptSignal();
    if (currentPrompt?.shouldPrompt) {
      this.showReconnectionModal(currentPrompt);
    }
    
    // Monitor for future changes by setting up a signal subscription pattern
    // Since we're signal-first, we'll use a simple interval check
    // This is better than effects for this architectural pattern
    let lastPromptState: FolderReconnectionPrompt | null = currentPrompt;
    
    const checkPromptChanges = () => {
      const newPrompt = this.promptSignal();
      
      // Check if prompt state changed and we need to show modal
      if (newPrompt?.shouldPrompt && 
          (!lastPromptState || !lastPromptState.shouldPrompt)) {
        this.showReconnectionModal(newPrompt);
      }
      
      lastPromptState = newPrompt;
    };
    
    // Check every 500ms for prompt changes
    setInterval(checkPromptChanges, 500);
  }

  private showReconnectionModal(prompt: FolderReconnectionPrompt): void {
    this.modalService.showComponent({
      type: 'component',
      componentType: 'ReconnectionPromptModal',
      data: prompt,
      allowDismiss: false
    });
  }

  // Event handlers
  onSearchQueryChange(query: string): void {
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
    const state = this.fileSystem();
    if (state.isEnabled) {
      this.historyService.disableFileSystemStorage();
    } else {
      this.historyService.enableFileSystemStorage();
    }
  }  async onChangeFolder(): Promise<void> {
    await this.historyService.enableFileSystemStorage();
  }

  async onReconnectConfirm(shouldReconnect: boolean): Promise<void> {
    await this.historyService.handleFolderReconnection(shouldReconnect);
  }

  deleteItem(item: HistoryItem): void {
    this._itemToDelete.set(item);
    this._showDeleteModal.set(true);
  }

  onDeleteItemConfirm(): void {
    const item = this._itemToDelete();
    if (item) {
      this.historyService.deleteHistoryItem(item.id);
      this._showDeleteModal.set(false);
      this._itemToDelete.set(null);
    }
  }

  cancelDeleteItem(): void {
    this._showDeleteModal.set(false);
    this._itemToDelete.set(null);
  }
  // Show the confirmation modal before clearing all history
  onClearAllConfirm(): void {
    // First check if we have any history to clear
    if (this.historyItems().length === 0) {
      return; // Nothing to clear
    }
    
    // Show the confirmation modal
    this._showClearModal.set(true);
  }

  // Actually confirm and perform the clear operation
  confirmClearAll(): void {
    this.historyService.clearHistory();
    this._showClearModal.set(false);
  }

  cancelClearAll(): void {
    this._showClearModal.set(false);
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
}
