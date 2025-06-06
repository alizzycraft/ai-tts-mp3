import { Injectable, TemplateRef, signal, computed, Type } from '@angular/core';
import { ReconnectionPromptModalComponent } from './reconnection-prompt-modal.component';

export type ModalComponentType = Type<ReconnectionPromptModalComponent>;

export interface ModalRequest<T = unknown> {
  type: 'template' | 'component';
  template?: TemplateRef<T>;
  componentType?: ModalComponentType;
  data?: T;
  title?: string;
  allowDismiss?: boolean;
}

export interface ModalState<T = unknown> {
  template: TemplateRef<T> | null;
  componentType: ModalComponentType | null;
  data: T | null;
  title: string | null;
  allowDismiss: boolean;
  isOpen: boolean;
  requestId: string | null;
}

@Injectable({ providedIn: 'root' })
export class ModalService {
  // Modal state management using signals
  private readonly state = signal<ModalState<unknown>>({
    template: null,
    componentType: null,
    data: null,
    title: null,
    allowDismiss: true,  
    isOpen: false,
    requestId: null
  });

  // Expose read-only computed signals
  readonly template = computed(() => this.state().template);
  readonly componentType = computed(() => this.state().componentType);
  readonly data = computed(() => this.state().data);
  readonly title = computed(() => this.state().title);
  readonly allowDismiss = computed(() => this.state().allowDismiss);
  readonly isOpen = computed(() => this.state().isOpen);
  readonly requestId = computed(() => this.state().requestId);

  // Signal for modal response 
  readonly response = signal<{ requestId: string; value: unknown } | undefined>(undefined);

  /** Shows a template-based modal */
  show<T>(config: ModalRequest<T>): string {
    const requestId = this.generateRequestId();
    this.state.set({
      template: config.template || null,
      componentType: null,
      data: config.data || null, 
      title: config.title || null,
      allowDismiss: config.allowDismiss ?? true,
      isOpen: true,
      requestId
    });
    return requestId;
  }

  /** Shows a component-based modal */
  showComponent<T>(request: ModalRequest<T>): string {
    const requestId = this.generateRequestId();
    this.state.set({
      template: null,
      componentType: request.componentType || null,
      data: request.data || null,
      title: request.title || null,
      allowDismiss: request.allowDismiss ?? true,
      isOpen: true,
      requestId
    });
    return requestId;
  }

  /** Closes the modal with an optional response */
  close<T>(value?: T): void {
    const currentState = this.state();
    
    // Update state
    this.state.set({
      template: null,
      componentType: null,
      data: null,
      title: null,
      allowDismiss: true,
      isOpen: false,
      requestId: null
    });

    // Set response with the request ID
    if (currentState.requestId) {
      this.response.set({
        requestId: currentState.requestId,
        value
      });
    }
  }

  /** Clear the response signal (for consumers to reset after handling) */
  clearResponse(): void {
    this.response.set(undefined);
  }

  /** Generate a unique request ID for tracking modal interactions */
  private generateRequestId(): string {
    return `modal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
