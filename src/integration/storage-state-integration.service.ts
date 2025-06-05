// Storage State Integration Service - Coordinates storage state with UI concerns
import { Injectable, inject } from '@angular/core';
import { StorageStateService } from '../infrastructure/storage/storage-state.service';
import { ModalService } from '../presentation/shared/modal.service';
import { FolderReconnectionPrompt, FileSystemStorageState } from '../infrastructure/domain-types';

@Injectable({
  providedIn: 'root'
})
export class StorageStateIntegrationService {
  private storageStateService = inject(StorageStateService);
  private modalService = inject(ModalService);

  // Expose infrastructure state through computed signals
  readonly fileSystemState = this.storageStateService.fileSystemState;
  readonly folderReconnectionPrompt = this.storageStateService.folderReconnectionPrompt;
  readonly stateError = this.storageStateService.stateError;

  // Delegate methods to infrastructure service
  initializeState(isSupported: boolean): void {
    this.storageStateService.initializeState(isSupported);
  }

  updateFileSystemState(updates: Partial<FileSystemStorageState>): void {
    this.storageStateService.updateFileSystemState(updates);
  }

  setFolderReconnectionPrompt(prompt: FolderReconnectionPrompt | null): void {
    this.storageStateService.setFolderReconnectionPrompt(prompt);
  }

  clearFolderReconnectionPrompt(): void {
    this.storageStateService.clearFolderReconnectionPrompt();
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

  // Integration-specific method for showing reconnection modal
  // This is called by presentation layer when they detect a reconnection prompt is needed
  showReconnectionModal(prompt: FolderReconnectionPrompt): void {
    this.modalService.showComponent({
      type: 'component',
      componentType: 'ReconnectionPromptModal',
      data: prompt,
      allowDismiss: false
    });
  }
}
