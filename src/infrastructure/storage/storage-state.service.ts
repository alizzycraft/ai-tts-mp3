// Storage State Management Service - Manages storage state and configuration
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

export interface FileSystemStorageState {
  isSupported: boolean;
  isEnabled: boolean;
  directoryHandle: FileSystemDirectoryHandle | null;
  selectedPath: string | null;
}

export interface FolderReconnectionPrompt {
  previousPath: string;
  shouldPrompt: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class StorageStateService {
  private readonly FOLDER_STATE_KEY = 'tts-folder-state';
  private readonly STORAGE_STATE_KEY = 'tts-storage-state';

  private fileSystemStateSubject = new BehaviorSubject<FileSystemStorageState>({
    isSupported: false,
    isEnabled: false,
    directoryHandle: null,
    selectedPath: null
  });

  private folderReconnectionSubject = new BehaviorSubject<FolderReconnectionPrompt | null>(null);

  constructor(
    @Inject(PLATFORM_ID) private platformId: object
  ) {
  }

  /** true only when running in a browser (not during SSR) */
  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  // Observables
  get fileSystemState$(): Observable<FileSystemStorageState> {
    return this.fileSystemStateSubject.asObservable();
  }

  get folderReconnectionPrompt$(): Observable<FolderReconnectionPrompt | null> {
    return this.folderReconnectionSubject.asObservable();
  }

  // Current state getters
  getState(): FileSystemStorageState {
    return this.fileSystemStateSubject.value;
  }

  getFileSystemState(): FileSystemStorageState {
    return this.fileSystemStateSubject.value;
  }

  // Initialize storage state with support detection
  initializeState(isSupported: boolean): void {
    this.fileSystemStateSubject.next({
      isSupported,
      isEnabled: false,
      directoryHandle: null,
      selectedPath: null
    });
  }

  // Update file system state
  updateFileSystemState(updates: Partial<FileSystemStorageState>): void {
    const currentState = this.fileSystemStateSubject.value;
    const newState = { ...currentState, ...updates };
    console.log('[StorageState] Updating file system state:', newState);
    this.fileSystemStateSubject.next(newState);
  }

  // Set folder reconnection prompt
  setFolderReconnectionPrompt(prompt: FolderReconnectionPrompt | null): void {
    this.folderReconnectionSubject.next(prompt);
  }

  // Clear folder reconnection prompt
  clearFolderReconnectionPrompt(): void {
    this.folderReconnectionSubject.next(null);
  }

  // Load storage state from localStorage
  async loadStorageState(): Promise<void> {
    if (!this.isBrowser || typeof localStorage === 'undefined') return;

    try {
      console.log(`[StorageState] Attempting to load storage state from localStorage key: ${this.STORAGE_STATE_KEY}`);
      const stored = localStorage.getItem(this.STORAGE_STATE_KEY);
      if (stored) {
        const savedState = JSON.parse(stored);
        console.log('[StorageState] Loaded raw state from localStorage:', stored);
        console.log('[StorageState] Parsed state:', savedState);
        if (savedState && typeof savedState === 'object' && 'isEnabled' in savedState && savedState.isEnabled) {
           console.log('[StorageState] Loaded state indicates file system storage was enabled.');
          const currentState = this.fileSystemStateSubject.value;
          this.fileSystemStateSubject.next({
            ...currentState,
            isEnabled: true,
            selectedPath: savedState.selectedPath || null // Ensure selectedPath is included if available
          });
        } else {
           console.log('[StorageState] Loaded state indicates file system storage was NOT enabled or format is unexpected.', savedState);
        }
      }
    } catch (error) {
      console.error('[StorageState] Failed to load storage state from localStorage:', error);
    }
  }

  // Save storage state to localStorage
  async saveStorageState(): Promise<void> {
    if (!this.isBrowser || typeof localStorage === 'undefined') return;

    const state = this.getFileSystemState();
     const stateToSave = {
      isEnabled: state.isEnabled,
      selectedPath: state.selectedPath
    };
    console.log(`[StorageState] Attempting to save storage state to localStorage key: ${this.STORAGE_STATE_KEY}`, stateToSave);

    try {
      localStorage.setItem(this.STORAGE_STATE_KEY, JSON.stringify(stateToSave));
      console.log('[StorageState] Storage state saved successfully.');
    } catch (error) {
      console.error('[StorageState] Failed to save storage state to localStorage:', error);
    }
  }

  // Clear storage state from localStorage
  async clearStorageState(): Promise<void> {
    if (!this.isBrowser || typeof localStorage === 'undefined') return;
    localStorage.removeItem(this.STORAGE_STATE_KEY);
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
      const state = this.fileSystemStateSubject.value;
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
