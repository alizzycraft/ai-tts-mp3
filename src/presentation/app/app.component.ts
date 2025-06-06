import { Component, PLATFORM_ID, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { ModalOutletComponent } from './modals/modal-outlet.component';
import { signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageInitializationStateService } from '../../infrastructure/storage/storage-initialization-state.service';
import { StorageStateIntegrationService } from '../../integration/services/storage/storage-state-integration.service';
import { FileSystemStorageManagerService } from '../../infrastructure/storage/file-system-storage-manager.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, ModalOutletComponent],
  template: `
    <div *ngIf="!appInitialized()">
      <div class="app-init-overlay">
        <div class="app-init-spinner"></div>
        <div class="app-init-text">Initializing...</div>
      </div>
    </div>
    <router-outlet *ngIf="appInitialized()"></router-outlet>
    <app-modal-outlet />
    {{ maybeShowReconnectionModal() }}
  `,
  styles: []
})
export class AppComponent {
  private platformId = inject(PLATFORM_ID);
  private storageInitState = inject(StorageInitializationStateService);
  private storageIntegration = inject(StorageStateIntegrationService);
  private fileSystemStorageManager = inject(FileSystemStorageManagerService);

  // Track last shown prompt to avoid duplicate modals
  private lastPromptPath: string | null = null;
  private modalResponseHandledFor: string | null = null;

  title = 'AI-TTS-MP3';
  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      document.title = 'AI-TTS-MP3';
      // Ensure storage initialization is triggered
      this.fileSystemStorageManager.initializeService();
      // Listen for modal response and handle reconnection
      const modalService = (this.storageIntegration as any).modalService;
      effect(() => {
        const response = modalService?.response?.();
        if (response && response.requestId !== this.modalResponseHandledFor) {
          this.modalResponseHandledFor = response.requestId;
          // Only handle if we are waiting for reconnection
          const state = this.storageInitState.state();
          if (state.waitingForReconnectionPrompt) {
            // response.value: true = reconnect, false = decline
            this.fileSystemStorageManager.handleFolderReconnection(!!response.value);
          }
          modalService.clearResponse?.();
        }
      });
    }
  }

  // Purely signal-driven modal trigger (no effect):
  public readonly maybeShowReconnectionModal = computed(() => {
    const state = this.storageInitState.state();
    console.log('[SIGNAL][AppComponent] maybeShowReconnectionModal SIGNAL EMIT:', state);
    if (state.waitingForReconnectionPrompt && state.reconnectionPrompt) {
      // Only show if not already shown for this path
      if (this.lastPromptPath !== state.reconnectionPrompt.previousPath) {
        this.lastPromptPath = state.reconnectionPrompt.previousPath;
        // Show the modal (imperative, but only in computed context)
        queueMicrotask(() => {
          this.storageIntegration.showReconnectionModal(state.reconnectionPrompt!);
        });
      }
    } else {
      this.lastPromptPath = null;
    }
    return null;
  });

  // App is initialized when storage is not initializing, not waiting for reconnection, and no error
  public readonly appInitialized = computed(() => {
    const state = this.storageInitState.state();
    // Consider all relevant signals for initialization
    const initialized =
      !state.isInitializing &&
      !state.waitingForReconnectionPrompt &&
      !state.storageLoading &&
      !!state.storageLoaded &&
      (!('storageStateLoaded' in state) || !!state.storageStateLoaded) &&
      !state.initializationError;
    console.log('[SIGNAL][AppComponent] appInitialized SIGNAL EMIT:', initialized, state);
    return initialized;
  });
}
