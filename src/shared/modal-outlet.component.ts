import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ModalService } from './modal.service';
import { ReconnectionPromptModalComponent } from '../presentation/features/history-management/components/reconnection-prompt-modal/reconnection-prompt-modal.component';

@Component({
  selector: 'app-modal-outlet',
  standalone: true,
  imports: [CommonModule, ReconnectionPromptModalComponent],  template: `
    @if (modalService.isOpen()) {
      <div class="modal-backdrop" (click)="onBackdropClick($event)">
        @if (modalService.template()) {
          <ng-container *ngTemplateOutlet="modalService.template()!; context: { $implicit: modalService.context() }">
          </ng-container>
        }
        @if (modalService.componentType()) {
          @switch (modalService.componentType()) {
            @case ('reconnection-prompt') {
              <app-reconnection-prompt-modal></app-reconnection-prompt-modal>
            }
          }
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
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModalOutletComponent {
  constructor(public modalService: ModalService) {}  onBackdropClick(event: MouseEvent): void {
    // Check if the click target is the backdrop itself, not a child element
    if (event.target === event.currentTarget) {
      // Prevent backdrop click from dismissing modal
      // Modals should only be closed via button actions
      event.stopPropagation();
      event.preventDefault();
    }
  }
}
