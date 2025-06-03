# Implementing Zoneless Change Detection

This guide outlines how to implement and maximize the benefits of Angular 20's zoneless change detection in the AI-TTS-MP3 application.

## Current Implementation

The application already has zoneless change detection configured in `app.config.ts`:

```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    // Enable zoneless change detection for Angular 20
    provideExperimentalZonelessChangeDetection(),
    provideRouter(routes),
    provideClientHydration(),
    provideHttpClient(withFetch())
  ]
};
```

## Benefits of Zoneless Change Detection

1. **Performance Improvement:** Eliminates the overhead of Zone.js change detection
2. **Reduced Memory Usage:** Fewer event listeners and lower overall memory footprint
3. **Better Debugging:** More predictable change detection cycles
4. **Explicit Updates:** Clear indication of when UI should update

## Key Areas for Implementation

### 1. Signal-Based Reactivity

Use signals for component state management:

```typescript
// Instead of this
@Input() currentResult: TTSResult | null = null;

// Use this
@Input() currentResult = input<TTSResult | null>(null);
```

### 2. Explicit Change Detection

Use `effect()` for side effects:

```typescript
constructor() {
  // Create effect to handle side effects when signals change
  effect(() => {
    const result = this.currentResult();
    if (result) {
      this.loadAudio(result);
    }
  });
}
```

### 3. Input and Output Signals

Use signal-based inputs and outputs:

```typescript
// Input signals
myInput = input<string>('default value');
optionalInput = input<string | undefined>(undefined);
requiredInput = input.required<string>();

// Output signals
myOutput = output<string>();

// In parent template
<app-child [myInput]="parentValue" (myOutput)="handleOutput($event)" />
```

### 4. Signal-Based Forms

Move from ReactiveFormsModule to signal-based forms:

```typescript
// Signal-based form control
const name = signal('');

// Signal-based form validation
const nameError = computed(() => {
  const value = name();
  if (!value) return 'Name is required';
  if (value.length < 3) return 'Name must be at least 3 characters';
  return null;
});

// Form is valid computation
const formValid = computed(() => !nameError());
```

## Implementation Strategy

1. **Start with New Components:**
   - Implement zoneless patterns in all new components
   - Use signal-based inputs and outputs

2. **Gradually Update Existing Components:**
   - Convert @Input() properties to signal inputs
   - Convert @Output() EventEmitters to signal outputs 
   - Replace ngOnChanges with computed or effect

3. **Replace Reactive Forms:**
   - Convert FormControl to signal
   - Convert FormGroup to multiple signals
   - Implement validation with computed signals

4. **Update Service Patterns:**
   - Use signals for service state
   - Replace BehaviorSubject with signals
   - Expose state through computed signals

## Code Examples

### Component with Signal Inputs/Outputs

```typescript
import { Component, input, output, effect } from '@angular/core';

@Component({
  selector: 'app-audio-control',
  template: `
    <button [disabled]="!audioLoaded()" (click)="playClicked.emit()">
      Play
    </button>
  `,
  standalone: true
})
export class AudioControlComponent {
  // Signal-based input
  audioLoaded = input<boolean>(false);
  
  // Signal-based output
  playClicked = output<void>();
  
  constructor() {
    // Effect for side effects
    effect(() => {
      console.log(`Audio loaded state changed: ${this.audioLoaded()}`);
    });
  }
}
```

### Service with Signals

```typescript
import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AudioPlayerService {
  // Private signal state
  private isPlayingSignal = signal(false);
  private currentTimeSignal = signal(0);
  private durationSignal = signal(0);
  
  // Public computed values
  isPlaying = computed(() => this.isPlayingSignal());
  currentTime = computed(() => this.currentTimeSignal());
  duration = computed(() => this.durationSignal());
  progress = computed(() => {
    const current = this.currentTimeSignal();
    const total = this.durationSignal();
    return total > 0 ? (current / total) * 100 : 0;
  });
  
  // Methods that update signals
  play(): void {
    // Implementation...
    this.isPlayingSignal.set(true);
  }
  
  pause(): void {
    // Implementation...
    this.isPlayingSignal.set(false);
  }
  
  updateTime(time: number): void {
    this.currentTimeSignal.set(time);
  }
}
```
