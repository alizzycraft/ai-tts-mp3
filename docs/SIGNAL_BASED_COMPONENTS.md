# Component Modernization with Signal-based APIs

This document demonstrates how to modernize components in the AI-TTS-MP3 application using Angular 20's signal-based inputs and outputs.

## AudioPlayerComponent Modernization Plan

### Current Implementation

```typescript
// Current implementation using @Input decorator and signal function
@Input() currentQueryInfo = signal<CurrentQueryInfo | null>(null);
@Input() currentResult = signal<TTSResult | null>(null);

// Output events using output function
clearResult = output<void>();
```

### Modern Implementation

```typescript
// Modern signal-based input using the input function
currentQueryInfo = input<CurrentQueryInfo | null>(null);
currentResult = input<TTSResult | null>(null);

// Output events using the output function (already modern)
clearResult = output<void>();
```

## Benefits of Signal-based Inputs

1. **Better Type Safety**: More predictable type handling for inputs
2. **Enhanced Reactivity**: Direct integration with Angular's signal-based reactivity system
3. **Improved Performance**: More efficient change detection
4. **Zoneless Support**: Better support for zoneless applications
5. **Required Inputs**: Support for required inputs using `input.required<T>()`

## Implementation Steps

1. **Import Signal APIs**: Ensure proper imports for input and output functions
   ```typescript
   import { input, output } from '@angular/core';
   ```

2. **Replace @Input Decorators**: Convert @Input decorators to input function calls
   ```typescript
   // Before
   @Input() myProp: string = '';
   
   // After
   myProp = input<string>('');
   ```

3. **Add Required Inputs**: Use required inputs for mandatory properties
   ```typescript
   requiredProp = input.required<string>();
   ```

4. **Use Computed Properties**: Leverage computed for derived values
   ```typescript
   derivedValue = computed(() => {
     const value = this.myProp();
     return value.toUpperCase();
   });
   ```

5. **Implement Effects**: Use effects for side effects when inputs change
   ```typescript
   constructor() {
     effect(() => {
       const newValue = this.myProp();
       console.log(`Value changed: ${newValue}`);
     });
   }
   ```

## Example: Modernized AudioPlayerComponent

```typescript
import { Component, input, output, computed, effect, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TTSResult } from '../../integration/domain-types';

@Component({
  selector: 'app-audio-player',
  // ... other component metadata
})
export class AudioPlayerComponent implements OnDestroy {
  // Modern signal-based inputs
  currentQueryInfo = input<CurrentQueryInfo | null>(null);
  currentResult = input<TTSResult | null>(null);

  // Output signals
  clearResult = output<void>();
  
  // Computed properties
  displayText = computed(() => {
    const info = this.currentQueryInfo();
    if (!info) return '...';
    return info.title || info.text;
  });
  
  // Side effects for input changes
  constructor() {
    effect(() => {
      const result = this.currentResult();
      if (result) {
        // Handle new result being set
        this.loadAudioForResult(result);
      }
    });
  }
  
  // ... rest of the component
}
```
