import { Routes } from '@angular/router';
import { HomeComponent } from '../../presentation/home/home.component';

/**
 * Application Routes with Lazy Loading
 * 
 * Using Angular's built-in support for lazy loading standalone components with loadComponent.
 * This approach is more modern than using NgModules and provides better performance.
 * 
 * Benefits:
 * - Reduced initial bundle size
 * - Faster initial load time
 * - On-demand loading of features
 * - No need for feature modules with standalone components
 */

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    title: 'Home - AI-TTS-MP3 App'
  },
  {
    path: 'history',
    loadComponent: () => import('../../presentation/history-panel/history-panel.component').then(m => m.HistoryPanelComponent),
    title: 'History - AI-TTS-MP3 App'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
