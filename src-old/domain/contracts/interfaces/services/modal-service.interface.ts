// Modal service interface for domain layer
export interface ModalComponentOptions<T = unknown> {
  type: 'component';
  componentType: unknown;
  data?: T;
  allowDismiss?: boolean;
}

export interface IModalService {
  showComponent<T = unknown>(options: ModalComponentOptions<T>): void;
  close(result?: unknown): void;
  data(): unknown;
  template(): unknown;
  componentType(): unknown;
  title(): string | null;
  allowDismiss(): boolean;
  isOpen(): boolean;
}
