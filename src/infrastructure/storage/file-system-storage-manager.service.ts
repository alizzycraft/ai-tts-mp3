// File system storage manager - handles enabling/disabling file system storage and folder reconnection
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FileSystemOperationsService } from './file-system-operations.service';
import { StorageStateService } from '../../domain/services/storage-state.service';
import { StorageMigrationService } from './storage-migration.service';
import { HistoryManagementService } from './history-management.service';
import { HistoryItem } from '../../domain/types/storage-types';
import { StorageInitializationStateService } from './storage-initialization-state.service';
import { computed, signal, effect } from '@angular/core';
import { ModalService } from '../../integration/services/ui/modal.service';
import { RECONNECTION_PROMPT_MODAL } from '../../integration/tokens/reconnection-prompt-modal.token';

@Injectable({
  providedIn: 'root'
})
export class FileSystemStorageManagerService {
  private platformId = inject(PLATFORM_ID);
  private fileSystemOperations = inject(FileSystemOperationsService);
  private storageState = inject(StorageStateService);
  private migration = inject(StorageMigrationService);
  private historyManagement = inject(HistoryManagementService);
  private initializationState = inject(StorageInitializationStateService);
  private modalService = inject(ModalService);
  private reconnectionPromptModal = inject(RECONNECTION_PROMPT_MODAL);

  // Flag to ensure initialization happens only once
  private initialized = false;

  /** true only when running in a browser (not during SSR) */
  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  /**
   * Signal-driven initialization state
   */
  private _initState = signal<'idle' | 'loading' | 'waitingForReconnection' | 'ready' | 'error'>('idle');
  readonly initState = this._initState.asReadonly();

  /**
   * Signal-driven result of reconnection modal
   */
  private _reconnectionResult = signal<null | boolean>(null);
  readonly reconnectionResult = this._reconnectionResult.asReadonly();

  /**
   * Signal-driven initialization state machine (pure, no async/await)
   * This replaces initializeService and handleFolderReconnection with a fully signal-driven approach.
   */
  readonly initializationStateSignal = this.initializationState.stateSignal; // Expose state signal for UI/other services

  /**
   * Computed signal: true if overlay should be shown (initializing, loading, or waiting for reconnection prompt)
   */
  readonly showOverlaySignal = this.initializationState.overlayVisibleSignal;

  /**
   * Computed signal: true if reconnection modal should be shown
   */
  readonly showReconnectionModalSignal = this.initializationState.showReconnectionModalSignal;

  /**
   * Computed signal: result of reconnection modal (null = not answered, true/false = user choice)
   */
  readonly reconnectionModalResultSignal = this.initializationState.reconnectionModalResultSignal;

