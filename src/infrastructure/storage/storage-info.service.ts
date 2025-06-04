// Storage Info Service - Calculates and manages storage usage statistics
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { signal, computed } from '@angular/core';
import { HistoryItem, StorageInfo } from './storage-types';
import { FileSystemStorageState } from './storage-state.service';

@Injectable({
  providedIn: 'root'
})
export class StorageInfoService {
  private readonly MAX_STORAGE_MB = 20; // Used for localStorage fallback
  private lastUpdateTime = 0;
  private readonly UPDATE_THRESHOLD_MS = 100; // Minimum time between updates

  // Replace BehaviorSubject with signal
  private readonly _storageInfo = signal<StorageInfo>({
    used: 0,
    available: 0,
    total: 0,
    usedPercentage: 0,
    itemCount: 0
  });

  // Public readonly signal
  readonly storageInfo = computed(() => this._storageInfo());

  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  /** true only when running in a browser (not during SSR) */
  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  // Current state getter
  getStorageInfo(): StorageInfo {
    return this._storageInfo();
  }

  // Calculate and update storage info
  updateStorageInfo(
    history: HistoryItem[],
    fileSystemState: FileSystemStorageState
  ): void {
    // Skip update if called too frequently 
    const now = Date.now();
    if (now - this.lastUpdateTime < this.UPDATE_THRESHOLD_MS) {
      return;
    }
    this.lastUpdateTime = now;

    const storageInfo = this.calculateStorageInfo(history, fileSystemState);
    const current = this._storageInfo();

    // Only update if there are actual changes
    if (this.hasStorageInfoChanged(current, storageInfo)) {
      console.debug('[StorageInfo] Updating storage info:', storageInfo);
      this._storageInfo.update(() => storageInfo);
    }
  }

  private hasStorageInfoChanged(a: StorageInfo, b: StorageInfo): boolean {
    return a.used !== b.used ||
           a.available !== b.available ||
           a.total !== b.total ||
           a.usedPercentage !== b.usedPercentage ||
           a.itemCount !== b.itemCount;
  }

  // Calculate storage info based on current state
  private calculateStorageInfo(
    history: HistoryItem[],
    fileSystemState: FileSystemStorageState
  ): StorageInfo {
    if (!this.isBrowser) {
      // Return a default or estimated storage info for SSR
      return { used: 0, available: 0, total: 0, usedPercentage: 0, itemCount: 0 };
    }

    let used = 0;
    const itemCount = history.length;

    if (fileSystemState.isEnabled) {
      // For file system storage, we don't have easy access to total space.
      // We calculate used space based on item file sizes and provide estimates
      used = history.reduce((sum, item) => sum + (item.audioSize || 0), 0);

      // Note: This is a rough estimate. Actual file system usage might differ.
      // We cannot reliably get available/total space for arbitrary directories.
      // Placeholder values:
      const total = used > 0 ? used * 2 : 100 * 1024 * 1024; // Estimate total as double used, or 100MB default
      const available = total - used;
      const usedPercentage = total > 0 ? used / total : 0;

      return {
        used,
        available,
        total,
        usedPercentage,
        itemCount
      };

    } else {
      // Fallback for localStorage or if file system is not enabled/supported
      // We use a fixed max size for localStorage estimation.
      used = history.reduce((sum, item) => sum + (item.audioSize || 0), 0);
      const total = this.MAX_STORAGE_MB * 1024 * 1024; // Convert MB to bytes
      const available = Math.max(0, total - used); // Ensure available is not negative
      const usedPercentage = total > 0 ? used / total : 0; // Avoid division by zero

      return {
        used,
        available,
        total,
        usedPercentage,
        itemCount
      };
    }
  }

  // Check if storage is near full (> 80% but <= 90%)
  isStorageNearFull(): boolean {
    const info = this._storageInfo();
    return info.usedPercentage > 0.8 && info.usedPercentage <= 0.9;
  }

  // Check if storage is critical (> 90%)
  isStorageCritical(): boolean {
    const info = this._storageInfo();
    return info.usedPercentage > 0.9;
  }

  // Get items to be removed when storage limit is exceeded (for localStorage only)
  getItemsToBeRemoved(
    history: HistoryItem[],
    newItemSize: number,
    fileSystemState: FileSystemStorageState
  ): HistoryItem[] {
    const storageInfo = this._storageInfo();
    const itemsToRemove: HistoryItem[] = [];
    let currentSize = storageInfo.used;
    const totalLimit = fileSystemState.isEnabled 
                      ? Infinity // File system has no fixed limit we enforce here
                      : this.MAX_STORAGE_MB * 1024 * 1024; // Local storage limit

    // Only enforce limits for localStorage or if a limit is somehow defined for FS
    if (!fileSystemState.isEnabled && totalLimit !== Infinity) {
      // Iterate through history from oldest to newest
      const sortedHistory = [...history].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      for (const item of sortedHistory) {
        // If adding the new item exceeds the limit, mark this item for removal
        if (currentSize + newItemSize > totalLimit) {
          itemsToRemove.push(item);
          currentSize -= item.audioSize || 0;
        } else {
          break; // Stop when we have enough space
        }
      }
    }

    return itemsToRemove;
  }
}
