// Storage State Management Service - Manages storage state and configuration
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { signal, computed } from '@angular/core';
import { FileSystemStorageState } from '../contracts/interfaces/models/file-system-storage-sate.interface';
import { FolderReconnectionPrompt } from '../contracts/interfaces/models/folder-reconnection-prompt.interface';

@Injectable({
  providedIn: 'root'
})
export class StorageStateService {
  private readonly FOLDER_STATE_KEY = 'tts-folder-state';
  private readonly STORAGE_STATE_KEY = 'tts-storage-state';
  private initialized = false;
  private readonly platformId = inject(PLATFORM_ID);

  // Replace BehaviorSubjects with signals
  private readonly _fileSystemState = signal<FileSystemStorageState>({
    isSupported: false,
    isEnabled: false,
    selectedPath: null,
    directoryHandle: null
  });

  private readonly _folderReconnectionPrompt = signal<FolderReconnectionPrompt | null>(null);

  // Add error state signal
  private readonly _stateError = signal<string | null>(null);
  // Public readonly signals
  readonly fileSystemState = computed(() => this._fileSystemState());
  readonly folderReconnectionPrompt = computed(() => this._folderReconnectionPrompt());
  readonly stateError = computed(() => this._stateError());
  
  /** true only when running in a browser (not during SSR) */
  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  // Initialize storage state with support detection
  initializeState(isSupported: boolean): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    if (this.isBrowser) {
      // First load any saved state
      this.loadStorageState();
      
      // Then initialize with filesystem support if no existing state
      const currentState = this._fileSystemState();
      if (!currentState.isEnabled) {
        this._fileSystemState.set({
          ...currentState,
          isSupported,
          isEnabled: false,
          directoryHandle: null,
          selectedPath: null
        });
      }
    }
  }

  // Update file system state
  updateFileSystemState(updates: Partial<FileSystemStorageState>): void {
    if (!this.isBrowser) return;
    
    // Merge updates with current state atomically
    this._fileSystemState.update(current => {
      const newState = { ...current, ...updates };
      
      // Save state immediately on significant changes
      if (updates.isEnabled !== undefined || updates.selectedPath !== undefined) {
        this.saveFolderState();
        this.saveStorageState();
      }
      return newState;
    });
  }

  // Set the reconnection prompt - just stores state, no UI interaction
  setFolderReconnectionPrompt(prompt: FolderReconnectionPrompt | null): void {
    this._folderReconnectionPrompt.set(prompt);

    // Verify the update
    const currentPrompt = this._folderReconnectionPrompt();
    
    if (prompt && (!currentPrompt || !currentPrompt.shouldPrompt)) {
      console.warn('[StorageState] Prompt not set correctly:', { 
        attempted: prompt, 
        current: currentPrompt 
      });
    }
  }

  clearFolderReconnectionPrompt(): void {
    this.setFolderReconnectionPrompt(null);
  }

  // Add method to force prompt check
  verifyPromptState(): void {
    // No action needed - this method can be empty after removing debug logs
  }

  // Current state getters
  getState(): FileSystemStorageState {
    return this._fileSystemState();
  }

  loadStorageState(): void {
    if (!this.isBrowser || typeof localStorage === 'undefined') return;

    try {
      // Load storage state
      const stored = localStorage.getItem(this.STORAGE_STATE_KEY);
      if (stored) {
        const savedState = JSON.parse(stored);
        if (savedState && typeof savedState === 'object' && 'isEnabled' in savedState) {
          const currentState = this._fileSystemState();
          
          // Don't set isEnabled true if we're loading from storage,
          // since we need to reconnect first
          this._fileSystemState.set({
            ...currentState,
            isEnabled: false, // Force disabled until reconnected
            selectedPath: savedState.selectedPath || null
          });
          this._stateError.set(null);

          // If we had a previously enabled state with a path, set up reconnection
          if (savedState.isEnabled && savedState.selectedPath) {
            this.setFolderReconnectionPrompt({
              previousPath: savedState.selectedPath,
              shouldPrompt: true
            });
          }
        }
      }
      
      // Verify prompt state after loading
      this.verifyPromptState();
    } catch (error) {
      const errorMsg = '[StorageState] Failed to load storage state';
      console.error(errorMsg, error);
      this._stateError.set(errorMsg);
    }
  }

  saveStorageState(): void {
    if (!this.isBrowser || typeof localStorage === 'undefined') return;

    try {
      const state = this.getState();
      const stateToSave = {
        isEnabled: state.isEnabled,
        selectedPath: state.selectedPath
      };
      localStorage.setItem(this.STORAGE_STATE_KEY, JSON.stringify(stateToSave));
      this._stateError.set(null);
    } catch (error) {
      const errorMsg = '[StorageState] Failed to save storage state';
      console.error(errorMsg, error);
      this._stateError.set(errorMsg);
    }
  }

  clearStorageState(): void {
    if (!this.isBrowser || typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(this.STORAGE_STATE_KEY);
      this._stateError.set(null);
    } catch (error) {
      const errorMsg = '[StorageState] Failed to clear storage state';
      console.error(errorMsg, error);
      this._stateError.set(errorMsg);
    }
  }

  // Get previous folder state from localStorage
  getPreviousFolderState(): { selectedPath: string } | null {
    if (!this.isBrowser || typeof localStorage === 'undefined') return null;

    try {
      const storedState = localStorage.getItem(this.FOLDER_STATE_KEY);
      if (storedState) {
        const state = JSON.parse(storedState);
        if (state && state.selectedPath) {
          return { selectedPath: state.selectedPath };
        }
      }
    } catch (error) {
      console.error('[StorageState] Error reading previous folder state:', error);
    }
    return null;
  }

  // Save current folder state to localStorage
  saveFolderState(): void {
    if (!this.isBrowser || typeof localStorage === 'undefined') return;

    try {
      const state = this._fileSystemState();
      if (state.isEnabled && state.selectedPath) {
        localStorage.setItem(this.FOLDER_STATE_KEY, JSON.stringify({ 
          selectedPath: state.selectedPath 
        }));
      }
    } catch (error) {
      console.error('[StorageState] Error saving folder state:', error);
    }
  }

  // Clear previous folder state from localStorage
  clearPreviousFolderState(): void {
    if (!this.isBrowser || typeof localStorage === 'undefined') return;

    try {
      localStorage.removeItem(this.FOLDER_STATE_KEY);
    } catch (error) {
      console.error('[StorageState] Error clearing previous folder state:', error);
    }
  }
}
export {
  FileSystemStorageState, FolderReconnectionPrompt // Replace BehaviorSubjects with signals
};