  /**
   * Start initialization (signal-driven, no async/await)
   */
  startInitialization() {
    console.log('[FSM] startInitialization called, _initState:', this._initState(), 'lastPromptPath:', this.lastPromptPath);
    if (this._initState() !== 'idle') {
      console.warn('[FSM] startInitialization: not idle, skipping');
      return;
    }
    if (this.storageState.folderReconnectionPrompt()) {
      console.warn('[FSM] startInitialization: prompt already pending, skipping');
      return;
    }
    this._initState.set('loading');
    this.initializationState.setInitializing(true);
    this.initializationState.setStorageLoaded(false);
    this.initializationState.setStorageLoading(false);
    const isSupported = this.fileSystemOperations.isFileSystemAccessSupported();
    console.log('[FSM] isFileSystemAccessSupported:', isSupported);
    this.storageState.loadStorageState(() => {
      this.initializationState.setStorageStateLoaded(true);
      const folderState = this.storageState.getPreviousFolderState();
      const existingPrompt = this.storageState.folderReconnectionPrompt();
      console.log('[FSM] folderState:', folderState, 'existingPrompt:', existingPrompt);
      if (isSupported && folderState?.selectedPath) {
        // Only enqueue the modal if there is no prompt for this path
        if (!existingPrompt || existingPrompt.previousPath !== folderState.selectedPath) {
          this.storageState.setStorageMode('none');
          this.storageState.setStorageReady(false);
          this.storageState.updateFileSystemState({
            isEnabled: false,
            directoryHandle: null,
            selectedPath: folderState.selectedPath
          });
          const prompt = { previousPath: folderState.selectedPath, shouldPrompt: true };
          console.log('[FSM] setting reconnection prompt:', prompt);
          this.storageState.setFolderReconnectionPrompt(prompt);
          this.initializationState.setWaitingForReconnectionPrompt(true, prompt);
          this._initState.set('waitingForReconnection');
          this.modalService.enqueue({
            type: 'component',
            componentType: this.reconnectionPromptModal,
            data: prompt,
            allowDismiss: false
          });
          console.log('[FSM] Modal enqueued for path:', prompt.previousPath);
        } else {
          console.log('[FSM] Modal already enqueued for path:', folderState.selectedPath);
        }
        return;
      }
      // No reconnection needed, load local history
      this.storageState.setStorageMode('local');
      this.storageState.setStorageReady(false);
      this.initializationState.setStorageLoading(true);
      this.historyManagement.loadHistory().then(() => {
        this.storageState.setStorageReady(true);
        this.initializationState.setStorageLoading(false);
        this.initializationState.setStorageLoaded(true);
        this.initializationState.setInitializing(false);
        this._initState.set('ready');
        console.log('[FSM] local history loaded, state ready');
      }).catch(error => {
        this.initializationState.setInitializationError('[FileSystemStorageManagerService] Error during initialization: ' + (error instanceof Error ? error.message : String(error)));
        this.initializationState.setInitializing(false);
        this.initializationState.setStorageLoading(false);
        this._initState.set('error');
        console.error('[FSM] error during local history load:', error);
      });
    });
  }

  private lastPromptPath: string | null = null;
  private modalResultSignal: ReturnType<typeof signal<boolean | null>> | null = null;

  constructor() {
    // Pure signal-driven modal workflow: react to reconnectionModalResultSignal
    computed(() => {
      const result = this.initializationState.reconnectionModalResultSignal();
      if (result === true) {
        this.initializationState.setReconnectionModalResult(null);
        // Synchronously start folder picker logic
        this.initializationState.setStorageLoading(true);
        this.initializationState.setStorageLoaded(false);
        this._initState.set('waitingForReconnection');
        this.storageState.updateFileSystemState({ isEnabled: false });
        this.storageState.setStorageMode('none');
        this.storageState.setStorageReady(false);
        this.storageState.saveFolderState();
        // Call selectDirectory and handle result synchronously
        this.fileSystemOperations.selectDirectory({
          isReconnection: true,
          previousPath: this.storageState.getPreviousFolderState()?.selectedPath
        }).then(handle => {
          if (!handle || typeof handle.name !== 'string' || !handle.name) {
            throw new Error('Selected directory handle is missing a valid name.');
          }
          this.storageState.updateFileSystemState({
            isEnabled: true,
            directoryHandle: handle,
            selectedPath: handle.name
          });
          this.storageState.saveStorageState();
          this.storageState.saveFolderState();
          this.storageState.setStorageMode('file');
          this.storageState.setStorageReady(false);
          this.migration.loadFromFileSystem(handle).then(fileSystemHistory => {
            this.historyManagement.setHistory(fileSystemHistory).then(() => {
              this.storageState.setStorageReady(true);
              this.initializationState.setStorageLoading(false);
              this.initializationState.setStorageLoaded(true);
              this.initializationState.setInitializing(false);
              this._initState.set('ready');
              console.log('[FSM] User accepted reconnection, file system history loaded, state ready');
            });
          });
        }).catch(error => {
          // If user cancels, re-show the modal and keep overlay
          console.warn('[FSM] Folder selection cancelled or failed:', error);
          this.initializationState.setWaitingForReconnectionPrompt(true, this.storageState.getPreviousFolderState() ? { previousPath: this.storageState.getPreviousFolderState()!.selectedPath, shouldPrompt: true } : null);
          this._initState.set('waitingForReconnection');
          // Re-enqueue the modal
          if (this.storageState.getPreviousFolderState()) {
            this.modalService.enqueue({
              type: 'component',
              componentType: this.reconnectionPromptModal,
              data: { previousPath: this.storageState.getPreviousFolderState()!.selectedPath, shouldPrompt: true },
              allowDismiss: false
            });
          }
        });
      } else if (result === false) {
        this.initializationState.setReconnectionModalResult(null);
        this.handleFolderReconnectionSignal(false);
      }
    });
  }

