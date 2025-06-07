export interface IModalOutlet {
  onBackdropClick(event: MouseEvent): void;
  onKeyDown(event: KeyboardEvent): void;
  getAriaLabel(): string;
}
