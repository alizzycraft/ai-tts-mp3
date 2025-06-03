import { Component, ChangeDetectionStrategy, computed, input, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StorageInfoComponent } from './components/storage-info/storage-info.component';
import { FileSystemManagerComponent } from './components/file-system-manager/file-system-manager.component';
import { HistoryListAreaComponent } from './components/history-list-area/history-list-area.component';
import { ModelProvider } from '../../domain/tts.entity';
import { ModalService } from '../../shared/modal.service';
import { IntegratedHistoryStorageService } from '../../integration/history-storage.service';
import { StorageInfo, HistoryItem } from '../../infrastructure/storage/storage-types';
import { FileSystemStorageState, FolderReconnectionPrompt } from '../../infrastructure/storage/storage-state.service';

@Component({
  selector: 'app-history-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    StorageInfoComponent,
    FileSystemManagerComponent,
    HistoryListAreaComponent
  ],
  templateUrl: './history-panel.component.html',
  styleUrl: './history-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HistoryPanelComponent {
  // Inputs
  playingItemId = input<string | null>(null);
  isPlaying = input<boolean>(false);

  // Outputs
  historyItemSelected = output<HistoryItem | null>();
  playItem = output<HistoryItem>();
  // Services
  private modalService = inject(ModalService);
  private historyService = inject(IntegratedHistoryStorageService);
  // State signals
  searchQuery = signal('');
  selectedItemId = signal<string | null>(null);
  showDeleteModal = signal(false);
  showClearModal = signal(false);
  itemToDelete = signal<HistoryItem | null>(null);
  history = signal<HistoryItem[]>([]);
  storageInfo = signal<StorageInfo>({ used: 0, available: 0, total: 0, usedPercentage: 0, itemCount: 0 });
  fileSystemState = signal<FileSystemStorageState>({ 
    isSupported: false, 
    isEnabled: false, 
    selectedPath: null,
    directoryHandle: null
  });

  // Modal state management
  private modalRequestId = signal<string | null>(null);
  private waitingForModalResponse = signal(false);

  // Computed values
  filteredHistory = computed(() => {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.history();
    
    return this.history().filter(item => 
      item.text.toLowerCase().includes(query) ||
      item.metadata?.title?.toLowerCase().includes(query) ||
      item.metadata?.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  });

  storageWarningLevel = computed(() => {
    const percentage = this.storageInfo().usedPercentage;
    if (percentage > 0.9) return 'critical';
    if (percentage > 0.8) return 'warning';
    return 'normal';
  });
  showStorageBar = computed(() => {
    return !this.fileSystemState().isEnabled;
  });

  // Modal response handling - purely signal-based
  private modalResponseHandler = computed(() => {
    const response = this.modalService.response();
    const currentRequestId = this.modalRequestId();
    const waiting = this.waitingForModalResponse();

    if (response && currentRequestId && waiting && response.requestId === currentRequestId) {
      // Handle modal response
      this.handleModalResponse(response.value);
      // Clear the response and reset state
      this.modalService.clearResponse();
      this.modalRequestId.set(null);
      this.waitingForModalResponse.set(false);
    }
  });
  // Lifecycle methods
  constructor() {
    // Subscribe to history service
    this.historyService.history$.subscribe((items: HistoryItem[]) => this.history.set(items));
    this.historyService.storageInfo$.subscribe((info: StorageInfo) => this.storageInfo.set(info));
    this.historyService.fileSystemState$.subscribe((state: FileSystemStorageState) => this.fileSystemState.set(state));

    // Handle folder reconnection prompts using signals
    this.historyService.folderReconnectionPrompt$.subscribe((prompt: FolderReconnectionPrompt | null) => {
      if (!prompt) return;
      this.showReconnectionModal(prompt);
    });

    // Trigger the modal response handler computation
    this.modalResponseHandler();
  }

  // Modal response handler
  private handleModalResponse(value: unknown): void {
    if (typeof value === 'boolean') {
      // This is a reconnection confirmation response
      void this.historyService.handleFolderReconnection(value);
    }
  }

  // Reconnection modal handlers
  private showReconnectionModal(prompt: FolderReconnectionPrompt) {
    // Set waiting state and show modal
    this.waitingForModalResponse.set(true);
    const requestId = this.modalService.showComponent('reconnection-prompt', prompt);
    this.modalRequestId.set(requestId);
  }

  onReconnectConfirm(confirmed: boolean): void {
    this.modalService.close(confirmed);
  }

  // History item actions
  selectItem(item: HistoryItem): void {
    this.selectedItemId.set(item.id);
    this.historyItemSelected.emit(item);
  }

  clearSelection(): void {
    this.selectedItemId.set(null);
    this.historyItemSelected.emit(null);
  }

  deleteItem(item: HistoryItem, event: Event): void {
    event.stopPropagation();
    this.itemToDelete.set(item);
    this.showDeleteModal.set(true);
  }

  // Modal actions
  onDeleteConfirm(): void {
    const item = this.itemToDelete();
    if (item) {
      void this.historyService.deleteHistoryItem(item.id);
      this.showDeleteModal.set(false);
      this.itemToDelete.set(null);
    }
  }

  onClearAllConfirm(): void {
    void this.historyService.clearHistory();
    this.showClearModal.set(false);
  }

  // Modal cancel handlers
  cancelDeleteItem(): void {
    this.showDeleteModal.set(false);
    this.itemToDelete.set(null);
  }

  cancelClearAll(): void {
    this.showClearModal.set(false);
  }

  // File system actions
  async onToggleStorage(): Promise<void> {
    const state = this.fileSystemState();
    if (state.isEnabled) {
      await this.historyService.disableFileSystemStorage();
    } else {
      await this.historyService.enableFileSystemStorage();
    }
  }

  async onChangeFolder(): Promise<void> {
    await this.historyService.enableFileSystemStorage();
  }

  // Setter for searchQuery signal to be passed to child
  setSearchQuery(value: string) {
    this.searchQuery.set(value);
  }
}
