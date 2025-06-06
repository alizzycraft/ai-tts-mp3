// Storage State Integration Service
import { Injectable, inject } from '@angular/core';
import { StorageStateService } from '../../../domain/services/storage-state.service';
import { FileSystemStorageState } from '../../../domain/contracts/interfaces/models/file-system-storage-sate.interface';
import { FolderReconnectionPrompt } from '../../../domain/contracts/interfaces/models/folder-reconnection-prompt.interface';
import { MODAL_SERVICE } from '../../../domain/contracts/tokens/modal-service.token';
import { RECONNECTION_PROMPT_MODAL } from '../../../domain/contracts/tokens/reconnection-prompt-modal.token';

@Injectable({
  providedIn: 'root'
})
export class StorageStateIntegrationService {  private readonly storageStateService = inject(StorageStateService);
  private readonly modalService = inject(MODAL_SERVICE);
  private readonly reconnectionPromptModal = inject(RECONNECTION_PROMPT_MODAL);

  // Expose infrastructure state through computed signals
  readonly fileSystemState = this.storageStateService.fileSystemState;
  readonly folderReconnectionPrompt = this.storageStateService.folderReconnectionPrompt;
  readonly stateError = this.storageStateService.stateError;

  // Delegate methods to infrastructure service with type safety
  initializeState(isSupported: boolean): void {
    this.storageStateService.initializeState(isSupported);
  }
  private isValidFileSystemState(state: unknown): state is Partial<FileSystemStorageState> {
    if (!state || typeof state !== 'object') {
      return false;
    }
    
    const s = state as Record<string, unknown>;
    const validated: Partial<FileSystemStorageState> = {};

    // Validate isSupported
    if ('isSupported' in s) {
      if (typeof s['isSupported'] !== 'boolean') {
        return false;
      }
      validated.isSupported = s['isSupported'];
    }

    // Validate isEnabled
    if ('isEnabled' in s) {
      if (typeof s['isEnabled'] !== 'boolean') {
        return false;
      }
      validated.isEnabled = s['isEnabled'];
    }

    // Validate selectedPath
    if ('selectedPath' in s) {
      const path = s['selectedPath'];
      if (path !== null && typeof path !== 'string') {
        return false;
      }
      validated.selectedPath = path as string | null;
    }

    // Validate directoryHandle
    if ('directoryHandle' in s) {
      const handle = s['directoryHandle'];
      if (handle !== null && !(handle instanceof FileSystemDirectoryHandle)) {
        return false;
      }
      validated.directoryHandle = handle as FileSystemDirectoryHandle | null;
    }

    // Additional validation for required properties when enabling
    if (validated.isEnabled === true) {
      if (!('selectedPath' in validated) || !validated.selectedPath) {
        return false;
      }
      if (!('directoryHandle' in validated) || !validated.directoryHandle) {
        return false;
      }
    }

    // Copy all validated properties back to the original object
    Object.assign(state, validated);
    return true;
  }
  private isValidFolderReconnectionPrompt(data: unknown): data is FolderReconnectionPrompt {
    if (!data || typeof data !== 'object') {
      return false;
    }
    
    const s = data as Record<string, unknown>;
    
    // Validate required properties with type checks
    if (typeof s['previousPath'] !== 'string' || !s['previousPath']) {
      return false;
    }
    
    if (typeof s['shouldPrompt'] !== 'boolean') {
      return false;
    }

    // Create a new validated object and assign it back
    const validated = {
      previousPath: s['previousPath'].trim(),
      shouldPrompt: s['shouldPrompt']
    };
    
    Object.assign(data, validated);
    return true;
  }
  /**
   * Update the file system state with type-safe validation
   */  updateFileSystemState(updates: unknown): void {
    if (!updates || typeof updates !== 'object') {
      console.error('[StorageStateIntegration] Invalid file system state: not an object');
      return;
    }    // Use type guard to validate and narrow the type
    if (!this.isValidFileSystemState(updates)) {
      console.error('[StorageStateIntegration] Invalid file system state');
      return;
    }

    // After type guard passes, updates has the correct shape
    this.storageStateService.updateFileSystemState(updates);
  }  setFolderReconnectionPrompt(promptData: unknown): void {    // Handle null/undefined case
    if (promptData === null || promptData === undefined) {
      this.storageStateService.setFolderReconnectionPrompt(null);
      return;
    }

    if (!this.isValidFolderReconnectionPrompt(promptData)) {
      console.error('[StorageStateIntegration] Invalid folder reconnection prompt');      
      this.storageStateService.setFolderReconnectionPrompt(null);
      return;
    }

    // After type guard passes, TypeScript knows promptData has the correct shape
    this.storageStateService.setFolderReconnectionPrompt(promptData);
  }
  clearFolderReconnectionPrompt(): void {
    this.storageStateService.setFolderReconnectionPrompt(null);
  }

  saveStorageState(): void {
    this.storageStateService.saveStorageState();
  }

  loadStorageState(): void {
    this.storageStateService.loadStorageState();
  }

  clearStorageState(): void {
    this.storageStateService.clearStorageState();
  }

  getPreviousFolderState(): { selectedPath: string } | null {
    return this.storageStateService.getPreviousFolderState();
  }

  saveFolderState(): void {
    this.storageStateService.saveFolderState();
  }

  clearPreviousFolderState(): void {
    this.storageStateService.clearPreviousFolderState();
  }

  getState(): FileSystemStorageState {
    return this.storageStateService.getState();
  }
  showReconnectionModal(promptData: FolderReconnectionPrompt): void {
    // Validate the prompt data even though it's typed
    if (!this.isValidFolderReconnectionPrompt(promptData)) {
      console.error('[StorageStateIntegration] Invalid reconnection prompt data');
      return;
    }    this.modalService.showComponent({
      type: 'component',
      componentType: this.reconnectionPromptModal,
      data: promptData,
      allowDismiss: false
    });
  }
}
