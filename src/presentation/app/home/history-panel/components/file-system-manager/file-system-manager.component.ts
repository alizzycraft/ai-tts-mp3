import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageStateIntegrationService } from '../../../../../../integration/services/storage/storage-state-integration.service';
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
  state = input.required<StorageStateIntegrationService>();

  // Outputs
  toggleStorage = output<void>();
  changeFolder = output<void>();
}
