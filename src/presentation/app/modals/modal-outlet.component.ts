import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy, HostListener, AfterViewInit, ElementRef, inject, Type, TemplateRef } from '@angular/core';
import { MODAL_SERVICE } from '../../../integration/tokens/modal-service.token';
import { RECONNECTION_PROMPT_MODAL } from '../../../integration/tokens/reconnection-prompt-modal.token';
import type { IModalOutlet } from '../../../integration/interfaces/components/modal-outlet.interface';

@Component({
  selector: 'app-modal-outlet',
  standalone: true,  imports: [CommonModule],
  template: `    
    @if (isOpen()) {
      <div 
        class="modal-backdrop" 
        (click)="onBackdropClick($event)"
        (keydown)="onKeyDown($event)"
        role="dialog" 
        aria-modal="true"
        [attr.aria-label]="getAriaLabel()"
        tabindex="-1">
        @if (getTemplate()) {
          <ng-container *ngTemplateOutlet="getTemplate()!"></ng-container>
        } @else if (getComponentType()) {
          <ng-container *ngComponentOutlet="getComponentType()"></ng-container>
        }
      </div>
    }  `,
  styles: [], // Using global modal styles from styles.scss
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModalOutletComponent implements AfterViewInit, IModalOutlet {
  private readonly modalService = inject(MODAL_SERVICE);
  private readonly elementRef = inject(ElementRef);
  private readonly reconnectionPromptModal = inject(RECONNECTION_PROMPT_MODAL);

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

  // Add public accessor methods
  isOpen(): boolean {
    return this.modalService.isOpen();
  }
  getTemplate(): TemplateRef<unknown> | null {
    return this.modalService.template() as TemplateRef<unknown> | null;
  }

  // Type guard for Angular Type
  private static isType(value: unknown): value is Type<unknown> {
    return typeof value === 'function' && value.prototype && value.prototype.constructor;
  }

  getComponentType(): Type<unknown> | null {
    const componentType = this.modalService.componentType();
    if (ModalOutletComponent.isType(componentType)) {
      return componentType;
    }
    return null;
  }
}
