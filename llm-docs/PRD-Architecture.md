# PRD-Architecture.md - Architectural Constraints & Patterns

> **Reference Document**: Part of AI-TTS-MP3 project architecture  
> **See Also**: [PRD-Core.md](./PRD-Core.md) • [AI-Agent-Guide.md](./AI-Agent-Guide.md) • [PRD-Technical-Specs.md](./PRD-Technical-Specs.md)

## 🏗️ Onion Architecture Requirements

### Layer Organization
```
Common: Shared utilities and cross-cutting concerns
Domain: Pure business logic, entities, and repository contracts  
Enactment: Application services orchestrating domain operations
Infrastructure: External concerns like data persistence and third-party integrations
Integration: Adapters bridging domain with Angular and external frameworks
Presentation: User interface components and user interaction handling
```

### Dependency Rules
- **Inward Dependencies Only**: All dependencies point toward domain layer
- **Presentation Isolation**: Presentation layer imports only from Common and Integration layers
- **No Loose Files**: All files organized within respective layer directories
- **Bootstrap Organization**: main.ts, app.config.ts, app.routes.ts in integration/bootstrap/
- **UI Asset Organization**: index.html, styles.scss in presentation/

### Integration Layer Responsibilities
- Provide Angular-specific wrappers for domain services
- Expose tokens and providers for dependency injection
- Bridge external frameworks with domain logic
- Handle framework-specific concerns (routing, HTTP, etc.)

## ⚡ Reactive Programming Constraints (ZERO TOLERANCE)

### Forbidden Patterns
```typescript
❌ // NEVER use these patterns
const data$ = this.http.get(url);           // No Observables
await this.service.getData();               // No Promises  
useEffect(() => {}, []);                    // No Effects
setTimeout(() => {}, 1000);                 // No setTimeout
setInterval(() => {}, 1000);                // No setInterval
this.subscription = obs.subscribe();        // No subscriptions
Promise.resolve().then();                   // No promises
async methodName() { ... }                  // No async methods
new Promise((resolve) => { ... });          // No promise construction
requestAnimationFrame(() => {});            // No animation frames
```

### Required Patterns
```typescript
✅ // ALWAYS use these patterns
private _state = signal(initialValue);      // Signals only
computed(() => this.state().value);        // Computed signals
this._state.update(state => ({...state})); // Signal updates
resource(() => ({ request: apiCall }));    // Angular resource API
```

### Signal-Only State Management
```typescript
// ✅ CORRECT - Signal-based service
@Injectable({ providedIn: 'root' })
export class AudioPlayerService {
  private _playbackState = signal<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1
  });

  // Read-only signal for external consumption
  readonly playbackState = this._playbackState.asReadonly();

  // Computed signals for derived state
  readonly isPlaying = computed(() => this._playbackState().isPlaying);
  readonly progress = computed(() => {
    const state = this._playbackState();
    return state.duration > 0 ? state.currentTime / state.duration : 0;
  });

  // Command methods (no async!)
  play(): void {
    this._playbackState.update(state => ({ ...state, isPlaying: true }));
  }

  pause(): void {
    this._playbackState.update(state => ({ ...state, isPlaying: false }));
  }
}
```

### Resource API for Async Operations
```typescript
// ✅ CORRECT - Resource API pattern
@Injectable()
export class TTSService {
  private apiKey = signal<string>('');
  
  // Resource for TTS generation
  readonly generateResource = resource({
    request: () => ({ 
      text: this.currentText(), 
      voice: this.selectedVoice(),
      apiKey: this.apiKey()
    }),
    loader: async ({ request }) => {
      // Async operation wrapped in resource
      const response = await fetch('/api/tts', {
        method: 'POST',
        body: JSON.stringify(request),
        headers: { 'Content-Type': 'application/json' }
      });
      return response.blob();
    }
  });

  // State signals derived from resource
  readonly isGenerating = computed(() => this.generateResource.isLoading());
  readonly generationError = computed(() => this.generateResource.error());
  readonly audioData = computed(() => this.generateResource.value());
}
```

## 📁 File Organization Rules

### Layer Directory Structure
```
src/
├── common/                     # Cross-cutting concerns
│   ├── services/              # Shared utilities
│   ├── value-objects/         # Value objects and DTOs
│   └── types/                 # Type definitions
├── domain/                    # Business logic core
│   ├── entities/              # Domain entities
│   ├── contracts/             # Interfaces and tokens
│   └── services/              # Domain services
├── enactment/                 # Application services
│   ├── orchestration/         # Service coordination
│   ├── monitoring/            # Health and metrics
│   └── validation/            # Business rule validation
├── infrastructure/            # External integrations
│   ├── storage/               # Persistence layer
│   ├── providers/             # TTS provider implementations
│   └── browser/               # Browser API wrappers
├── integration/               # Angular framework bridge
│   ├── bootstrap/             # App startup configuration
│   ├── services/              # Angular service wrappers
│   ├── guards/                # Route guards
│   └── interceptors/          # HTTP interceptors
└── presentation/              # UI layer
    ├── app/                   # Angular components
    ├── assets/                # Static assets
    ├── styles.scss            # Global styles
    └── index.html             # HTML template
```

