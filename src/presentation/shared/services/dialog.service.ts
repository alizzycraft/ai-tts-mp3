import { Injectable, TemplateRef, signal } from '@angular/core';

interface DialogTemplateContext<T> {
  $implicit: T;
}

export interface DialogConfig<T = unknown> {
  template: TemplateRef<DialogTemplateContext<T>>;
  context: T;
}

@Injectable({
  providedIn: 'root'
})
export class DialogService {
  private visible = signal(false);
  private currentConfig = signal<DialogConfig | null>(null);
  private result = signal<boolean | null>(null);

  async show<T>(config: DialogConfig<T>): Promise<boolean> {
    this.currentConfig.set(config);
    this.visible.set(true);
    
    return new Promise<boolean>((resolve) => {
      // Just return true for now, in real implementation this would wait for user action
      this.visible.set(false);
      this.currentConfig.set(null);
      resolve(true);
    });
  }

  close(result: boolean): void {
    this.result.set(result);
    this.visible.set(false);
    this.currentConfig.set(null);
  }
}
