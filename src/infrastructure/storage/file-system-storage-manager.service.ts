// File system storage manager - handles enabling/disabling file system storage and folder reconnection
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FileSystemOperationsService } from './file-system-operations.service';
import { StorageStateService } from './storage-state.service';
import { StorageMigrationService } from './storage-migration.service';
import { HistoryManagementService } from './history-management.service';

@Injectable({
  providedIn: 'root'
})
export class FileSystemStorageManagerService {
  // Flag to ensure initialization happens only once
  private initialized = false;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private fileSystemOperations: FileSystemOperationsService,
    private storageState: StorageStateService,
    private migration: StorageMigrationService,
    private historyManagement: HistoryManagementService
  ) {}

  /** true only when running in a browser (not during SSR) */
  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  /**
   * Initialize service and check for previous folder state (Browser only)
   */  async initializeService(): Promise<{ success: boolean; waitingForUser?: boolean }> {
    // Add a guard to prevent multiple initializations
    if (this.initialized) {
      console.debug('[FileSystemStorageManagerService] Already initialized');
      return { success: true };
    }

    if (!this.isBrowser) {
      console.debug('[FileSystemStorageManagerService] Skipping initialization during SSR');
      return { success: true };
    }
    
    try {
      console.debug('[FileSystemStorageManagerService] Starting initialization...');
      this.initialized = true;
      
      // Check file system support first
      const isSupported = this.fileSystemOperations.isFileSystemAccessSupported();
      
      // Clear the reconnection prompt before initializing state
      this.storageState.clearFolderReconnectionPrompt();
      
      // Initialize storage state (this loads saved state)
      this.storageState.initializeState(isSupported);
      
      // Check for reconnection after loading state
      const folderState = this.storageState.getPreviousFolderState();
      const fsState = this.storageState.fileSystemState();

      console.debug('[FileSystemStorageManagerService] State loaded:', {
        isSupported,
        hasStorageState: !!fsState,
        hasFolderState: !!folderState,
        previousPath: folderState?.selectedPath
      });

      // Set reconnection prompt if needed
      const promptPath = folderState?.selectedPath || fsState?.selectedPath;
      if (isSupported && promptPath) {
        console.debug('[FileSystemStorageManagerService] Setting reconnection prompt for:', promptPath);
        
        // Set the prompt and verify it was set
        this.storageState.setFolderReconnectionPrompt({
          previousPath: promptPath,
          shouldPrompt: true
        });

        // Verify prompt was set
        const promptSet = this.storageState.folderReconnectionPrompt();
        console.debug('[FileSystemStorageManagerService] Reconnection prompt state:', promptSet);

        if (promptSet) {
          return { success: true, waitingForUser: true };
        }
      }

      // If no prompt needed or prompt wasn't set, load history normally
      console.debug('[FileSystemStorageManagerService] Loading history normally...');
      await this.historyManagement.loadHistory();
      return { success: true };

    } catch (error) {
      console.error('[FileSystemStorageManagerService] Error during initialization:', error);
      return { success: false };
    }
  }

  /**
   * Handle folder reconnection prompt
   */  async handleFolderReconnection(reconnect: boolean): Promise<void> {
    if (!this.isBrowser) return;

    // Get current prompt value directly from signal
    const prompt = this.storageState.folderReconnectionPrompt();
    if (!prompt) return;    // For reconnect=false, clear the prompt immediately
    if (!reconnect) {
      this.storageState.clearFolderReconnectionPrompt();
    }

    if (reconnect) {
      // User wants to reconnect, show directory picker
      console.log('[FileSystemStorageManagerService] User chose to reconnect, showing directory picker');
      try {
        const result = await this.enableFileSystemStorage(true);
        if (!result.success) {
          // Failed to reconnect, fall back to localStorage
          console.log('[FileSystemStorageManagerService] Failed to reconnect, falling back to localStorage');
          this.storageState.clearPreviousFolderState();
          // Ensure file system is disabled
          this.storageState.updateFileSystemState({
            isEnabled: false,
            directoryHandle: null,
            selectedPath: null
          });
        }
      } catch (error) {
        console.error('[FileSystemStorageManagerService] Error during reconnection:', error);
        this.storageState.clearPreviousFolderState();
      }
    } else {
      // User declined, clear the previous folder state        console.log('[FileSystemStorageManagerService] User declined reconnection, clearing previous folder state');
      this.storageState.clearPreviousFolderState();
    }

    // Always clear the reconnection prompt after handling
    this.storageState.clearFolderReconnectionPrompt();

    // Load from localStorage
    console.log('[FileSystemStorageManagerService] Loading from localStorage after folder reconnection handling');
    await this.historyManagement.loadHistory();
  }

  /**
   * Enable file system storage by selecting a directory
   */
  async enableFileSystemStorage(isReconnection = false): Promise<{ success: boolean; error?: string }> {
    if (!this.isBrowser) return { success: false, error: 'Not available on server' };

    try {
      console.log('[FileSystemStorageManagerService] Enabling file system storage...');

      // Update state immediately to indicate we're in file system mode
      this.storageState.updateFileSystemState({
        isEnabled: true,
        isSupported: this.fileSystemOperations.isFileSystemAccessSupported()
      });

      // Show directory picker
      const handle = await this.fileSystemOperations.selectDirectory({
        isReconnection,
        previousPath: this.storageState.getPreviousFolderState()?.selectedPath
      });

      // Update storage state with selected folder
      this.storageState.updateFileSystemState({
        directoryHandle: handle,
        selectedPath: handle.name
      });

      // Save state immediately
      this.storageState.saveStorageState();
      this.storageState.saveFolderState();

      // Load history after state is updated
      const fileSystemHistory = await this.migration.loadFromFileSystem(handle);
      await this.historyManagement.setHistory(fileSystemHistory);

      if (!isReconnection && fileSystemHistory.length === 0) {
        const migratedHistory = await this.migration.migrateFromLocalStorage(handle);
        if (migratedHistory.length > 0) {
          await this.historyManagement.setHistory(migratedHistory);
        }
      }      console.log('[FileSystemStorageManagerService] File system storage enabled successfully');
      // Clear reconnection prompt after successful enablement
      this.storageState.clearFolderReconnectionPrompt();
      return { success: true };
    } catch (error: unknown) {
      // Reset state on error
      await this.historyManagement.setHistory([]);

      // If user cancels the picker, this is caught here
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[FileSystemStorageManagerService] Directory picker was cancelled. Leaving previous folder and storage mode untouched.');
        // Do NOT clear file system state, just return
        return { success: false, error: 'User cancelled folder selection' };
      } else {
        console.error('[FileSystemStorageManagerService] An unexpected error occurred during file system storage enablement:', error);
        // Revert state if enablement failed
        this.storageState.updateFileSystemState({
          isEnabled: false,
          directoryHandle: null,
          selectedPath: null
        });
        await this.historyManagement.setHistory([]);
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
      console.log('[FileSystemStorageManagerService] Disabling file system storage...');

      // Clear existing history before switching storage modes
      this.historyManagement.clearHistoryInMemory();

      // Clear file system state and remove directory handle
      this.storageState.updateFileSystemState({
        isEnabled: false,
        directoryHandle: null,
        selectedPath: null
      });

      await this.storageState.clearStorageState();
      this.storageState.clearPreviousFolderState();

      // Load history from localStorage
      await this.historyManagement.loadHistory();

      console.log('[FileSystemStorageManagerService] File system storage disabled successfully, reverted to localStorage.');
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
