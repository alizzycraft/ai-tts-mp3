# PRD-Technical-Specs: AI-TTS-MP3 Angular 20

This document provides detailed technical specifications for key systems and workflows in the AI-TTS-MP3 project. For project overview, architecture, and agent navigation, see:
- [PRD-Core.md](./PRD-Core.md)
- [PRD-Architecture.md](./PRD-Architecture.md)
- [AI-Agent-Guide.md](./AI-Agent-Guide.md)

---

## 1. Modal Dialog System

### Implementation Details
- Use Angular CDK Overlay for modal dialogs.
- All dialogs must be implemented as standalone Angular components.
- Dialogs must be opened/closed via a centralized DialogService.
- Dialog state (open/close, data) must be managed via RxJS Subjects/Observables.
- Dialogs must be accessible (ARIA roles, focus trap, keyboard navigation).

#### Example Usage
- To open a dialog: `dialogService.open(MyDialogComponent, { data: ... })`
- To close: `dialogService.close()`

#### Testing
- Use Angular TestBed to test dialog open/close and data passing.
- Test accessibility features (focus, ARIA attributes).

---

## 2. Audio Playback Management

### Patterns
- All audio playback is managed by `audio-player.service.ts` (infrastructure layer).
- Playback state (playing, paused, stopped, current time, duration) is exposed as RxJS Observables.
- Only one audio resource may play at a time (enforced by service logic).
- UI components subscribe to playback state and control playback via service methods.

#### Example API
- `play(resourceId: string)`
- `pause()`
- `stop()`
- `seek(time: number)`
- `state$: Observable<AudioPlaybackState>`

#### Testing
- Use Jasmine/Karma to test playback state transitions and event emissions.
- Mock audio resources for unit tests.

---

## 3. Speech Generation UI Flow & State Management

### Flow
1. User enters text and selects voice/provider.
2. UI dispatches a request to the TTS application service (enactment layer).
3. Service manages async state: pending, generating, success, error.
4. UI displays progress, disables controls during generation.
5. On success, audio is available for playback/download.

### State Management
- Use RxJS BehaviorSubjects for UI state (input, loading, error, result).
- All state transitions must be explicit and testable.
- UI must reactively update based on state changes.

#### Example State Interface
```ts
interface SpeechGenUIState {
  inputText: string;
  selectedVoice: string;
  isLoading: boolean;
  error: string | null;
  audioUrl: string | null;
}
```

#### Testing
- Test all state transitions (input, loading, error, success).
- Test UI disables/enables controls appropriately.

---

## 4. Testing Patterns & Examples

### General
- All services and components must have unit tests (Jasmine/Karma).
- Use Angular TestBed for component/service tests.
- Use spies/mocks for dependencies.

### Modal Dialog Example
```ts
describe('DialogService', () => {
  it('should open and close a dialog', () => {
    // ...test logic...
  });
});
```

### Audio Playback Example
```ts
describe('AudioPlayerService', () => {
  it('should play and pause audio', () => {
    // ...test logic...
  });
});
```

### Speech Generation UI Example
```ts
describe('SpeechGenComponent', () => {
  it('should update state on generate', () => {
    // ...test logic...
  });
});
```

---

## Cross-References
- [PRD-Core.md](./PRD-Core.md): Project overview, workflow, and checklist
- [PRD-Architecture.md](./PRD-Architecture.md): Architecture, layering, and conventions
- [AI-Agent-Guide.md](./AI-Agent-Guide.md): Navigation and usage guide for agents
