import { Injectable, TemplateRef, signal, computed, Signal } from '@angular/core';

export interface ModalConfig<T = unknown> {
  template: TemplateRef<{ $implicit: T }>;
  context: { $implicit: T };
}

export interface ModalState<T = unknown> {
  template: TemplateRef<{ $implicit: T }> | null;
  context: T | null;
  isOpen: boolean;
  response?: T;
}

@Injectable({ providedIn: 'root' })
export class ModalService {
  // Single source of truth for modal state 
  private readonly _state = signal<ModalState<unknown>>({
    template: null,
    context: null,
    isOpen: false,
    response: undefined
  });

  // Computed signals for accessing state
  readonly template: Signal<TemplateRef<{ $implicit: unknown }> | null> = computed(() => this._state().template);
  readonly context = computed(() => this._state().context);
  readonly isOpen = computed(() => this._state().isOpen);
  readonly response = computed(() => this._state().response);
  
  // Track current modal promise resolver
  private modalResolver?: (value: unknown) => void;

  /**
   * Shows a modal and returns a Promise that resolves with the response
   */
  show<T>(config: ModalConfig<T>): Promise<T | undefined> {
    // Set modal state
    this._state.set({
      template: config.template,
      context: config.context.$implicit,
      isOpen: true,
      response: undefined
    });

    // Create a promise that will resolve when the modal is closed
    return new Promise<T | undefined>((resolve) => {
      this.modalResolver = resolve as (value: unknown) => void;
    });
  }

  /**
   * Closes the modal with an optional response
   */
  close<T>(response?: T): void {
    this._state.set({
      template: null,
      context: null,
      isOpen: false,
      response
    });

    // Resolve the modal promise with the response
    if (this.modalResolver) {
      this.modalResolver(response);
      this.modalResolver = undefined;
    }
  }
}
