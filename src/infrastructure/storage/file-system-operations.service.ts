// File System Operations Service - Handles File System Access API operations
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { signal } from '@angular/core';

// Polyfill for DirectoryPickerOptions if not present
interface DirectoryPickerOptions {
  mode?: 'read' | 'readwrite';
  startIn?: string;
}

// Polyfill for FileSystemDirectoryHandle.entries()
interface DirectoryHandleWithEntries extends FileSystemDirectoryHandle {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}

// Extended interfaces for File System Access API type safety
interface ExtendedFileSystemDirectoryHandle extends FileSystemDirectoryHandle {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<ExtendedFileSystemFileHandle>;
  removeEntry(name: string): Promise<void>;
}

interface ExtendedFileSystemFileHandle extends FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
  remove(): Promise<void>;
}

@Injectable({
  providedIn: 'root'
})
export class FileSystemOperationsService {
  private platformId = inject(PLATFORM_ID);


  /** true only when running in a browser (not during SSR) */
  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  // Check if File System Access API is supported (Browser only)
  isFileSystemAccessSupported(): boolean {
    if (!this.isBrowser) return false;
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  /**
   * Signal-based folder picker: returns a signal that emits the handle or null
   */
  selectDirectorySignal(options?: {
    isReconnection?: boolean;
    previousPath?: string;
  }) {
    const result = signal<FileSystemDirectoryHandle | null>(null);
    if (!this.isBrowser || !this.isFileSystemAccessSupported()) {
      result.set(null);
      return result.asReadonly();
    }
    const pickerOptions: DirectoryPickerOptions = {
      mode: 'readwrite',
      startIn: 'documents'
    };
    if (options?.isReconnection && options?.previousPath) {
      pickerOptions.startIn = 'documents';
    }
    (window as unknown as { showDirectoryPicker: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle> })
      .showDirectoryPicker(pickerOptions)
      .then(handle => {
        // Use the signal-based permission test with polling
        const permSignal = this._testWritePermissionsSignal(handle);
        const poll = setInterval(() => {
          const success = permSignal();
          if (success === true) {
            result.set(handle);
            clearInterval(poll);
          } else if (success === false) {
            result.set(null);
            clearInterval(poll);
          }
        }, 30);
      })
      .catch(() => result.set(null));
    return result.asReadonly();
  }

  private _testWritePermissionsSignal(handle: FileSystemDirectoryHandle) {
    const result = signal<boolean | null>(null);
    (handle as ExtendedFileSystemDirectoryHandle)
      .getFileHandle('tts-permission-test.tmp', { create: true })
      .then(testHandle => (testHandle as ExtendedFileSystemFileHandle).remove().then(() => result.set(true)))
      .catch(() => result.set(false));
    return result.asReadonly();
  }

  /**
   * Signal-based write file
   */
  writeFileSignal(directoryHandle: FileSystemDirectoryHandle, fileName: string, data: ArrayBuffer | Uint8Array | string) {
    const result = signal<'success' | 'error' | 'not-browser'>('not-browser');
    if (!this.isBrowser) {
      result.set('not-browser');
      return result.asReadonly();
    }
    (directoryHandle as ExtendedFileSystemDirectoryHandle)
      .getFileHandle(fileName, { create: true })
      .then(fileHandle => fileHandle.createWritable())
      .then(writable => writable.write(data).then(() => writable.close()))
      .then(() => result.set('success'))
      .catch(() => result.set('error'));
    return result.asReadonly();
  }

  /**
   * Signal-based read file
   */
  readFileSignal(directoryHandle: FileSystemDirectoryHandle, fileName: string) {
    const result = signal<File | null>(null);
    if (!this.isBrowser) {
      result.set(null);
      return result.asReadonly();
    }
    (directoryHandle as ExtendedFileSystemDirectoryHandle)
      .getFileHandle(fileName, { create: false })
      .then(fileHandle => fileHandle.getFile())
      .then(file => result.set(file))
      .catch(() => result.set(null));
    return result.asReadonly();
  }

  /**
   * Signal-based delete file
   */
  deleteFileSignal(directoryHandle: FileSystemDirectoryHandle, fileName: string) {
    const result = signal<'success' | 'error' | 'not-browser'>('not-browser');
    if (!this.isBrowser) {
      result.set('not-browser');
      return result.asReadonly();
    }
    (directoryHandle as ExtendedFileSystemDirectoryHandle)
      .removeEntry(fileName)
      .then(() => result.set('success'))
      .catch(() => result.set('error'));
    return result.asReadonly();
  }

  /**
   * Signal-based list all MP3 files in directory
   */
  listMp3FilesSignal(directoryHandle: FileSystemDirectoryHandle) {
    const result = signal<string[]>([]);
    if (!this.isBrowser) {
      result.set([]);
      return result.asReadonly();
    }
    (async () => {
      const mp3Files: string[] = [];
      try {
        for await (const entry of (directoryHandle as DirectoryHandleWithEntries).entries()) {
          const [name, entryHandle] = entry;
          if (entryHandle.kind === 'file' && name.endsWith('.mp3')) {
            mp3Files.push(name);
          }
        }
        result.set(mp3Files);
      } catch {
        result.set([]);
      }
    })();
    return result.asReadonly();
  }

  /**
   * Signal-based delete all MP3 files in directory
   */
  deleteAllMp3FilesSignal(directoryHandle: FileSystemDirectoryHandle) {
    const result = signal<'success' | 'error' | 'not-browser'>('not-browser');
    if (!this.isBrowser) {
      result.set('not-browser');
      return result.asReadonly();
    }
    this.listMp3FilesSignal(directoryHandle)().forEach(fileName => {
      this.deleteFileSignal(directoryHandle, fileName)();
    });
    result.set('success');
    return result.asReadonly();
  }

  /**
   * Signal-based reconnect to a previously stored directory
   */
  reconnectToStoredDirectorySignal(options?: { previousPath?: string }) {
    return this.selectDirectorySignal({
      isReconnection: true,
      previousPath: options?.previousPath
    });
  }
}
