import { Component, PLATFORM_ID, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { ModalOutletComponent } from '../shared/modal-outlet.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ModalOutletComponent],
  template: `
    <router-outlet></router-outlet>
    <app-modal-outlet />
  `,
  styles: []
})
export class AppComponent {
  private platformId = inject(PLATFORM_ID);

  title = 'AI-TTS-MP3';
  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      document.title = 'AI-TTS-MP3';
    }
  }
}