  /**
   * Handle folder reconnection result (signal-driven)
   */
  // Make this method public so it can be called from AppComponent
  handleFolderReconnectionSignal(reconnect: boolean) {
    console.log('[FSM] handleFolderReconnectionSignal called, reconnect:', reconnect);
    this.initializationState.setWaitingForReconnectionPrompt(false);
    if (!reconnect) {
      // User declined reconnection: load local history, only set ready after load
      this.initializationState.setStorageLoading(true);
      this.initializationState.setStorageLoaded(false);
      this.lastPromptPath = null;
      this.storageState.clearFolderReconnectionPrompt();
      this.storageState.setStorageMode('local');
      this.storageState.setStorageReady(false);
      this.storageState.clearPreviousFolderState();
      this.historyManagement.loadHistory().then(() => {
        this.storageState.setStorageReady(true);
        this.initializationState.setStorageLoading(false);
        this.initializationState.setStorageLoaded(true);
        this.initializationState.setInitializing(false);
        this._initState.set('ready');
        console.log('[FSM] User declined reconnection, local history loaded, state ready');
      });
      // Modal will close automatically by not re-enqueuing
      return;
    }
    // User accepted reconnection: wait for folder selection
    this.initializationState.setStorageLoading(true);
    this.initializationState.setStorageLoaded(false);
    this._initState.set('waitingForReconnection');
    this.storageState.updateFileSystemState({ isEnabled: false });
    this.storageState.setStorageMode('none');
    this.storageState.setStorageReady(false);
    this.storageState.saveFolderState();
    // Start folder selection
    this.fileSystemOperations.selectDirectory({
      isReconnection: true,
      previousPath: this.storageState.getPreviousFolderState()?.selectedPath
    }).then(handle => {
      if (!handle || typeof handle.name !== 'string' || !handle.name) {
        throw new Error('Selected directory handle is missing a valid name.');
      }
      this.storageState.updateFileSystemState({
        isEnabled: true,
        directoryHandle: handle,
        selectedPath: handle.name
      });
      this.storageState.saveStorageState();
      this.storageState.saveFolderState();
      this.storageState.setStorageMode('file');
      this.storageState.setStorageReady(false);
      this.migration.loadFromFileSystem(handle).then(fileSystemHistory => {
        this.historyManagement.setHistory(fileSystemHistory).then(() => {
          this.storageState.setStorageReady(true);
          this.initializationState.setStorageLoading(false);
          this.initializationState.setStorageLoaded(true);
          this.initializationState.setInitializing(false);
          this._initState.set('ready');
          console.log('[FSM] User accepted reconnection, file system history loaded, state ready');
        });
      });
      // Modal will close automatically by not re-enqueuing
    }).catch(error => {
      // If user cancels, re-show the modal and keep overlay
      console.warn('[FSM] Folder selection cancelled or failed:', error);
      this.initializationState.setWaitingForReconnectionPrompt(true, this.storageState.getPreviousFolderState() ? { previousPath: this.storageState.getPreviousFolderState()!.selectedPath, shouldPrompt: true } : null);
      this._initState.set('waitingForReconnection');
      // Re-enqueue the modal
      if (this.storageState.getPreviousFolderState()) {
        this.modalService.enqueue({
          type: 'component',
          componentType: this.reconnectionPromptModal,
          data: { previousPath: this.storageState.getPreviousFolderState()!.selectedPath, shouldPrompt: true },
          allowDismiss: false
        });
      }
    });
  }

