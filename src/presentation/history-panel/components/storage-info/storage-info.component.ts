import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormatFileSizePipe } from '../../../shared/pipes/format-file-size.pipe';

@Component({
  selector: 'app-storage-info',
  standalone: true,
  imports: [CommonModule, FormatFileSizePipe],
  templateUrl: './storage-info.component.html',
  styleUrls: ['./storage-info.component.scss']
})
export class StorageInfoComponent {  storageInfo = input.required<{
    isFileSystem: boolean;
    folderName?: string;
    used: number;
    available: number;
    usedPercentage: number;
    itemCount: number;
  }>(); // Storage information type
  showStorageBar = input.required<boolean>();
  warningLevel = input.required<'normal' | 'warning' | 'critical'>();
  toggleFileSystem = output<void>();
  changeFolder = output<void>();
}
