import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalService } from '../../../../../shared/modal.service';
import { FolderReconnectionPrompt } from '../../../../../infrastructure/storage/storage-state.service';
import { signal } from '@angular/core';
import { IntegratedHistoryStorageService } from '../../../../../integration/history-storage.service';

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
        <div class="modal-icon">
          <img src="assets/icons/outline/folder-down.svg" width="48" height="48" style="filter: invert(58%) sepia(65%) saturate(3530%) hue-rotate(201deg) brightness(96%) contrast(85%);" alt="Folder">
        </div>
        <p>You previously enabled unlimited storage using this folder:</p>
        <div class="folder-info">
          <img src="assets/icons/outline/folder-down.svg" width="20" height="20" class="inline-icon" alt="Folder">
          <span class="folder-name">{{ prompt()?.previousPath }}</span>
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
    .folder-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: #21262d;
      padding: 0.75rem;
      border-radius: 6px;
      margin: 0.75rem 0;
    }

    .folder-name {
      font-family: monospace;
      word-break: break-all;
    }

    .modal-icon {
      text-align: center;
      margin-bottom: 1rem;
    }

    .inline-icon {
      flex-shrink: 0;
    }

    .error-message {
      color: red;
      margin-top: 0.5rem;
      font-size: 0.875rem;
    }
  `]
})
export class ReconnectionPromptModalComponent {
  // State management - purely signal-based, reading from modal service
  readonly prompt = computed(() => this.modalService.data() as FolderReconnectionPrompt | undefined);
  readonly reconnecting = signal(false);
  readonly error = signal<string | null>(null);

  // Services
  private modalService = inject(ModalService);
  private historyService = inject(IntegratedHistoryStorageService);

  // Called when user clicks "No, use local storage"
  async decline(): Promise<void> {
    // Switch to local storage mode before closing the modal
    await this.historyService.disableFileSystemStorage();
    this.modalService.close(false);
  }

  // Called when user clicks "Yes, reconnect"
  async reconnect(): Promise<void> {
    this.reconnecting.set(true);
    this.error.set(null);
    try {
      // Try to enable file system storage (will open picker)
      const result = await this.historyService.enableFileSystemStorage();
      if (result.success) {
        this.modalService.close(true);
      } else {
        this.error.set(result.error || 'Failed to reconnect.');
        this.reconnecting.set(false);
      }
    } catch (e) {
      // If user cancels, just reset state and keep modal open
      this.error.set('Cancelled or failed to reconnect.');
      this.reconnecting.set(false);
    }
  }
}