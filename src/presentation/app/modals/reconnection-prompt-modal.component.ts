import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MODAL_SERVICE } from '../../../integration/tokens/modal-service.token';
import { HISTORY_STORAGE_SERVICE } from '../../../integration/tokens/history-storage.token';
import { IHistoryStorageService } from '../../../integration/interfaces/services/history-storage.interface';
import { FolderReconnectionPrompt } from '../../../integration/interfaces/models/folder-reconnection-prompt.interface';
import { IReconnectionPromptModal } from '../../../integration/interfaces/components/reconnection-prompt-modal.interface';
import { inject as injectAngular } from '@angular/core';
import { StorageInitializationStateService } from '../../../infrastructure/storage/storage-initialization-state.service';
import { FileSystemOperationsService } from '../../../infrastructure/storage/file-system-operations.service';

@Component({
  selector: 'app-reconnection-prompt-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Reconnect to Folder</h3>
      </div>
      <div class="modal-body">
        <p>You previously enabled unlimited storage using this folder:</p>
        <div class="folder-info">
          <img src="assets/icons/outline/folder-down.svg" width="20" height="20" class="inline-icon" alt="Folder">
          <span class="folder-name">{{ previousPath() }}</span>
        </div>
        <p>Would you like to reconnect to this folder to access your saved history?</p>
        <div *ngIf="error()" class="error-message">{{ error() }}</div>
      </div>
      <div class="modal-footer">
        <button 
          class="modal-btn secondary" 
          (click)="decline()">
          No, use local storage
        </button>
        <button 
          class="modal-btn primary" 
          (click)="reconnect()"
          [disabled]="reconnecting()">
          <ng-container *ngIf="reconnecting(); else reconnectText">Reconnecting...</ng-container>
          <ng-template #reconnectText>Yes, reconnect</ng-template>
        </button>
      </div>
    </div>
  `,
  styles: [`
    /* Only keep unique styles, remove modal-content, modal-header, modal-footer, modal-btn, modal-icon (except .inline-icon), so global styles apply */
    .folder-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: #21262d;
      padding: 0.75rem;
      border-radius: 0.5rem;
      margin: 0.75rem 0;
      font-size: 1rem;
      color: #b3b3b3;
    }
    .folder-name {
      font-family: monospace;
      word-break: break-all;
    }
    .inline-icon {
      flex-shrink: 0;
    }
    .error-message {
      color: #ff6b6b;
      margin-top: 1rem;
      font-size: 0.95rem;
    }
    .error-message.legacy {
      color: red;
      margin-top: 0.5rem;
      font-size: 0.875rem;
    }
  `]
})
export class ReconnectionPromptModalComponent implements IReconnectionPromptModal {
  // Implement promptData as a getter to satisfy the interface
  get promptData() {
    // Always return an object with the required shape, or fallback values
    return (this.modalService.data() as FolderReconnectionPrompt) ?? { previousPath: '', shouldPrompt: false };
  }

  private readonly modalService = inject(MODAL_SERVICE);
  private readonly historyService = inject<IHistoryStorageService>(HISTORY_STORAGE_SERVICE);
  private readonly initializationState = injectAngular(StorageInitializationStateService);
  private readonly fileSystemOperations = injectAngular(FileSystemOperationsService);
  error = signal<string | null>(null);
  reconnecting = signal(false);

  previousPath = computed(() => this.promptData.previousPath ?? '');

  async reconnect() {
    this.reconnecting.set(true);
    try {
      const handle = await this.fileSystemOperations.selectDirectory({
        isReconnection: true,
        previousPath: this.promptData.previousPath
      });
      // Notify the state machine of the selected handle (success)
      this.initializationState.setReconnectionModalResult(true);
      // Optionally, you could pass the handle via a service or signal if needed
    } catch (error) {
      // Notify the state machine of cancellation
      this.initializationState.setReconnectionModalResult(false);
    } finally {
      this.reconnecting.set(false);
    }
  }
  decline() {
    this.modalService.close(false); // Return false for declined
  }
}
