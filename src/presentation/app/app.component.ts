import { Component, PLATFORM_ID, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { ModalOutletComponent } from './modals/modal-outlet.component';
import { signal, computed } from '@angular/core';
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
      this.fileSystemStorageManager.startInitialization?.();
      // Listen for reconnection modal result via queue-based API
      // EFFECT REMOVED: All modal and state transitions must be signal-driven and pure.
      // The modalService and state machine now handle all modal queueing and result delivery.
      // If you need to react to modal results, use a computed or subscribe to a signal in a pure way.
    }
  }

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