#### Exceptions for File Placement
- Files of the same type (e.g., all entities, all services) may be placed directly in the layer folder if:
  - All files in that folder are of the same type, and
  - The number of files is small enough that subfolders would not improve clarity.
- Files that apply globally to all subfolders (e.g., a file relevant to all entities or all services) may also reside directly in the layer folder.
- All files must still be within their respective layer directories; nothing should be outside the defined layers.

### File Naming Conventions
```typescript
// Service files
✅ user-profile.service.ts        // Kebab-case with .service
✅ tts-generation.service.ts      // Service suffix required

// Component files  
✅ modal-outlet.component.ts      // Kebab-case with .component
✅ history-panel.component.ts     // Component suffix required

// Interface files
✅ audio-player.interface.ts      // Interface suffix
✅ modal-service.interface.ts     // Interface suffix

// Token files
✅ audio-service.token.ts         // Token suffix
✅ storage-manager.token.ts       // Token suffix

// Model/Entity files
✅ history-item.entity.ts         // Entity suffix
✅ tts-request.model.ts          // Model suffix

// Value object files
✅ api-response.vo.ts             // Value object suffix
✅ validation-result.vo.ts        // Value object suffix
```

### Import Path Patterns
```typescript
// ✅ CORRECT - Layer-aware imports
import { AudioService } from '@integration/services/audio.service';
import { HistoryEntity } from '@domain/entities/history.entity';
import { StorageManager } from '@infrastructure/storage/storage-manager';
import { ValidationService } from '@enactment/validation/validation.service';
import { Logger } from '@common/services/logger.service';

// ❌ FORBIDDEN - Cross-layer violations
import { DomainService } from '@domain/...';           // Presentation can't import domain
import { InfrastructureService } from '@infrastructure/...'; // Presentation can't import infrastructure
import { Component } from '@presentation/...';        // Domain can't import presentation
```

## 🔧 Configuration Requirements

### TypeScript Configuration (tsconfig.json)
```json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@common/*": ["common/*"],
      "@domain/*": ["domain/*"], 
      "@enactment/*": ["enactment/*"],
      "@infrastructure/*": ["infrastructure/*"],
      "@integration/*": ["integration/*"],
      "@presentation/*": ["presentation/*"]
    },
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Angular Configuration (angular.json)
```json
{
  "projects": {
    "ai-tts-mp3": {
      "architect": {
        "build": {
          "options": {
            "index": "src/presentation/index.html",
            "browser": "src/integration/bootstrap/startup/main.ts",
            "styles": ["src/presentation/styles.scss"],
            "assets": [{ "input": "src/presentation/assets" }]
          }
        }
      }
    }
  }
}
```

### ESLint Constraints
```javascript
// Reactive programming enforcement
"no-restricted-imports": ["error", {
  "paths": [
    {
      "name": "rxjs",
      "message": "Use signals instead of RxJS observables"
    }
  ],
  "patterns": [
    {
      "group": ["rxjs/*"],
      "message": "Use signals instead of RxJS patterns"
    }
  ]
}],

// Architecture layer enforcement
"import/no-restricted-paths": ["error", {
  "zones": [
    {
      "target": "./src/presentation",
      "from": ["./src/domain", "./src/enactment", "./src/infrastructure"],
      "message": "Presentation layer can only import from Common and Integration layers."
    }
  ]
}]
```

## 🚨 Anti-Patterns to Avoid

### Promise/Async Violations
```typescript
❌ // FORBIDDEN patterns
async generateSpeech(): Promise<Blob> { ... }
const result = await this.service.getData();
this.http.get(url).subscribe(data => { ... });
setTimeout(() => this.updateState(), 1000);
useEffect(() => { ... }, [dependency]);

✅ // REQUIRED patterns  
generateSpeech(): void { this.triggerGeneration(); }
readonly result = computed(() => this.dataResource.value());
readonly data = this.httpResource(); // Use resource API
this.stateTimer.update(state => ({ ...state, delayed: true }));
readonly derivedData = computed(() => this.sourceData().processed);
```

### Architecture Violations
```typescript
❌ // FORBIDDEN cross-layer imports
// In presentation layer
import { DomainService } from '../../domain/services/domain.service';
import { InfraService } from '../../infrastructure/services/infra.service';

// In domain layer  
import { Component } from '../../presentation/components/component';
import { AngularService } from '../../integration/services/angular.service';

✅ // CORRECT layer imports
// In presentation layer
import { ServiceInterface } from '@integration/services/service-interface';
import { UtilityFunction } from '@common/utilities/utility-function';

// In domain layer
import { ValueObject } from '@common/value-objects/value-object';
import { Logger } from '@common/services/logger';
```

### File Organization Violations
```typescript
❌ // FORBIDDEN loose file placement
src/utils.ts                    // Must be in common/
src/components/helper.ts         // Must be in specific layer
src/random-service.ts           // Must be in appropriate layer/subdirectory

