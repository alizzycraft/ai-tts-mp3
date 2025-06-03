import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileSystemStorageState } from '../../../../integration/domain-types';

@Component({
  selector: 'app-file-system-manager',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- File system manager reserved for advanced controls or reconnection prompts only -->
    <!-- (No duplicate storage/folder UI here) -->
  `,
  styles: []
})
export class FileSystemManagerComponent {
  // Inputs
  state = input.required<FileSystemStorageState>();

  // Outputs
  toggleStorage = output<void>();
  changeFolder = output<void>();
}
