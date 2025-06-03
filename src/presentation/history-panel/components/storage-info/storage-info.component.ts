import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageInfo } from '../../../../integration/history-storage.service';
import { FormatFileSizePipe } from '../../../shared/pipes/format-file-size.pipe';

@Component({
  selector: 'app-storage-info',
  standalone: true,
  imports: [CommonModule, FormatFileSizePipe],
  templateUrl: './storage-info.component.html',
  styleUrls: ['./storage-info.component.scss']
})
export class StorageInfoComponent {
  storageInfo = input.required<any>(); // Accepts isFileSystem, folderName, etc.
  showStorageBar = input.required<boolean>();
  warningLevel = input.required<'normal' | 'warning' | 'critical'>();
  toggleFileSystem = output<void>();
  changeFolder = output<void>();
}
