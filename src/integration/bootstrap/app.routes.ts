import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('../../presentation/home/home.component').then(m => m.HomeComponent),
    title: 'AI-TTS-MP3 - Text to Speech Converter'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
