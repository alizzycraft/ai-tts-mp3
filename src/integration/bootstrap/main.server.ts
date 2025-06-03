import { bootstrapApplication } from '@angular/platform-browser';
import { ApplicationRef } from '@angular/core';
import { config } from './app.config.server';
import { AppComponent } from '../../presentation/app/app.component';
import { createNodeRequestHandler } from '@angular/ssr/node';
// import { FileSystemStorageService } from '../../infrastructure/file-system-storage.service'; // Removed as it's no longer used directly

const bootstrap = (): Promise<ApplicationRef> => bootstrapApplication(AppComponent, {
  providers: [
    ...config.providers, // Include existing providers from app.config.server
  ]
});

// createNodeRequestHandler expects a function that returns Promise<void>
export const reqHandler = createNodeRequestHandler(() => 
  bootstrap().then(() => {
    // Server bootstrap completed successfully
  })
);

// The default export can also be the bootstrap function
export default bootstrap;
