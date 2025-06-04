import { Injectable, signal, computed } from '@angular/core';
import { 
  HistoryItem,
  StorageInfo,
  FileSystemStorageState,
  FolderReconnectionPrompt
} from '../../../integration/domain-types';
import { HistoryStorageService } from '../../../integration/history-storage.service';
import { PresentationHistoryItem, PresentationStorageInfo, PresentationStorageState } from '../models/presentation-types';

@Injectable({
  providedIn: 'root'
})
export class HistoryStateManagerService {
  // State signals
  private readonly _localHistory = signal<PresentationHistoryItem[]>([]);
  private readonly _localStorageInfo = signal<PresentationStorageInfo>({ 
    used: 0,
    available: 0,
    usedPercentage: 0,
    itemCount: 0,
    isFileSystem: false
  });
  private readonly _localFileSystemState = signal<PresentationStorageState>({
    isSupported: false,
    isEnabled: false,
    selectedPath: null,
    directoryHandle: null,
    showReconnectPrompt: false
  });

  // Add reconnection prompt state
  private readonly _reconnectionPrompt = signal<FolderReconnectionPrompt | null>(null);
  readonly folderReconnectionPrompt = computed(() => this._reconnectionPrompt());

  // Track modal state
  private readonly _modalActive = signal(false);
  readonly modalActive = computed(() => this._modalActive());

  // Public computed signals
  readonly history = computed(() => this._localHistory());
  readonly storageInfo = computed(() => this._localStorageInfo());
  readonly fileSystemState = computed(() => this._localFileSystemState());
  readonly reconnection = computed(() => this.historyService.reconnection());

  constructor(private historyService: HistoryStorageService) {
    this.initializeStateSync();
  }

  private initializeStateSync(): void {
    computed(() => {
      // Sync from service to local state
      const serviceState = {
        history: this.historyService.items(),
        storageInfo: this.historyService.storage(),
        fileSystem: this.historyService.fileSystem()
      };

      // Update local state with mapped types
      this.updateLocalState(serviceState);
    });
  }

  private updateLocalState(state: { 
    history: HistoryItem[],
    storageInfo: StorageInfo,
    fileSystem: FileSystemStorageState 
  }): void {
    // Map history items to presentation items
    const presentationHistory: PresentationHistoryItem[] = state.history.map(item => ({
      ...item,
      isExpanded: false,
      isPlaying: false
    }));
    this._localHistory.set(presentationHistory);

    // Map storage info to presentation storage info
    const presentationStorageInfo: PresentationStorageInfo = {
      used: state.storageInfo.used,
      available: state.storageInfo.available,
      usedPercentage: state.storageInfo.usedPercentage,
      itemCount: state.storageInfo.itemCount,
      isFileSystem: state.fileSystem.isEnabled,
      folderName: state.fileSystem.selectedPath || undefined
    };
    this._localStorageInfo.set(presentationStorageInfo);

    // Map file system state to presentation state
    const presentationFileSystemState: PresentationStorageState = {
      ...state.fileSystem,
      showReconnectPrompt: false
    };
    this._localFileSystemState.set(presentationFileSystemState);
  }

  // Public methods for state changes
  toggleStorage(): void {
    const currentState = this.fileSystemState();
    if (currentState.isEnabled) {
      void this.historyService.disableFileSystemStorage();
    } else {
      void this.historyService.enableFileSystemStorage();
    }
  }

  changeFolder(): void {
    void this.historyService.enableFileSystemStorage();
  }

  handleFolderReconnection(value: boolean): void {
    void this.historyService.handleFolderReconnection(value);
  }

  deleteHistoryItem(id: string): void {
    void this.historyService.deleteHistoryItem(id);
  }

  clearHistory(): void {
    void this.historyService.clearHistory();
  }

  setReconnectionPrompt(prompt: FolderReconnectionPrompt): void {
    this._reconnectionPrompt.set(prompt);
    this._modalActive.set(false);
  }

  clearReconnectionPrompt(): void {
    this._reconnectionPrompt.set(null);
    this._modalActive.set(false);
  }
}