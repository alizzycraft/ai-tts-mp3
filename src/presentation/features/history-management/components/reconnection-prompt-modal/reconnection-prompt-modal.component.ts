import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalRef } from '../../../../../shared/modal/modal.service';

type ReconnectionModalResult = 'reconnect' | 'decline' | undefined;

@Component({
  selector: 'app-reconnection-prompt-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="reconnection-prompt-container">
      <h3>Reconnect to Folder</h3>
      <p>The application needs permission to access the previously selected folder to save history items.</p>
      <button (click)="reconnect()">Reconnect</button>
      <button (click)="decline()">Use Local Storage Instead</button>
    </div>
  `,
  styleUrl: './reconnection-prompt-modal.component.scss',
})
export class ReconnectionPromptModalComponent {
  constructor(private modalRef: ModalRef<ReconnectionModalResult>) {}

  reconnect(): void {
    this.modalRef.close('reconnect');
  }

  decline(): void {
    this.modalRef.close('decline');
  }
} 