import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileSystemStorageState } from '../../../../integration/domain-types';

@Component({
  selector: 'app-file-system-manager',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="file-system-controls">
      <!-- Storage toggle button -->
      <button
        class="storage-toggle"
        [class.disabled]="!canClickLock()"
        (click)="toggleStorage.emit()"
        [title]="lockIconTooltip()">
        <img [src]="'assets/icons/outline/' + lockIconSrc() + '.svg'" [alt]="lockIconTooltip()">
      </button>

      <!-- Folder path display -->
      @if (showFolderPath()) {
        <div class="folder-path">
          <span class="path-label">Storage folder:</span>
          <span class="path">{{ state().selectedPath }}</span>
          <button
            class="change-folder"
            (click)="changeFolder.emit()"
            title="Change storage folder">
            <img src="assets/icons/outline/folder-open.svg" alt="Change folder">
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .file-system-controls {
      padding: 1rem;
      border-bottom: 1px solid var(--border-color);
    }

    .storage-toggle {
      background: none;
      border: none;
      padding: 0.5rem;
      cursor: pointer;
      opacity: 0.8;
      transition: opacity 0.2s;

      &:hover {
        opacity: 1;
      }

      &.disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      img {
        width: 20px;
        height: 20px;
      }
    }

    .folder-path {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.5rem;
      font-size: 0.9em;
      color: var(--text-muted);

      .path-label {
        font-weight: 500;
      }

      .path {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .change-folder {
        background: none;
        border: none;
        padding: 0.25rem;
        cursor: pointer;
        opacity: 0.8;
        transition: opacity 0.2s;

        &:hover {
          opacity: 1;
        }

        img {
          width: 16px;
          height: 16px;
        }
      }
    }
  `]
})
export class FileSystemManagerComponent {
  // Inputs
  state = input.required<FileSystemStorageState>();

  // Computed values
  showFolderPath = computed(() => {
    return this.state().isEnabled && this.state().selectedPath;
  });

  lockIconSrc = computed(() => {
    return this.state().isEnabled 
      ? 'assets/icons/outline/archive.svg'  // Unlocked/open storage
      : 'assets/icons/outline/bookmark.svg'; // Locked/limited storage
  });

  lockIconTooltip = computed(() => {
    if (!this.state().isSupported) {
      return 'File System Access API not supported in this browser';
    }
    return this.state().isEnabled 
      ? 'Disable unlimited file system storage'
      : 'Enable unlimited file system storage';
  });

  canClickLock = computed(() => {
    return this.state().isSupported;
  });

  // Outputs
  toggleStorage = output<void>();
  changeFolder = output<void>();
}
