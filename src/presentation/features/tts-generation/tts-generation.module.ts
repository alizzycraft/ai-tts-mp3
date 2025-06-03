// TTS Generation Feature Module
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';

// Import components specific to this feature
import { AudioPlayerComponent } from './components/audio-player.component';
import { AudioPlayerModernComponent } from './components/audio-player-modern.component';
import { EditorComponent } from './components/editor.component';

// Shared components
import { FormatDatePipe } from '../../../shared/pipes/format-date.pipe';
import { FormatDurationPipe } from '../../../shared/pipes/format-duration.pipe';
import { FormatFileSizePipe } from '../../../shared/pipes/format-file-size.pipe';
import { TruncateTextPipe } from '../../../shared/pipes/truncate-text.pipe';

// Define routes for this feature
const ttsGenerationRoutes: Routes = [
  // No standalone routes for now, components are used within the home component
];

@NgModule({
  declarations: [
    // No declarations for standalone components
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(ttsGenerationRoutes),
    // Import standalone components
    AudioPlayerComponent,
    AudioPlayerModernComponent,
    EditorComponent,
    FormatDatePipe,
    FormatDurationPipe,
    FormatFileSizePipe,
    TruncateTextPipe
  ],
  exports: [
    AudioPlayerComponent,
    AudioPlayerModernComponent,
    EditorComponent
  ],
})
export class TtsGenerationModule { }
