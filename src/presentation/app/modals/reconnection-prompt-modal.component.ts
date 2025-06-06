import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MODAL_SERVICE } from '../../../integration/tokens/modal-service.token';
import { HISTORY_STORAGE_SERVICE } from '../../../integration/tokens/history-storage.token';
import { IHistoryStorageService } from '../../../integration/interfaces/services/history-storage.interface';
import { FolderReconnectionPrompt } from '../../../integration/interfaces/models/folder-reconnection-prompt.interface';
import { IReconnectionPromptModal } from '../../../integration/interfaces/components/reconnection-prompt-modal.interface';

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
          <span class="folder-name">{{ promptData.previousPath }}</span>
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
  private readonly modalService = inject(MODAL_SERVICE);
  private readonly historyService = inject<IHistoryStorageService>(HISTORY_STORAGE_SERVICE);
  // Use the data provided by ModalService, fallback to default if missing
  get promptData(): FolderReconnectionPrompt {
    return (this.modalService.data() as FolderReconnectionPrompt) ?? { previousPath: '', shouldPrompt: true };
  }
  error = signal<string | null>(null);
  reconnecting = signal(false);
  async reconnect() {
    this.reconnecting.set(true);
    this.error.set(null);
    try {
      const result: { success: boolean; error?: string } = await this.historyService.enableFileSystemStorage();
      if (result.success) {
        this.modalService.close(true);
      } else {
        this.error.set(result.error || 'Failed to enable file system storage');
      }
    } catch (err: unknown) {
      console.error('Error during reconnection:', err);
      this.error.set(err instanceof Error ? err.message : 'Unexpected error during reconnection');
    } finally {
      this.reconnecting.set(false);
    }
  }
  decline() {
    this.modalService.close(false); // Return false for declined
  }
}
