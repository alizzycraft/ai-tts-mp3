import { Injectable, TemplateRef, signal, computed } from '@angular/core';

export interface ModalConfig<T = unknown> {
  template: TemplateRef<{ $implicit: T }>;
  context: { $implicit: T };
}

export interface ModalRequest<T = unknown> {
  type: 'template' | 'component';
  template?: TemplateRef<{ $implicit: T }>;
  componentType?: string;
  context?: T;
  data?: T;
}

export interface ModalState<T = unknown> {
  template: TemplateRef<{ $implicit: T }> | null;
  componentType: string | null;
  context: T | null;
  data: T | null;
  isOpen: boolean;
  requestId: string | null;
}

@Injectable({ providedIn: 'root' })
export class ModalService {
  // Modal state management using signals
  private readonly state = signal<ModalState<unknown>>({
    template: null,
    componentType: null,
    context: null,
    data: null,
    isOpen: false,
    requestId: null
  });

  // Expose read-only computed signals
  readonly template = computed(() => this.state().template);
  readonly componentType = computed(() => this.state().componentType);
  readonly context = computed(() => this.state().context);
  readonly data = computed(() => this.state().data);
  readonly isOpen = computed(() => this.state().isOpen);
  readonly requestId = computed(() => this.state().requestId);

  // Signal for modal response
  readonly response = signal<{ requestId: string; value: unknown } | undefined>(undefined);
  /**
   * Shows a template-based modal
   */
  show<T>(config: ModalConfig<T>): string {
    const requestId = this.generateRequestId();
    this.state.set({
      template: config.template,
      componentType: null,
      context: config.context.$implicit,
      data: null,
      isOpen: true,
      requestId
    });
    return requestId;
  }

  /**
   * Shows a component-based modal
   */
  showComponent<T>(componentType: string, data?: T): string {
    const requestId = this.generateRequestId();
    this.state.set({
      template: null,
      componentType,
      context: null,
      data,
      isOpen: true,
      requestId
    });
    return requestId;
  }

  /**
   * Closes the modal with an optional response
   */
  close<T>(value?: T): void {
    const currentState = this.state();
    
    // Update state
    this.state.set({
      template: null,
      componentType: null,
      context: null,
      data: null,
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

  /**
   * Clear the response signal (for consumers to reset after handling)
   */
  clearResponse(): void {
    this.response.set(undefined);
  }

  /**
   * Generate a unique request ID for tracking modal interactions
   */
  private generateRequestId(): string {
    return `modal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