✅ // CORRECT organized placement
src/common/utilities/text-utils.ts
src/presentation/app/components/modal/modal.component.ts
src/integration/services/tts/tts-integration.service.ts
```

## ✅ Architecture Validation Checklist

### Reactive Programming Compliance
- [ ] Zero promises detected in codebase  
- [ ] Zero effects used anywhere
- [ ] Zero async/await patterns found
- [ ] Zero setTimeout/setInterval calls
- [ ] 100% signal-based state management verified
- [ ] Angular experimental resource API successfully integrated
- [ ] All async operations handled via resource pattern

### Onion Architecture Integrity  
- [ ] Strict layer adherence validated
- [ ] All dependencies flow inward toward domain
- [ ] Domain layer has zero framework dependencies
- [ ] Presentation layer only imports from Integration and Common
- [ ] All files properly organized in layer directories
- [ ] Bootstrap files in integration/bootstrap/
- [ ] UI assets in presentation/
- [ ] Inversion of Control properly implemented

### Build Configuration
- [ ] TypeScript path mappings configured for all layers
- [ ] Angular.json points to correct layer directories  
- [ ] ESLint rules enforce architectural constraints
- [ ] All imports resolve correctly with path mappings
- [ ] No "cannot find module" errors during build
- [ ] Production build generates correct asset paths

### Development Workflow
- [ ] `ng build` completes without path resolution errors
- [ ] `ng serve` starts development server successfully
- [ ] `ng lint` passes with zero architectural violations
- [ ] `ng test` runs with proper layer isolation
- [ ] All layer dependencies respect onion architecture rules

## 📦 Example package.json

Below is an example `package.json` for the AI-TTS-MP3 project, illustrating required dependencies, scripts, and conventions for Angular, SSR, linting, and build workflows:

```json
{
  "name": "ai-tts-mp3",
  "version": "1.0.0",
  "scripts": {
    "ng": "ng",
    "start": "ng serve",
    "build": "npm run lint && ng build",
    "build:static": "npm run lint && ng build --configuration production",
    "build:github-pages": "npm run lint && ng build --configuration production --base-href /ai-tts-mp3/",
    "build:spa": "npm run lint && ng build --configuration spa",
    "build:ssr": "npm run lint && ng build --configuration production",
    "watch": "ng build --watch --configuration development",
    "test": "ng test",
    "lint": "ng lint",
    "lint:fix": "ng lint --fix",
    "serve:ssr:ai-tts-mp3": "node dist/ai-tts-mp3/server/server.mjs"
  },
  "private": true,
  "dependencies": {
    "@angular/animations": "^20.0.0",
    "@angular/cdk": "^20.0.1",
    "@angular/common": "^20.0.0",
    "@angular/compiler": "^20.0.0",
    "@angular/core": "^20.0.0",
    "@angular/forms": "^20.0.0",
    "@angular/platform-browser": "^20.0.0",
    "@angular/platform-browser-dynamic": "^20.0.0",
    "@angular/platform-server": "^20.0.0",
    "@angular/router": "^20.0.0",
    "@angular/ssr": "^20.0.0",
    "express": "^5.1.0",
    "rxjs": "~7.8.0",
    "tslib": "^2.3.0"
  },
  "devDependencies": {
    "@angular-devkit/build-angular": "^20.0.0",
    "@angular/cli": "^20.0.0",
    "@angular/compiler-cli": "^20.0.0",
    "@tabler/icons": "^3.33.0",
    "@types/express": "^5.0.1",
    "@types/jasmine": "~5.1.0",
    "@types/node": "^18.19.110",
    "angular-eslint": "^20.0.0-beta.1",
    "eslint": "^9.0.0",
    "eslint-import-resolver-typescript": "^4.4.1",
    "eslint-plugin-import": "^2.31.0",
    "globals": "^16.2.0",
    "jasmine-core": "~5.1.0",
    "karma": "~6.4.0",
    "karma-chrome-launcher": "~3.2.0",
    "karma-coverage": "~2.2.0",
    "karma-jasmine": "~5.1.0",
    "karma-jasmine-html-reporter": "~2.1.0",
    "typescript": "~5.8.0",
    "typescript-eslint": "^8.0.0"
  }
}
```

> **Note:** This example reflects the required structure for Angular 20+, SSR, linting, and build scripts. Adjust versions and scripts as needed for your project evolution.

## 🔄 Cross-References

- **Core Requirements**: See [PRD-Core.md](./PRD-Core.md) for project overview and development workflow
- **Technical Specifications**: See [PRD-Technical-Specs.md](./PRD-Technical-Specs.md) for implementation patterns
- **Navigation Guide**: See [AI-Agent-Guide.md](./AI-Agent-Guide.md) for document selection guidance

---

*This document defines the architectural foundation that must be maintained throughout development. Any deviation from these patterns will compromise the project's architectural integrity and reactive programming goals.*
