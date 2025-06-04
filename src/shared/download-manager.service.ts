import { Injectable, signal, computed } from '@angular/core';

export interface DownloadItem {
  id: string;
  data: Uint8Array;
  filename: string;
  mimeType: string;
}

@Injectable({
  providedIn: 'root'
})
export class DownloadManagerService {
  private readonly _currentDownload = signal<DownloadItem | null>(null);
  readonly currentDownload = computed(() => this._currentDownload());

  startDownload(item: DownloadItem): void {
    this._currentDownload.set(item);
    this.processDownload(item);
  }

  private processDownload(item: DownloadItem): void {
    const blob = new Blob([item.data], { type: item.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = item.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this._currentDownload.set(null);
  }
}
