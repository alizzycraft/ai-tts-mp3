import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from '../../../presentation/app/app.component';
import { appConfig } from '../app.config';

bootstrapApplication(AppComponent, appConfig)
  .then(() => console.log('AI-TTS-MP3 application started successfully'))
  .catch(err => console.error('Error starting application:', err));
