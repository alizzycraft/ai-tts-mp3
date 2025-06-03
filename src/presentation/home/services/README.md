# Home Component Services

This directory contains specialized services that handle distinct responsibilities separated from the main HomeComponent.

## Service Overview

### TTSGenerationManagerService
Handles all aspects of the text-to-speech generation workflow:
- Generation state management
- Storage capacity checks
- Error handling
- Proceeding with generation after user confirmation

### HistoryInteractionManagerService
Manages user interactions with the history:
- Selecting history items
- Playing audio from history items
- Managing temporary history items (when not saving to history)
- Updating query info when selecting items

### SettingsIntegrationManagerService
Coordinates settings-related operations:
- Loading saved settings on initialization
- Providing current settings to the TTS service
- Exposing settings summary information for the UI

## Architecture Note

These services follow the Single Responsibility Principle and represent a "feature service" layer within the presentation layer. They contain UI logic while delegating domain logic to the appropriate integration services.

The component itself is now primarily responsible for:
1. Coordinating these specialized services
2. Handling view-specific events
3. Providing a clean reactive interface to the template
