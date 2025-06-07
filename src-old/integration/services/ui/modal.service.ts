import { Injectable, TemplateRef, signal, computed, Type } from '@angular/core';
import { IModalService, ModalComponentOptions } from '../../../domain/contracts/interfaces/services/modal-service.interface';

export type ModalComponentType = Type<unknown>;

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
export class ModalService implements IModalService {
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

  // Modal queue state
  private readonly queue = signal<ModalRequest[]>([]);
  private readonly queueResults = new Map<string, ReturnType<typeof signal>>();

  // Computed: current modal request (head of queue)
  readonly currentRequest = computed(() => this.queue()[0] ?? null);

  // Computed: is any modal open (queue not empty)
  readonly isAnyOpen = computed(() => {
    const open = this.queue().length > 0;
    console.log('[MODAL][DEBUG] isAnyOpen computed:', open, this.queue());
    return open;
  });

  // Expose current modal state for outlet
  readonly template = computed(() => this.currentRequest()?.template ?? null);
  readonly componentType = computed(() => this.currentRequest()?.componentType ?? null);
  readonly data = computed(() => this.currentRequest()?.data ?? null);
  readonly title = computed(() => this.currentRequest()?.title ?? null);
  readonly allowDismiss = computed(() => this.currentRequest()?.allowDismiss ?? true);
  readonly isOpen = this.isAnyOpen;
  readonly requestId = computed(() => this.currentRequest() ? this._getRequestId(this.currentRequest()!) : null);

  /** Shows a template-based modal (legacy API, now enqueues) */
  show<T>(config: ModalRequest<T>): string {
    const id = this._getRequestId(config);
    this.enqueue(config);
    return id;
  }
  /** Shows a component-based modal (legacy API, now enqueues) */
  showComponent<T = unknown>(options: ModalComponentOptions<T>): void {
    const req: ModalRequest<T> = {
      type: 'component',
      componentType: options.componentType as ModalComponentType,
      data: options.data,
      allowDismiss: options.allowDismiss
    };
    this.enqueue(req);
  }

  /**
   * Enqueue a modal request and return a signal for its result
   */
  enqueue<T = unknown>(request: ModalRequest<T>): ReturnType<typeof signal<T | null>> {
    const id = this._getRequestId(request);
    console.log('[MODAL] enqueue called:', request, 'id:', id);
    // Only enqueue if not already in queue
    if (!this.queue().some(r => this._getRequestId(r) === id)) {
      this.queue.set([...this.queue(), request]);
      console.log('[MODAL] modal enqueued:', id);
    }
    // Create or reuse result signal
    let resultSignal = this.queueResults.get(id) as ReturnType<typeof signal<T | null>> | undefined;
    if (!resultSignal) {
      resultSignal = signal<T | null>(null);
      this.queueResults.set(id, resultSignal);
      console.log('[MODAL] result signal created:', id);
    }
    return resultSignal;
  }

  /**
   * Close the current modal and deliver result to signal
   */
  close<T>(value?: T): void {
    const current = this.currentRequest();
    if (!current) return;
    const id = this._getRequestId(current);
    console.log('[MODAL] close called for id:', id, 'value:', value);
    // Deliver result
    const resultSignal = this.queueResults.get(id) as ReturnType<typeof signal<T | null>> | undefined;
    if (resultSignal) resultSignal.set(value ?? null);
    // Remove from queue
    this.queue.set(this.queue().slice(1));
    // Clean up result signal after a tick
    setTimeout(() => this.queueResults.delete(id), 100);
    console.log('[MODAL] modal closed and cleaned up:', id);
  }

  /**
   * Helper: get or generate a request ID for a modal request
   */
  private _getRequestId(request: ModalRequest): string {
    // Use a stable hash of the request or fallback to a random string
    if ((request as any).requestId) return (request as any).requestId;
    const base = `${request.type}:${request.title ?? ''}:${request.componentType ?? ''}:${request.template ?? ''}`;
    return `modal_${btoa(unescape(encodeURIComponent(base))).replace(/=+$/, '')}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Clear all modal results (for consumers to reset after handling)
   */
  clearAllResults(): void {
    this.queueResults.clear();
  }
}
