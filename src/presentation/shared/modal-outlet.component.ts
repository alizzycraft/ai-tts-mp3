import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy, HostListener, AfterViewInit, ElementRef, inject } from '@angular/core';
import { ModalService } from './modal.service';
import { ReconnectionPromptModalComponent } from './reconnection-prompt-modal.component';

@Component({
  selector: 'app-modal-outlet',
  standalone: true,
  imports: [CommonModule, ReconnectionPromptModalComponent],
  template: `    
    @if (modalService.isOpen()) {
      <div 
        class="modal-backdrop" 
        (click)="onBackdropClick($event)"
        (keydown)="onKeyDown($event)"
        role="dialog" 
        aria-modal="true"
        [attr.aria-label]="getAriaLabel()"
        tabindex="-1">
        @if (modalService.template()) {
          <ng-container *ngTemplateOutlet="modalService.template()!"></ng-container>
        } @else if (modalService.componentType()) {
          <app-reconnection-prompt-modal></app-reconnection-prompt-modal>
        }
      </div>
    }
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      outline: none; /* Remove default focus outline */
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModalOutletComponent implements AfterViewInit {
  modalService = inject(ModalService);
  private elementRef = inject(ElementRef);

  private previousActiveElement: HTMLElement | null = null;

  ngAfterViewInit(): void {
    if (this.modalService.isOpen()) {
      this.previousActiveElement = document.activeElement as HTMLElement;
      this.focusFirstElement();
    }
  }

  getAriaLabel(): string {
    return this.modalService.title() || 'Modal dialog';
  }

  private focusFirstElement(): void {
    if (!this.modalService.isOpen()) return;

    const modalElement = this.elementRef.nativeElement.querySelector('.modal-backdrop');
    if (!modalElement) return;

    // Try to focus the first focusable element
    const focusableElements = this.getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    } else {
      // If no focusable elements, focus the modal itself
      modalElement.focus();
    }
  }

  private getFocusableElements(): HTMLElement[] {
    const element = this.elementRef.nativeElement;
    if (!element || !element.querySelectorAll) return [];    const focusableElementsSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    // Explicitly type the NodeList
    const elements: NodeListOf<Element> = element.querySelectorAll(focusableElementsSelector);
    
    // Safe type guard function
    const isHTMLElement = (el: Element): el is HTMLElement => {
      return el instanceof HTMLElement;
    };

    // Convert NodeList to Array<Element> and then filter to HTMLElements
    // Using explicit type annotation to ensure type safety
    return Array.from<Element>(elements).filter(isHTMLElement);
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.modalService.isOpen()) return;

    if (event.key === 'Escape' && this.modalService.allowDismiss()) {
      this.modalService.close();
      event.preventDefault();
    } else if (event.key === 'Tab') {
      this.handleTabKey(event);
    }
  }

  private handleTabKey(event: KeyboardEvent): void {
    const focusableElements = this.getFocusableElements();
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey && activeElement === firstElement) {
      lastElement.focus();
      event.preventDefault();
    } else if (!event.shiftKey && activeElement === lastElement) {
      firstElement.focus();
      event.preventDefault();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    // Check if the click target is the backdrop itself, not a child element
    if (event.target === event.currentTarget && this.modalService.allowDismiss()) {
      this.modalService.close();
      event.stopPropagation();
      event.preventDefault();
    }
  }
}
