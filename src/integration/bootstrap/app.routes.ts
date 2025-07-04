import { Routes } from '@angular/router';
import { HomeComponent } from '../../presentation/home/home.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    title: 'AI-TTS-MP3 - Text to Speech Converter'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
