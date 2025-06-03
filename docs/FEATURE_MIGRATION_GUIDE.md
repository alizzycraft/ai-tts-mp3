# Feature Migration Guide

This guide outlines the step-by-step process for migrating components and services to the feature-based directory structure.

## Prerequisites

- Feature directories created:
  - `/presentation/features/tts-generation`
  - `/presentation/features/history-management`
  - `/presentation/features/settings-management`
- Component reference mapping completed

## Component and Service Migration Plan

### 1. TTS Generation Feature

#### Components to Migrate:

- **EditorComponent** (`/presentation/editor` → `/presentation/features/tts-generation/components`)
- **AudioPlayerComponent** (`/presentation/audio-player` → `/presentation/features/tts-generation/components`)

#### Services to Migrate:

- **TTSGenerationManagerService** (`/presentation/home/services` → `/presentation/features/tts-generation/services`)

### 2. History Management Feature

#### Components to Migrate:

- **HistoryPanelComponent** (`/presentation/history-panel` → `/presentation/features/history-management/components`)
- **HistoryItemComponent** (if exists)

#### Services to Migrate:

- **HistoryInteractionManagerService** (`/presentation/home/services` → `/presentation/features/history-management/services`) 

### 3. Settings Management Feature

#### Components to Migrate:

- **SettingsPanelComponent** (`/presentation/settings-panel` → `/presentation/features/settings-management/components`)

#### Services to Migrate:

- **SettingsIntegrationManagerService** (`/presentation/home/services` → `/presentation/features/settings-management/services`)

## Migration Process for Each Component/Service

### Step 1: Prepare the Component for Migration

1. **Copy the Component Files**:
   ```powershell
   Copy-Item -Path "d:\dev\github\ai-tts-mp3\src\presentation\component-name\component-name.component.*" -Destination "d:\dev\github\ai-tts-mp3\src\presentation\features\feature-name\components\"
   ```

2. **Update Import Paths**:
   - Update all relative import paths in the component
   - Update paths to point to services in their new location
   - Update paths for shared utilities

### Step 2: Update Component Metadata

1. **Update the Component Selector** (if needed):
   ```typescript
   @Component({
     selector: 'app-feature-component-name',
     // ...
   })
   ```

2. **Update Import References**:
   ```typescript
   // Before
   import { SomeService } from '../../shared/some.service';
   
   // After
   import { SomeService } from '../../../shared/some.service';
   ```

### Step 3: Update Service References

1. **Create Service Reference Map**:
   ```typescript
   // Feature service reference map
   const serviceMap = {
     'TTSGenerationManagerService': '/features/tts-generation/services',
     'HistoryInteractionManagerService': '/features/history-management/services',
     'SettingsIntegrationManagerService': '/features/settings-management/services'
   };
   ```

2. **Update Service Imports** in components:
   ```typescript
   // Before
   import { TTSGenerationManagerService } from '../../home/services/tts-generation-manager.service';
   
   // After
   import { TTSGenerationManagerService } from '../../features/tts-generation/services/tts-generation-manager.service';
   ```

### Step 4: Testing and Verification

1. **Test Component in Isolation**:
   - Create a simple test harness component
   - Verify component renders correctly
   - Test component functionality

2. **Test Component Integration**:
   - Integrate component in home component
   - Verify all interactions work correctly

### Step 5: Update References to the Migrated Component

1. **Update Home Component Import**:
   ```typescript
   // Before
   import { AudioPlayerComponent } from '../audio-player/audio-player.component';
   
   // After
   import { AudioPlayerComponent } from '../features/tts-generation/components/audio-player.component';
   ```

2. **Update Navigation and Routing** (if applicable):
   ```typescript
   // Before
   const routes: Routes = [
     { path: 'settings', component: SettingsPanelComponent }
   ];
   
   // After
   const routes: Routes = [
     { path: 'settings', component: SettingsPanelComponent }
   ];
   ```

## Example: AudioPlayerComponent Migration

### Original Location:
`/presentation/audio-player/audio-player.component.ts`

### New Location:
`/presentation/features/tts-generation/components/audio-player.component.ts`

### Required Changes:

1. **Update import paths**:
   ```typescript
   // Before
   import { FormatDatePipe } from '../shared/pipes/format-date.pipe';
   
   // After
   import { FormatDatePipe } from '../../../shared/pipes/format-date.pipe';
   ```

2. **Update service imports**:
   ```typescript
   // Before
   import { PlaybackService } from '../../integration/playback.service';
   
   // After
   import { PlaybackService } from '../../../../integration/playback.service';
   ```

3. **Handle circular dependencies** (if any):
   - Identify circular dependencies
   - Extract shared interfaces to a separate file
   - Import shared interfaces instead of importing components

## Special Considerations

### 1. Handling Shared Types and Interfaces

Move shared interfaces to appropriate locations:

```typescript
// Create a types file for each feature
// /presentation/features/tts-generation/types/index.ts
export interface GenerationOptions {
  // ...
}

// Then import from the types file
import { GenerationOptions } from '../types';
```

### 2. Cross-Feature Communication

For components that need to communicate across features:

1. Create a shared service in `/presentation/shared/services`
2. Use a mediator pattern for event broadcasting
3. Consider using signal-based state management for shared state

### 3. Multi-Phase Migration

Consider a phased approach:

1. **Phase 1**: Migrate standalone components
2. **Phase 2**: Migrate services
3. **Phase 3**: Update references
4. **Phase 4**: Clean up old files

## Checklist for Each Migration

- [ ] Component files copied to new location
- [ ] Import paths updated
- [ ] Service references updated
- [ ] Component tested in isolation
- [ ] Component integrated with home component
- [ ] All features working correctly
- [ ] Old files backed up or removed
