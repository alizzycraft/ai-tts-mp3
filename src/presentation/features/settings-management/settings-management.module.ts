// Settings Management Feature Module
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';

// Import components specific to this feature
import { SettingsPanelComponent } from './components/settings-panel.component';
import { ModernSettingsFormComponent } from './components/modern-settings-form.component';

// Define routes for this feature
const settingsManagementRoutes: Routes = [
  {
    path: 'settings',
    component: SettingsPanelComponent,
    title: 'Settings - AI-TTS-MP3 App'
  }
];

@NgModule({
  declarations: [
    // No declarations for standalone components
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(settingsManagementRoutes),
    // Import standalone components
    SettingsPanelComponent,
    ModernSettingsFormComponent
  ],
  exports: [
    SettingsPanelComponent,
    ModernSettingsFormComponent
  ],
})
export class SettingsManagementModule { }
