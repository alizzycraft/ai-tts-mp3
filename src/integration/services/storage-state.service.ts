import { Injectable, signal } from '@angular/core';
import { ModalService } from '../../shared/modal.service';
import { FolderReconnectionPrompt } from './domain-types';

@Injectable({
  providedIn: 'root'
})
export class StorageStateService {
  // Private state management
  private readonly _folderReconnectionPrompt = signal<FolderReconnectionPrompt | null>(null);

  constructor(private modalService: ModalService) {}

  // Public signals
  readonly reconnectionPrompt = this._folderReconnectionPrompt.asReadonly();

  // Public methods
  setFolderReconnectionPrompt(prompt: FolderReconnectionPrompt | null): void {
    this._folderReconnectionPrompt.set(prompt);
    if (prompt) {
      console.debug('[StorageState] Setting up reconnection for path:', prompt.previousPath);
      this.modalService.showComponent({
        type: 'component',
        componentType: 'ReconnectionPromptModal',
        data: prompt,
        title: 'Reconnect to Folder',
        allowDismiss: false
      });
    }
  }
}