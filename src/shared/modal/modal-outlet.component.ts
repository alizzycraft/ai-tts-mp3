import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ModalService } from './modal.service';

@Component({
  selector: 'app-modal-outlet',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (modalService.template()) {
      <div class="modal-backdrop">
        <ng-container *ngTemplateOutlet="modalService.template()!; context: { $implicit: modalService.context() }">
        </ng-container>
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
  `]
})
export class ModalOutletComponent {
  constructor(public modalService: ModalService) {}
}
