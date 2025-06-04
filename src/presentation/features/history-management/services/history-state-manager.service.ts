import { Injectable, signal, computed } from '@angular/core';
import { IntegratedHistoryStorageService } from '../../../../integration/history-storage.service';
import { 
  HistoryItem,
  StorageInfo,
  FileSystemStorageState 
} from '../../../../integration/domain-types';

@Injectable({
  providedIn: 'root'
})
export class HistoryStateManagerService {
  // State signals
  private readonly _localHistory = signal<HistoryItem[]>([]);
  private readonly _localStorageInfo = signal<StorageInfo>({ 
    used: 0, available: 0, total: 0, usedPercentage: 0, itemCount: 0 
  });
  private readonly _localFileSystemState = signal<FileSystemStorageState>({
    isSupported: false, isEnabled: false, selectedPath: null, directoryHandle: null
  });

  // Public computed signals
  readonly history = computed(() => this._localHistory());
  readonly storageInfo = computed(() => this._localStorageInfo());
  readonly fileSystemState = computed(() => this._localFileSystemState());

  constructor(private historyService: IntegratedHistoryStorageService) {
    // Initialize state sync
    this.initializeStateSync();
  }

  private initializeStateSync(): void {
    computed(() => {
      // Sync from service to local state
      const serviceState = {
        history: this.historyService.historyItems(),
        storageInfo: this.historyService.storageState(),
        fileSystem: this.historyService.fsState()
      };

      // Update local state
      this.updateLocalState(serviceState);
    });
  }

  private updateLocalState(state: { 
    history: HistoryItem[],
    storageInfo: StorageInfo,
    fileSystem: FileSystemStorageState 
  }): void {
    this._localHistory.set(state.history);
    this._localStorageInfo.set(state.storageInfo);
    this._localFileSystemState.set(state.fileSystem);
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
}