  /**
   * Finalize initialization after reconnection or fallback
   */
  private finishInitializationAfterReconnection() {
    console.log('[FSM] finishInitializationAfterReconnection called');
    this.storageState.clearFolderReconnectionPrompt();
    this.historyManagement.loadHistory().then(() => {
      this.storageState.setStorageReady(true);
      this.initializationState.setStorageLoading(false);
      this.initializationState.setStorageLoaded(true);
      this.initializationState.setInitializing(false);
      this._initState.set('ready');
      console.log('[FSM] finishInitializationAfterReconnection: ready');
    });
  }

  /**
   * Handle folder reconnection prompt
   */
  async handleFolderReconnection(reconnect: boolean): Promise<void> {
    console.log('[STATE][FileSystemStorageManagerService] handleFolderReconnection called, reconnect:', reconnect);
    if (!this.isBrowser) return;

    // Only set waitingForReconnectionPrompt to false if it was true
    this.initializationState.setWaitingForReconnectionPrompt(false, null);
    this.initializationState.setStorageLoading(true);
    this.initializationState.setStorageLoaded(false);
    
    if (!reconnect) {
      this.storageState.clearFolderReconnectionPrompt();
      this.storageState.setStorageMode('local');
      this.storageState.setStorageReady(false);
      this.storageState.clearPreviousFolderState(); // Clear so prompt is not re-triggered
      console.log('[STATE][FileSystemStorageManagerService] User chose local storage');
    }

    if (reconnect) {
      try {
        const result = await this.enableFileSystemStorage(true);
        if (result.success) {
          this.storageState.updateFileSystemState({ isEnabled: true });
          this.storageState.setStorageMode('file');
          this.storageState.setStorageReady(true);
          this.storageState.saveFolderState(); // Save the new connected folder state
          console.log('[STATE][FileSystemStorageManagerService] User reconnected to file system storage');
        } else {
          this.storageState.clearPreviousFolderState();
          this.storageState.updateFileSystemState({
            isEnabled: false,
            directoryHandle: null,
            selectedPath: null
          });
          this.storageState.setStorageMode('local');
          this.storageState.setStorageReady(false);
          console.log('[STATE][FileSystemStorageManagerService] User failed to reconnect, falling back to local storage');
        }
      } catch (error) {
        this.storageState.clearPreviousFolderState();
        this.storageState.setStorageMode('local');
        this.storageState.setStorageReady(false);
        console.error('[STATE][FileSystemStorageManagerService] Error during reconnection:', error);
      }
    } else {
      this.storageState.clearPreviousFolderState();
      this.storageState.updateFileSystemState({
        isEnabled: false,
        directoryHandle: null,
        selectedPath: null
      });
      this.storageState.setStorageMode('local');
      this.storageState.setStorageReady(false);
    }

    this.storageState.clearFolderReconnectionPrompt();
    console.log('[STATE][FileSystemStorageManagerService] Loading history after reconnection choice...');
    await this.historyManagement.loadHistory();
    this.storageState.setStorageReady(true);
    this.initializationState.setStorageLoading(false);
    this.initializationState.setStorageLoaded(true);
    this.initializationState.setInitializing(false);
    console.log('[STATE][FileSystemStorageManagerService] Initialization complete after reconnection');
  }
  
