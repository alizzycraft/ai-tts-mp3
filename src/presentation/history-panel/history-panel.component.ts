import { Component, signal, computed, input, output, TemplateRef, ViewChild, AfterViewInit, ChangeDetectionStrategy, DestroyRef, inject, Injector, runInInjectionContext } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { filter, combineLatest, distinctUntilChanged } from 'rxjs';
import { IntegratedHistoryStorageService, HistoryItem, StorageInfo, FileSystemStorageState, FolderReconnectionPrompt } from '../../integration/history-storage.service';
import { StorageInfoComponent } from './components/storage-info/storage-info.component';
import { FileSystemManagerComponent } from './components/file-system-manager/file-system-manager.component';
import { TruncateTextPipe } from '../shared/pipes/truncate-text.pipe';
import { FormatDatePipe } from '../shared/pipes/format-date.pipe';
import { FormatFileSizePipe } from '../shared/pipes/format-file-size.pipe';
import { ModalService } from '../../shared/modal.service';

interface ReconnectModalResult {
  confirmed: boolean;
}

@Component({
  selector: 'app-history-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    StorageInfoComponent,
    FileSystemManagerComponent,
    TruncateTextPipe,
    FormatDatePipe,
    FormatFileSizePipe
  ],
  template: `
    <!-- Main Panel -->
    <div class="history-panel">
      <!-- Header -->
      <div class="history-header">
        <div class="header-content">
          <h2 class="panel-title">History</h2>
          <button (click)="onClearAllClick()" class="clear-all-btn">
            Clear All
          </button>
        </div>
        <div class="search-box">
          <input
            type="text"
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
            placeholder="Search history..."
            class="search-input"
          />
        </div>
      </div>

      <!-- Storage Info -->
      @if (showStorageBar()) {
        <app-storage-info
          [storageInfo]="storageInfo$()"
          [warningLevel]="storageWarningLevel()"
          [showStorageBar]="true"
        />
      }

      <!-- File System Storage -->
      <app-file-system-manager
        [state]="fileSystemState$()"
        (toggle)="onToggleStorage()"
        (changeFolder)="onChangeFolder()"
      />      
      <!-- History Content -->
      <div class="history-content">
        @if (filteredHistory().length) {
          <div class="history-list" role="list">
            @for (item of filteredHistory(); track trackByFn(0, item)) {
              <div
                class="history-item"
                [class.selected]="item.id === selectedItemId()"
                [class.playing]="item.id === playingItemId() && isPlaying()"
                (click)="selectItem(item)"
                role="listitem"
                tabindex="0"
              >
                <div class="item-header">
                  <span class="item-title">
                    {{ item.metadata?.title || (item.text | truncateText:50) }}
                  </span>
                  <div class="item-actions">
                    <button 
                      class="action-btn play-btn" 
                      (click)="onHistoryItemPlayPauseClick(item, $event)"
                      [attr.aria-label]="item.id === playingItemId() && isPlaying() ? 'Pause' : 'Play'"
                    >
                      @if (item.id === playingItemId() && isPlaying()) {
                        <img src="assets/icons/outline/pause.svg" width="16" height="16" alt="Pause">
                      } @else {
                        <img src="assets/icons/outline/play.svg" width="16" height="16" alt="Play">
                      }
                    </button>
                    <button 
                      class="action-btn download-btn" 
                      (click)="onDownloadHistoryItem(item, $event)"
                      aria-label="Download"
                    >
                      <img src="assets/icons/outline/download.svg" width="16" height="16" alt="Download">
                    </button>
                    <button 
                      class="action-btn delete-btn" 
                      (click)="onDeleteClick(item, $event)"
                      aria-label="Delete"
                    >
                      <img src="assets/icons/outline/trash.svg" width="16" height="16" alt="Delete">
                    </button>
                  </div>
                </div>
                <div class="item-info">
                  <time class="item-date">{{ item.createdAt | formatDate }}</time>
                  <span class="item-size">{{ item.audioSize | formatFileSize }}</span>
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="empty-state">
            <div class="empty-icon">📝</div>
            <div class="empty-message">No history items found</div>
            <div class="empty-hint">Generated audio files will appear here</div>
          </div>
        }
      </div>
    </div>

    <!-- Modal Templates -->
    <ng-template #deleteModal let-item>
      <div class="modal-content">
        <div class="modal-header">
          <h3>Delete Item</h3>
          <button class="modal-close-btn" (click)="onModalClose()" aria-label="Close">
            <img src="assets/icons/outline/x.svg" width="16" height="16" alt="Close">
          </button>
        </div>
        <div class="modal-body">
          <p>Are you sure you want to delete this item?</p>
          <div class="item-preview">
            {{ item.metadata?.title || (item.text | truncateText:100) }}
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-btn secondary" (click)="onModalClose()">Cancel</button>
          <button class="modal-btn primary" (click)="confirmDelete()">Delete</button>
        </div>
      </div>
    </ng-template>

    <ng-template #clearModal>
      <div class="modal-content">
        <div class="modal-header">
          <h3>Clear All History</h3>
          <button class="modal-close-btn" (click)="onModalClose()" aria-label="Close">
            <img src="assets/icons/outline/x.svg" width="16" height="16" alt="Close">
          </button>
        </div>
        <div class="modal-body">
          <p>Are you sure you want to clear all history items? This action cannot be undone.</p>
        </div>
        <div class="modal-footer">
          <button class="modal-btn secondary" (click)="onModalClose()">Cancel</button>
          <button class="modal-btn primary" (click)="confirmClearAll()">Clear All</button>
        </div>
      </div>
    </ng-template>

    <ng-template #reconnectModal let-prompt>
      <div class="modal-content">
        <div class="modal-header">
          <h3>Reconnect to Folder</h3>
          <button class="modal-close-btn" (click)="onModalClose()" aria-label="Close">
            <img src="assets/icons/outline/x.svg" width="16" height="16" alt="Close">
          </button>
        </div>
        <div class="modal-body">
          <p class="modal-message">Would you like to reconnect to the previously used storage folder?</p>
          <div class="folder-info">
            <img src="assets/icons/outline/folder.svg" width="20" height="20" alt="Folder">
            <span class="folder-name">{{ prompt.previousPath }}</span>
          </div>
        </div>
        <div class="modal-footer">
          <button 
            class="modal-btn secondary" 
            (click)="onReconnectConfirm(false)"
            aria-label="Use Default Storage">
            No, Use Default
          </button>
          <button 
            class="modal-btn primary"
            (click)="onReconnectConfirm(true)"
            aria-label="Reconnect to Folder">
            Yes, Reconnect
          </button>
        </div>
      </div>
    </ng-template>
  `,
  styleUrls: ['./history-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HistoryPanelComponent implements AfterViewInit {  @ViewChild('deleteModal') deleteModal!: TemplateRef<{ $implicit: HistoryItem }>;
  @ViewChild('clearModal') clearModal!: TemplateRef<{ $implicit: unknown }>;
  @ViewChild('reconnectModal') reconnectModal!: TemplateRef<{ $implicit: FolderReconnectionPrompt }>;

  // Dependencies
  readonly modalService = inject(ModalService);
  private readonly historyService = inject(IntegratedHistoryStorageService);
  private readonly destroyRef = inject(DestroyRef);

  // View state
  private readonly viewInitialized = signal(false);
  
  // Inputs/Outputs
  playingItemId = input<string | null>(null);
  isPlaying = input<boolean>(false);
  historyItemSelected = output<HistoryItem | null>();
  playItem = output<HistoryItem>();

  // State signals
  searchQuery = signal('');
  selectedItemId = signal<string | null>(null);

  // Observable-derived signals
  readonly history$ = toSignal(this.historyService.history$, { initialValue: [] });
  readonly storageInfo$ = toSignal(this.historyService.storageInfo$, { 
    initialValue: { used: 0, available: 0, total: 0, usedPercentage: 0, itemCount: 0 } 
  });
  readonly fileSystemState$ = toSignal(this.historyService.fileSystemState$, {
    initialValue: {
      isSupported: false,
      isEnabled: false,
      directoryHandle: null,
      selectedPath: null
    }
  });
  readonly folderReconnectionPrompt$ = toSignal(this.historyService.folderReconnectionPrompt$, {
    initialValue: null
  });

  // Pure computed signals for state derivation - no side effects
  readonly shouldShowReconnectionModal = computed(() => {
    const isViewReady = this.viewInitialized();
    const prompt = this.folderReconnectionPrompt$();
    return isViewReady && prompt?.shouldPrompt && !this.modalService.template();
  });

  readonly filteredHistory = computed(() => {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.history$();
    
    return this.history$().filter(item => 
      item.text.toLowerCase().includes(query) ||
      item.metadata?.title?.toLowerCase().includes(query) ||
      item.metadata?.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  });

  readonly storageWarningLevel = computed(() => {
    const percentage = this.storageInfo$().usedPercentage;
    if (percentage > 0.9) return 'critical';
    if (percentage > 0.8) return 'warning';
    return 'normal';
  });

  readonly showStorageBar = computed(() => {
    return !this.fileSystemState$().isEnabled;
  });

  constructor() {
    // Set up reconnection prompt handling
    this.setupReconnectionPromptHandler();
  }

  ngAfterViewInit(): void {
    this.viewInitialized.set(true);
  }

  // Modal Handlers
  async onDeleteClick(item: HistoryItem, event: Event): Promise<void> {
    event.stopPropagation();
    const confirmed = await this.modalService.show({
      template: this.deleteModal,
      context: { $implicit: item }
    });
    
    if (confirmed) {
      await this.historyService.deleteHistoryItem(item.id);
    }
  }
  async onClearAllClick(): Promise<void> {
    const confirmed = await this.modalService.show({
      template: this.clearModal,
      context: { $implicit: undefined }
    });
    if (confirmed) {
      await this.historyService.clearHistory();
    }
  }

  onModalClose(): void {
    this.modalService.close();
  }

  confirmDelete(): void {
    this.modalService.close(true);
  }

  confirmClearAll(): void {
    this.modalService.close(true);
  }

  onReconnectConfirm(confirmed: boolean): void {
    this.modalService.close(confirmed);
  }

  private setupReconnectionPromptHandler(): void {
    const shouldShow$ = toObservable(this.shouldShowReconnectionModal);
    const prompt$ = toObservable(this.folderReconnectionPrompt$);

    // Combine the latest values and handle modal display
    combineLatest([shouldShow$, prompt$]).pipe(
      takeUntilDestroyed(this.destroyRef),
      // Type-safe filter that ensures both values are present
      filter((value): value is [boolean, FolderReconnectionPrompt] => 
        value[0] === true && value[1] !== null && value[1] !== undefined
      ),
      distinctUntilChanged()
    ).subscribe(async ([_, prompt]) => {
      // Show modal and await result
      const confirmed = await this.modalService.show({
        template: this.reconnectModal,
        context: { $implicit: prompt }
      });
      
      // Handle result
      await this.historyService.handleFolderReconnection(!!confirmed);
    });
  }

  // History item actions
  selectItem(item: HistoryItem): void {
    this.selectedItemId.set(item.id);
    this.historyItemSelected.emit(item);
  }

  onHistoryItemPlayPauseClick(item: HistoryItem, event: Event): void {
    event.stopPropagation();
    if (!event.isTrusted) return;
    
    this.selectItem(item);
    this.playItem.emit(item);
  }

  onDownloadHistoryItem(item: HistoryItem, event: Event): void {
    event.stopPropagation();
    
    const fileName = `tts-${item.id}-${item.settings.provider.toLowerCase()}.mp3`;
    const audioData = item.result.audioData;
    
    if (audioData) {
      const blob = new Blob([audioData], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  // File system actions  
  onToggleStorage(): void {
    const state = this.fileSystemState$();
    if (state.isEnabled) {
      this.historyService.disableFileSystemStorage();
    } else {
      this.historyService.enableFileSystemStorage();
    }
  }

  onChangeFolder(): void {
    // Only allow changing folder if already enabled
    if (this.fileSystemState$().isEnabled) {
      this.historyService.enableFileSystemStorage(); // This will prompt for a new folder
    }
  }

  // Utility functions
  trackByFn(index: number, item: HistoryItem): string {
    return item.id;
  }

  /** Clears the current selection and notifies parent */
  clearSelection(): void {
    this.selectedItemId.set(null);
    this.historyItemSelected.emit(null);
  }
}
