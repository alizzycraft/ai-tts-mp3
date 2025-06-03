// File System Operations Service - Handles File System Access API operations
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

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
  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  /** true only when running in a browser (not during SSR) */
  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  // Check if File System Access API is supported (Browser only)
  isFileSystemAccessSupported(): boolean {
    if (!this.isBrowser) return false;
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  // Show directory picker and return selected directory handle
  async selectDirectory(options?: {
    isReconnection?: boolean;
    previousPath?: string;
  }): Promise<FileSystemDirectoryHandle> {
    if (!this.isBrowser || !this.isFileSystemAccessSupported()) {
      throw new Error('File System Access API not supported');
    }

    // Prepare directory picker options
    const pickerOptions: DirectoryPickerOptions = {
      mode: 'readwrite',
      startIn: 'documents'
    };

    // If reconnecting and we have a previous folder path, try to help user find it
    if (options?.isReconnection && options?.previousPath) {
      pickerOptions.startIn = 'documents';
    }    // Show directory picker
    const handle = await (window as unknown as { showDirectoryPicker: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker(pickerOptions);

    // Test write permissions by attempting to create a test file
    await this.testWritePermissions(handle);

    return handle;
  }
  // Test write permissions by creating and removing a test file
  async testWritePermissions(handle: FileSystemDirectoryHandle): Promise<void> {
    try {
      const testHandle = await (handle as ExtendedFileSystemDirectoryHandle).getFileHandle('tts-permission-test.tmp', { create: true });
      await (testHandle as ExtendedFileSystemFileHandle).remove();
    } catch (permissionError) {
      console.error('[FileSystemOperations] Write permission test failed:', permissionError);
      throw new Error('Write permission denied for selected folder. Please choose a folder you have write access to.');
    }
  }

  // Write file to directory
  async writeFile(
    directoryHandle: FileSystemDirectoryHandle,
    fileName: string,
    data: ArrayBuffer | Uint8Array | string
  ): Promise<void> {
    if (!this.isBrowser) return;    try {
      const fileHandle = await (directoryHandle as ExtendedFileSystemDirectoryHandle).getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(data);
      await writable.close();
    } catch (error) {
      console.error(`[FileSystemOperations] Failed to write file ${fileName}:`, error);
      throw error;
    }
  }

  // Read file from directory
  async readFile(
    directoryHandle: FileSystemDirectoryHandle,
    fileName: string
  ): Promise<File | null> {
    if (!this.isBrowser) return null;    try {
      const fileHandle = await (directoryHandle as ExtendedFileSystemDirectoryHandle).getFileHandle(fileName, { create: false });
      return await fileHandle.getFile();
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'NotFoundError') {
        return null; // File not found is expected for new folders
      }
      throw error; // Re-throw other errors
    }
  }

  // Delete file from directory
  async deleteFile(
    directoryHandle: FileSystemDirectoryHandle,
    fileName: string
  ): Promise<void> {
    if (!this.isBrowser) return;    try {
      await (directoryHandle as ExtendedFileSystemDirectoryHandle).removeEntry(fileName);
    } catch (error: unknown) {
      if (!(error instanceof Error && error.name === 'NotFoundError')) {
        console.error(`[FileSystemOperations] Error deleting file ${fileName}:`, error);
        throw error;
      }
    }
  }

  // List all MP3 files in directory
  async listMp3Files(directoryHandle: FileSystemDirectoryHandle): Promise<string[]> {
    if (!this.isBrowser) return [];

    const mp3Files: string[] = [];
    try {
      for await (const entry of (directoryHandle as DirectoryHandleWithEntries).entries()) {
        const [name, entryHandle] = entry;
        if (entryHandle.kind === 'file' && name.endsWith('.mp3')) {
          mp3Files.push(name);
        }
      }
    } catch (error) {
      console.error('[FileSystemOperations] Error listing MP3 files:', error);
    }
    return mp3Files;
  }
  // Delete all MP3 files in directory
  async deleteAllMp3Files(directoryHandle: FileSystemDirectoryHandle): Promise<void> {
    if (!this.isBrowser) return;

    const mp3Files = await this.listMp3Files(directoryHandle);
    for (const fileName of mp3Files) {
      try {
        await this.deleteFile(directoryHandle, fileName);
      } catch (error) {
        console.error(`[FileSystemOperations] Failed to delete audio file ${fileName}:`, error);
      }
    }
  }

  // Reconnect to a previously stored directory
  async reconnectToStoredDirectory(options?: {
    previousPath?: string;
  }): Promise<FileSystemDirectoryHandle> {
    if (!this.isBrowser || !this.isFileSystemAccessSupported()) {
      throw new Error('File System Access API not supported');
    }

    // Since File System Access API doesn't provide a way to directly reconnect to a stored handle,
    // we need to prompt the user to select the directory again
    // We can provide context to help them find the same folder they used before
    return await this.selectDirectory({
      isReconnection: true,
      previousPath: options?.previousPath
    });
  }
}
