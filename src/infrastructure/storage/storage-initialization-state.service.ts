// StorageInitializationStateService: Central state for storage initialization and reconnection modal
import { Injectable, signal, computed } from '@angular/core';
import { FolderReconnectionPrompt } from '../../integration/interfaces/models/folder-reconnection-prompt.interface';

export interface StorageInitializationState {
  isInitializing: boolean;
  waitingForReconnectionPrompt: boolean;
  reconnectionPrompt: FolderReconnectionPrompt | null;
  storageLoading: boolean; // true while loading history after user choice
  storageLoaded: boolean;  // true once history is loaded and storage is ready
  initializationError: string | null;
  storageStateLoaded?: boolean; // <-- add this
}

@Injectable({ providedIn: 'root' })
export class StorageInitializationStateService {
  private readonly _state = signal<StorageInitializationState>({
    isInitializing: true,
    waitingForReconnectionPrompt: false,
    reconnectionPrompt: null,
    storageLoading: false,
    storageLoaded: false,
    initializationError: null,
    storageStateLoaded: false, // <-- add this
  });

  readonly state = computed(() => {
    const s = this._state();
    console.log('[SIGNAL][StorageInitializationStateService] SIGNAL EMIT:', s);
    return s;
  });

  // Expose a signal for the state (for consumers)
  readonly stateSignal = this.state;

  // Overlay is visible if initializing, loading, or waiting for reconnection
  readonly overlayVisibleSignal = computed(() => {
    const s = this._state();
    return s.isInitializing || s.storageLoading || s.waitingForReconnectionPrompt;
  });

  // Show reconnection modal if waiting for reconnection prompt and prompt is present
  readonly showReconnectionModalSignal = computed(() => {
    const s = this._state();
    return s.waitingForReconnectionPrompt && !!s.reconnectionPrompt;
  });

  // Signal for reconnection modal result (null = not answered, true/false = user choice)
  private readonly _reconnectionModalResultSignal = signal<boolean | null>(null);
  readonly reconnectionModalResultSignal = this._reconnectionModalResultSignal.asReadonly();
  setReconnectionModalResult(result: boolean | null) {
    this._reconnectionModalResultSignal.set(result);
  }

  setInitializing(isInitializing: boolean) {
    console.log('[STATE][StorageInitializationStateService] setInitializing:', isInitializing);
    this._state.update(s => ({ ...s, isInitializing }));
  }
  setWaitingForReconnectionPrompt(waiting: boolean, prompt: FolderReconnectionPrompt | null = null) {
    console.log('[STATE][StorageInitializationStateService] setWaitingForReconnectionPrompt:', waiting, prompt);
    this._state.update(s => ({ ...s, waitingForReconnectionPrompt: waiting, reconnectionPrompt: prompt }));
  }
  setStorageLoading(loading: boolean) {
    console.log('[STATE][StorageInitializationStateService] setStorageLoading:', loading);
    this._state.update(s => ({ ...s, storageLoading: loading }));
  }
  setStorageLoaded(loaded: boolean) {
    console.log('[STATE][StorageInitializationStateService] setStorageLoaded:', loaded);
    this._state.update(s => ({ ...s, storageLoaded: loaded }));
  }
  setInitializationError(error: string | null) {
    console.log('[STATE][StorageInitializationStateService] setInitializationError:', error);
    this._state.update(s => ({ ...s, initializationError: error }));
  }
  setStorageStateLoaded(loaded: boolean) {
    console.log('[STATE][StorageInitializationStateService] setStorageStateLoaded:', loaded);
    this._state.update(s => ({ ...s, storageStateLoaded: loaded }));
  }
}
