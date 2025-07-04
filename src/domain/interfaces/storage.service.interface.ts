/**
 * Storage Service Interface
 * Domain contract for storage operations - follows onion architecture
 */

import { Signal } from '@angular/core';
import { Result } from '../../common/result';
import { HistoryItem, StorageState, StorageInfo } from '../storage.entity';

/**
 * Domain service interface for storage operations
 * This interface defines the contract that storage implementations must follow
 */
export interface IStorageService {
  /**
   * Current storage state as a reactive signal
   */
  readonly state: Signal<StorageState>;

  /**
   * Current storage info as a reactive signal
   */
  readonly storageInfo: Signal<StorageInfo>;
  /**
   * History items as a reactive signal
   */
  readonly history: Signal<readonly HistoryItem[]>;
  /**
   * Initialize storage system
   * @returns Initialization result
   */
  initialize(): Result<boolean, string>;

  /**
   * Store a new history item
   * @param item - The history item to store
   * @returns Storage result
   */
  storeItem(item: HistoryItem): Result<boolean, string>;

  /**
   * Remove a history item by ID
   * @param itemId - The ID of the item to remove
   * @returns Removal result
   */
  removeItem(itemId: string): Result<boolean, string>;

  /**
   * Clear all history items
   * @returns Clear result
   */
  clearHistory(): Result<boolean, string>;

  /**
   * Get a specific history item by ID
   * @param itemId - The ID of the item to retrieve
   * @returns The item or error result
   */
  getItem(itemId: string): Result<HistoryItem, string>;

  /**
   * Check if an item can be stored without exceeding limits
   * @param itemSize - Size of the item in bytes
   * @returns Whether the item can be stored
   */
  canStore(itemSize: number): boolean;

  /**
   * Get storage capacity information
   * @returns Current storage capacity details
   */
  getCapacityInfo(): StorageInfo;
}
