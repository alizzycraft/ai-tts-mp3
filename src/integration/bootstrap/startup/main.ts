import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from '../../../presentation/app/app.component';
import { appConfig } from '../configuration/app.config';

bootstrapApplication(AppComponent, appConfig)
  .then(() => console.log('Client bootstrap successful'))
  .catch(err => console.error(err));