  /**
   * Enable file system storage by selecting a directory
   */
  async enableFileSystemStorage(isReconnection = false): Promise<{ success: boolean; error?: string }> {
    if (!this.isBrowser) return { success: false, error: 'Not available on server' };
    let currentHistory: HistoryItem[] = [];
    try {
      const previousState = { ...this.storageState.fileSystemState() };
      if (previousState.isEnabled) {
        currentHistory = await this.historyManagement.getHistory();
      }
      const handle = await this.fileSystemOperations.selectDirectory({
        isReconnection,
        previousPath: this.storageState.getPreviousFolderState()?.selectedPath
      });
      console.log('[FileSystemStorageManager] Directory handle selected:', handle);
      if (!handle || typeof handle.name !== 'string' || !handle.name) {
        console.error('[FileSystemStorageManager] Directory handle missing name property:', handle);
        throw new Error('Selected directory handle is missing a valid name.');
      }
      this.storageState.updateFileSystemState({
        isEnabled: true,
        directoryHandle: handle,
        selectedPath: handle.name
      });
      this.storageState.saveStorageState();
      this.storageState.saveFolderState();
      this.storageState.setStorageMode('file');
      this.storageState.setStorageReady(false);
      const fileSystemHistory = await this.migration.loadFromFileSystem(handle);
      await this.historyManagement.setHistory(fileSystemHistory);
      if (!isReconnection && fileSystemHistory.length === 0) {
        const migratedHistory = await this.migration.migrateFromLocalStorage(handle);
        if (migratedHistory.length > 0) {
          await this.historyManagement.setHistory(migratedHistory);
        }
      }
      this.storageState.clearFolderReconnectionPrompt();
      this.storageState.setStorageReady(true);
      return { success: true };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        if (this.storageState.fileSystemState().isEnabled) {
          const currentHistoryCount = this.historyManagement.getHistory().length;
          if (currentHistoryCount === 0 && currentHistory && currentHistory.length > 0) {
            await this.historyManagement.setHistory(currentHistory);
          }
          return { success: false, error: 'User cancelled folder selection' };
        } else {
          this.storageState.updateFileSystemState({
            isEnabled: false,
            directoryHandle: null,
            selectedPath: null
          });
          this.storageState.setStorageMode('local');
          this.storageState.setStorageReady(false);
          await this.historyManagement.loadHistory();
          return { success: false, error: 'User cancelled folder selection' };
        }
      } else {
        console.error('[FileSystemStorageManagerService] Error during file system storage enablement:', error);
        this.storageState.updateFileSystemState({
          isEnabled: false,
          directoryHandle: null,
          selectedPath: null
        });
        this.storageState.setStorageMode('local');
        this.storageState.setStorageReady(false);
        await this.historyManagement.loadHistory();
        this.storageState.setStorageReady(true);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error during file system storage enablement'
        };
      }
    }
  }

  /**
   * Disable file system storage
   */
  async disableFileSystemStorage(): Promise<boolean> {
    if (!this.isBrowser) return false;
    try {
      this.historyManagement.clearHistoryInMemory();
      this.storageState.updateFileSystemState({
        isEnabled: false,
        directoryHandle: null,
        selectedPath: null
      });
      await this.storageState.clearStorageState();
      this.storageState.clearPreviousFolderState();
      this.storageState.setStorageMode('local');
      this.storageState.setStorageReady(false);
      await this.historyManagement.loadHistory();
      this.storageState.setStorageReady(true);
      return true;
    } catch (error) {
      console.error('[FileSystemStorageManagerService] Failed to disable file system storage:', error);
      return false;
    }
  }

  /**
   * Check if File System Access API is supported
   */
  isFileSystemAccessSupported(): boolean {
    return this.fileSystemOperations.isFileSystemAccessSupported();
  }

  /**
   * Get the current folder name if file system storage is enabled
   */
  getCurrentFolderName(): string | null {
    const state = this.storageState.fileSystemState();
    return state.isEnabled ? state.selectedPath : null;
  }

  /**
   * Check if file system storage is currently enabled
   */
  isFileSystemStorageEnabled(): boolean {
    const state = this.storageState.fileSystemState();
    return state.isEnabled && !!state.directoryHandle;
  }
}
