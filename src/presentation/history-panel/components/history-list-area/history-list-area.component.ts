import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HistoryListComponent } from '../history-list/history-list.component';

@Component({
  selector: 'app-history-list-area',
  standalone: true,
  imports: [CommonModule, FormsModule, HistoryListComponent],
  template: `
    <div class="history-list-area">
      <!-- Search Bar -->
      <div class="search-bar">
        <input
          type="text"
          class="search-input"
          placeholder="Search history..."
          [value]="searchQuery()"
          (input)="updateSearchQuery($event)"
        />
        <button *ngIf="searchQuery()" class="clear-search-btn" (click)="clearSearchQuery()" title="Clear search">
          <img src="assets/icons/outline/x.svg" width="14" height="14" alt="Clear search" />
        </button>
        <button *ngIf="history().length > 0" class="clear-all-btn" (click)="clearAll.emit()" title="Clear all history">
          <img src="assets/icons/outline/trash.svg" width="16" height="16" class="inline-icon" alt="Trash" />
          All
        </button>
      </div>
      <!-- History List -->
      <app-history-list
        [history]="filteredHistory()"
        [filteredHistory]="filteredHistory()"
        [selectedItemId]="selectedItemId()"
        (itemSelected)="selectItem.emit($event)"
        (playPauseItem)="playItem.emit($event.item)"
        (deleteItem)="deleteItem.emit($event.item)"
        (clearHistory)="clearAll.emit()"
      ></app-history-list>
    </div>
  `,
  styles: [`
    .history-list-area { display: flex; flex-direction: column; height: 100%; }
    .search-bar { display: flex; align-items: center; padding: 1rem; border-bottom: 1px solid #21262d; background: #161b22; }
    .search-input { flex: 1; padding: 0.5rem; background: #0d1117; border: 1px solid #21262d; border-radius: 6px; color: #e6edf3; }
    .clear-search-btn, .clear-all-btn { margin-left: 0.5rem; background: none; border: none; color: #7d8590; cursor: pointer; border-radius: 4px; transition: all 0.2s; }
    .clear-all-btn { display: flex; align-items: center; gap: 0.25rem; color: #e6edf3; background: #21262d; border: 1px solid #30363d; padding: 0.5rem; border-radius: 6px; }
    .clear-all-btn:hover { background: rgba(218, 54, 51, 0.15); border-color: #f85149; }
  `]
})
export class HistoryListAreaComponent {
  history = input.required<any[]>();
  filteredHistory = input.required<any[]>();
  searchQuery = input.required<string>();
  selectedItemId = input.required<string | null>();
  selectItem = output<any>();
  playItem = output<any>();
  deleteItem = output<any>();
  clearAll = output<void>();
  // Add an input for the setter function
  searchQuerySetter = input<(value: string) => void>();

  // Helper methods to update input signals (InputSignal<T> does not expose .set())
  updateSearchQuery(event: Event) {
    const value = (event.target as HTMLInputElement)?.value ?? '';
    if (this.searchQuerySetter()) {
      this.searchQuerySetter()!(value);
    }
  }
  clearSearchQuery() {
    if (this.searchQuerySetter()) {
      this.searchQuerySetter()!("");
    }
  }
}
