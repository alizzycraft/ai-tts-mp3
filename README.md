# AI-TTS-MP3 - Text to Speech Converter

A modern, signal-based Angular application for converting text to speech using multiple AI providers, built with strict onion architecture and zoneless change detection.

## 🚀 Features

- **Multi-Provider Support**: OpenAI TTS and ElevenLabs integration
- **Modern UI**: Clean, responsive interface with dark theme
- **Zoneless Architecture**: Pure signal-based reactivity without zone.js
- **Onion Architecture**: Clean separation of concerns across layers
- **Real-time Audio**: Play, pause, and download generated audio
- **TypeScript**: Full type safety throughout the application

## 🏗️ Architecture

This application follows strict onion architecture principles:

```
┌─────────────────────────────────────────────┐
│                Presentation                 │
│            (UI Components)                  │
├─────────────────────────────────────────────┤
│                Integration                  │
│         (Services & Bootstrap)              │
├─────────────────────────────────────────────┤
│              Infrastructure                 │
│        (TTS Providers & Audio)              │
├─────────────────────────────────────────────┤
│                  Domain                     │
│        (Entities & Value Objects)           │
├─────────────────────────────────────────────┤
│                  Common                     │
│          (Utilities & Types)                │
└─────────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **Zoneless Change Detection**: Removed zone.js dependency for pure signal-based reactivity
2. **Signal-First**: All state management uses Angular signals
3. **No Observables/Promises**: Strict synchronous patterns with Result types
4. **Dependency Injection**: Clean DI throughout all layers
5. **Error Handling**: Comprehensive Result type pattern

## 🛠️ Technology Stack

- **Framework**: Angular 18+
- **Language**: TypeScript 5+
- **Styling**: SCSS with modern CSS features
- **Architecture**: Onion Architecture
- **State Management**: Angular Signals
- **HTTP Client**: Angular HttpClient
- **Build**: Angular CLI with Vite

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/your-username/ai-tts-mp3.git
cd ai-tts-mp3

# Install dependencies
npm install

# Start development server
npm start
```

## 🚀 Usage

1. **Enter Text**: Type or paste the text you want to convert to speech
2. **Select Provider**: Choose between OpenAI or ElevenLabs
3. **Choose Voice**: Select from available voices for the provider
4. **Add API Key**: Enter your API key for the selected provider
5. **Generate**: Click "Generate Speech" to create audio
6. **Play & Download**: Use the audio controls to play or download

## 🔑 API Keys

### OpenAI
1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy and paste into the application

### ElevenLabs
1. Visit [ElevenLabs](https://elevenlabs.io/speech-synthesis)
2. Sign up for an account
3. Generate an API key from your profile
4. Copy and paste into the application

## 🧪 Development

### Scripts

```bash
# Development server
npm start

# Build for production
npm run build:static

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Build for SPA (no SSR)
npm run build:spa

# Build for GitHub Pages
npm run build:github-pages
```

### Project Structure

```
src/
├── common/                 # Shared utilities and types
├── domain/                 # Business entities and value objects
├── infrastructure/         # External concerns (TTS providers, audio)
├── integration/           # Application services and bootstrap
├── presentation/          # UI components and styling
└── environments/          # Environment configurations
```

## 🔧 Configuration

Environment configurations are available in `src/environments/`:

- `environment.development.ts` - Development settings
- `environment.production.ts` - Production settings
- `environment.ts` - Default export

## 📚 Signal-Based Patterns

This application demonstrates advanced Angular signal patterns:

```typescript
// State management with signals
private readonly _state = signal<State>({ /* initial state */ });
public readonly state = this._state.asReadonly();

// Computed properties
canProcess = computed(() => 
  this.inputText().length > 0 && !this.isProcessing()
);

// Signal-based services
generateTTS(query: TTSQuery): Signal<Result<TTSResponse, string>> {
  // Returns signal that updates reactively
}
```

## 🏆 Best Practices

1. **Pure Functions**: All business logic is pure and testable
2. **Immutable State**: State updates through signals only
3. **Error Boundaries**: Comprehensive error handling with Result types
4. **Type Safety**: Full TypeScript coverage
5. **Reactive Patterns**: Signal-based reactivity throughout

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the established architecture patterns
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Angular team for signals and zoneless change detection
- OpenAI for TTS API
- ElevenLabs for high-quality voice synthesis

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ai-tts-mp3.git
cd ai-tts-mp3
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Open your browser and navigate to `http://localhost:4200`

## Build

- For production:
```bash
npm run build
```

- For GitHub Pages:
```bash
npm run build:github-pages
```

- For static hosting:
```bash
npm run build:static
```

## Storage Options

### File System Storage
- Enables persistent storage of audio files in a user-selected folder
- Requires modern browser support

### LocalStorage Fallback
- Automatic fallback when File System Access API is not available
- 20MB storage limit
- Works in all modern browsers

## Development

### Project Structure
- `/src/common` - Shared utilities and common types
- `/src/domain` - Core domain entities and interfaces
- `/src/enactment` - Application services and business logic orchestration
- `/src/infrastructure` - Implementation of storage and TTS providers
- `/src/integration` - Integration services and Angular-specific adapters
- `/src/presentation` - Angular components and UI

### Available Scripts
- `npm start` - Start development server
- `npm run build` - Production build
- `npm run watch` - Development build with watch mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix linting issues automatically

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/new-voice-provider`)
3. Commit your changes (`git commit -m 'Add some new-voice-provider'`)
4. Push to the branch (`git push origin feature/new-voice-provider`)
5. Open a Pull Request

## License

This project is licensed under the terms of the AGPL v3 license, the full license is in the license file in the root directory.