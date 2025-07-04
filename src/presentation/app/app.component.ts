import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="app-container">
      <main class="app-main">
        <router-outlet></router-outlet>
      </main>
      <footer class="app-footer">
        <div class="footer-content">
          <div class="footer-left">
            <span class="footer-by">AI-TTS-MP3</span>
            <span class="footer-version">v1.0.0</span>
          </div>
          <div class="footer-right">
            <span class="footer-license">Open Source • MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background-color: #0d1117;
      color: #e6edf3;
    }

    .app-main {
      flex: 1;
      padding: 0;
    }

    .app-footer {
      background: #0d1117;
      border-top: 1px solid #21262d;
      padding: 1rem;
      font-size: 0.875rem;
    }

    .footer-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      max-width: 1200px;
      margin: 0 auto;
    }

    .footer-left, .footer-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .footer-by {
      font-weight: 600;
    }

    .footer-version, .footer-license {
      color: #7d8590;
    }
  `]
})
export class AppComponent {
  title = 'AI-TTS-MP3';
}
