import { bootstrapApplication } from '@angular/platform-browser';
import { ApplicationRef } from '@angular/core';
import { config } from '../app.config.server';
import { AppComponent } from '../../presentation/app/app.component';

const bootstrap = (): Promise<ApplicationRef> => 
  bootstrapApplication(AppComponent, config);

export default bootstrap;
