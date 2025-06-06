// File system storage manager - handles enabling/disabling file system storage and folder reconnection
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FileSystemOperationsService } from './file-system-operations.service';
import { StorageStateService } from '../../domain/services/storage-state.service';
import { StorageMigrationService } from './storage-migration.service';
import { HistoryManagementService } from './history-management.service';
import { HistoryItem } from '../../domain/types/storage-types';
import { StorageInitializationStateService } from './storage-initialization-state.service';

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

  // Flag to ensure initialization happens only once
  private initialized = false;

  /** true only when running in a browser (not during SSR) */
  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  /**
   * Initialize service and check for previous folder state (Browser only)
   */
  async initializeService(): Promise<{ success: boolean; waitingForUser?: boolean }> {
    // Add a guard to prevent multiple initializations
    if (this.initialized) {
      console.log('[STATE][FileSystemStorageManagerService] initializeService: already initialized');
      return { success: true };
    }

    if (!this.isBrowser) {
      console.log('[STATE][FileSystemStorageManagerService] initializeService: not in browser');
      return { success: true };
    }
    
    return await new Promise((resolve) => {
      console.log('[STATE][FileSystemStorageManagerService] initializeService: starting');
      this.initializationState.setInitializing(true);
      this.initializationState.setStorageLoaded(false);
      this.initializationState.setStorageLoading(false);
      // Check file system support first
      const isSupported = this.fileSystemOperations.isFileSystemAccessSupported();
      console.log('[STATE][FileSystemStorageManagerService] File system supported:', isSupported);
      // Initialize storage state (this loads saved state)
      this.storageState.loadStorageState(() => {
        this.initializationState.setStorageStateLoaded(true);
        // Check for reconnection after loading state
        const folderState = this.storageState.getPreviousFolderState();
        console.log('[STATE][FileSystemStorageManagerService] Previous folder state:', folderState);
        if (isSupported && folderState?.selectedPath) {
          // Set storage mode to 'none' (not local, not file) until user chooses
          this.storageState.setStorageMode('none');
          this.storageState.setStorageReady(false);
          this.storageState.updateFileSystemState({
            isEnabled: false,
            directoryHandle: null,
            selectedPath: folderState.selectedPath
          });
          // Set reconnection prompt
          const prompt = { previousPath: folderState.selectedPath, shouldPrompt: true };
          this.storageState.setFolderReconnectionPrompt(prompt);
          this.initializationState.setWaitingForReconnectionPrompt(true, prompt);
          console.log('[STATE][FileSystemStorageManagerService] Waiting for reconnection prompt');
          // Do NOT set isInitializing to false here; wait until storage is loaded after user response
          this.initialized = true;
          resolve({ success: true, waitingForUser: true });
          return;
        }
        // If no prompt needed, set storage mode to 'local' and load history
        this.storageState.setStorageMode('local');
        this.storageState.setStorageReady(false);
        this.initializationState.setStorageLoading(true);
        console.log('[STATE][FileSystemStorageManagerService] Loading history from local storage...');
        this.historyManagement.loadHistory().then(() => {
          this.storageState.setStorageReady(true);
          this.initializationState.setStorageLoading(false);
          this.initializationState.setStorageLoaded(true);
          this.initializationState.setInitializing(false);
          this.initialized = true;
          console.log('[STATE][FileSystemStorageManagerService] Initialization complete (local storage)');
          resolve({ success: true });
        }).catch(error => {
          this.initializationState.setInitializationError('[FileSystemStorageManagerService] Error during initialization: ' + (error instanceof Error ? error.message : String(error)));
          this.initializationState.setInitializing(false);
          this.initializationState.setStorageLoading(false);
          console.error('[STATE][FileSystemStorageManagerService] Initialization error:', error);
          resolve({ success: false });
        });
      });
    });
  }

  /**
   * Handle folder reconnection prompt
   */
  async handleFolderReconnection(reconnect: boolean): Promise<void> {
    console.log('[STATE][FileSystemStorageManagerService] handleFolderReconnection called, reconnect:', reconnect);
    if (!this.isBrowser) return;

    // Get current prompt value directly from signal
    const prompt = this.storageState.folderReconnectionPrompt();
    console.log('[STATE][FileSystemStorageManagerService] Current reconnection prompt:', prompt);
    this.initializationState.setWaitingForReconnectionPrompt(false, null);
    this.initializationState.setStorageLoading(true);
    this.initializationState.setStorageLoaded(false);
    
    // For reconnect=false, clear the prompt immediately
    if (!reconnect) {
      this.storageState.clearFolderReconnectionPrompt();
      this.storageState.setStorageMode('local');
      this.storageState.setStorageReady(false);
      console.log('[STATE][FileSystemStorageManagerService] User chose local storage');
    }

    if (reconnect) {
      try {
        const result = await this.enableFileSystemStorage(true);
        if (result.success) {
          this.storageState.updateFileSystemState({ isEnabled: true });
          this.storageState.setStorageMode('file');
          this.storageState.setStorageReady(true);
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
