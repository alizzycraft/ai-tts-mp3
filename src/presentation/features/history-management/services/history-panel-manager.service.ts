// History Panel Manager Service - handles history panel state and interactions
import { Injectable, inject, signal, computed } from '@angular/core';
import { IntegratedHistoryStorageService, HistoryItem } from '../../../../integration/history-storage.service';

export interface HistoryFilter {
  searchTerm: string;
  sortBy: 'date' | 'title' | 'duration';
  sortDirection: 'asc' | 'desc';
}

@Injectable({
  providedIn: 'root'
})
export class HistoryPanelManagerService {
  private historyService = inject(IntegratedHistoryStorageService);
  
  // State signals
  private selectedItemId = signal<string | null>(null);
  private filterState = signal<HistoryFilter>({
    searchTerm: '',
    sortBy: 'date',
    sortDirection: 'desc'
  });
  
  private historyItems = signal<HistoryItem[]>([]);
  private isLoading = signal<boolean>(false);
  private error = signal<string | null>(null);

  // Computed values
  filteredItems = computed(() => {
    const items = this.historyItems();
    const filter = this.filterState();
    
    // First apply text search if any
    let filtered = items;
    if (filter.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      filtered = items.filter(item => 
        item.text.toLowerCase().includes(term) ||
        (item.metadata?.title && item.metadata.title.toLowerCase().includes(term))
      );
    }
    
    // Then sort the results
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (filter.sortBy) {
        case 'date': {
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        }
        case 'title': {
          const titleA = a.metadata?.title || a.text.substring(0, 20);
          const titleB = b.metadata?.title || b.text.substring(0, 20);
          comparison = titleA.localeCompare(titleB);
          break;
        }
        case 'duration': {
          const durationA = a.result?.duration || 0;
          const durationB = b.result?.duration || 0;
          comparison = durationA - durationB;
          break;
        }
      }
      
      return filter.sortDirection === 'asc' ? comparison : -comparison;
    });
  });
  
  selectedItem = computed(() => {
    const id = this.selectedItemId();
    if (!id) return null;
    return this.historyItems().find(item => item.id === id) || null;
  });
  
  /**
   * Load history items
   */
  async loadHistory(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      // Subscribe to history$ observable
      this.historyService.history$.subscribe({
        next: (items) => {
          this.historyItems.set(items);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('[HistoryPanelManager] Error loading history:', err);
          this.error.set('Failed to load history items');
          this.isLoading.set(false);
        }
      });
      // No longer need to await a promise here
    } catch (err) {
      // This catch block might not be necessary with observable subscription
      console.error('[HistoryPanelManager] Unexpected error in loadHistory:', err);
      this.error.set('Failed to load history items');
      this.isLoading.set(false);
    }
  }
  
  /**
   * Select a history item
   */
  selectItem(id: string | null): void {
    this.selectedItemId.set(id);
  }
  
  /**
   * Clear selection
   */
  clearSelection(): void {
    this.selectedItemId.set(null);
  }
  
  /**
   * Update filter settings
   */
  updateFilter(filter: Partial<HistoryFilter>): void {
    this.filterState.update(current => ({
      ...current,
      ...filter
    }));
  }
  
  /**
   * Delete a history item
   */
  async deleteItem(id: string): Promise<void> {
    try {
      await this.historyService.deleteHistoryItem(id);
      
      // Clear selection if the deleted item was selected
      if (this.selectedItemId() === id) {
        this.clearSelection();
      }
      
      // Reload history items
      await this.loadHistory();
    } catch (err) {
      console.error('[HistoryPanelManager] Error deleting history item:', err);
      this.error.set('Failed to delete history item');
    }
  }
  
  /**
   * Get currently selected item ID
   */
  getSelectedItemId(): string | null {
    return this.selectedItemId();
  }
  
  /**
   * Check if an item is selected
   */
  isItemSelected(id: string): boolean {
    return this.selectedItemId() === id;
  }
}
