import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageInfo } from '../../../../integration/history-storage.service';
import { FormatFileSizePipe } from '../../../shared/pipes/format-file-size.pipe';

@Component({
  selector: 'app-storage-info',
  standalone: true,
  imports: [CommonModule, FormatFileSizePipe],
  template: `
    <div class="storage-info" *ngIf="showStorageBar()">
      <div class="storage-bar">
        <div 
          class="used-space" 
          [class.warning]="warningLevel() === 'warning'"
          [class.critical]="warningLevel() === 'critical'"
          [style.width.%]="(storageInfo().usedPercentage) * 100">
        </div>
      </div>
      <div class="storage-text">
        {{ storageInfo().used | formatFileSize }} used
        of {{ storageInfo().total | formatFileSize }}
      </div>
    </div>
  `
})
export class StorageInfoComponent {
  storageInfo = input.required<StorageInfo>();
  showStorageBar = input.required<boolean>();
  warningLevel = input.required<'normal' | 'warning' | 'critical'>();
}
