/**
 * Core TTS Domain Entity
 * Represents the business logic for text-to-speech operations
 */

export enum ModelProvider {
  OPENAI = 'openai',
  ELEVENLABS = 'elevenlabs',
  EDGE = 'edge',
  AZURE = 'azure',
  GOOGLE = 'google',
  AWS = 'aws'
}

export enum Voice {
  // OpenAI voices
  ALLOY = 'alloy',
  ECHO = 'echo',
  FABLE = 'fable',
  ONYX = 'onyx',
  NOVA = 'nova',
  SHIMMER = 'shimmer',
  ASH = 'ash',
  BALLAD = 'ballad',
  CORAL = 'coral',
  SAGE = 'sage',
  VERSE = 'verse',
    // ElevenLabs voices (examples)
  RACHEL = 'rachel',
  DREW = 'drew',
  CLYDE = 'clyde',
  PAUL = 'paul',
  DOMI = 'domi',
  DAVE = 'dave',
  FINN = 'finn',
  FREYA = 'freya',
  GRACE = 'grace',
  DANIEL = 'daniel',
  
  // Microsoft Edge voices (popular ones)
  ARIA = 'aria',           // Female, US English
  JENNY = 'jenny',         // Female, US English  
  GUY = 'guy',             // Male, US English
  DAVIS = 'davis',         // Male, US English
  JANE = 'jane',           // Female, US English
  JASON = 'jason',         // Male, US English
  NANCY = 'nancy',         // Female, US English
  TONY = 'tony',           // Male, US English
  SONIA = 'sonia',         // Female, UK English
  RYAN = 'ryan'            // Male, UK English
}

export interface TTSSettings {
  provider: ModelProvider;
  model: string;
  voice: Voice;
  apiKey?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
}

export interface TTSRequest {
  text: string;
  settings: TTSSettings;
  id: string;
  timestamp: Date;
}

export enum TTSResultStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface TTSResult {
  id: string;
  request: TTSRequest;
  status: TTSResultStatus;
  audioUrl?: string;
  audioData?: Blob;
  error?: string;
  duration?: number;
  fileSize?: number;
  createdAt: Date;
  completedAt?: Date;
}

export interface AudioMetadata {
  duration: number;
  fileSize: number;
  format: string;
  bitrate?: number;
  sampleRate?: number;
}

/**
 * TTS Query represents a complete text-to-speech generation request
 */
export class TTSQuery {
  constructor(
    public readonly id: string,
    public readonly text: string,
    public readonly settings: TTSSettings,
    public readonly timestamp: Date = new Date()
  ) {}

  /**
   * Create a new TTS query with generated ID
   */
  static create(text: string, settings: TTSSettings): TTSQuery {
    const id = crypto.randomUUID();
    return new TTSQuery(id, text, settings);
  }

  /**
   * Validate if the query is ready for processing
   */
  isValid(): boolean {
    return this.text.trim().length > 0 && 
           !!this.settings.provider && 
           !!this.settings.voice &&
           !!this.settings.apiKey;
  }

  /**
   * Get estimated duration for the text (rough approximation)
   */
  getEstimatedDuration(): number {
    // Rough estimate: ~150 words per minute average speaking rate
    const wordCount = this.text.trim().split(/\s+/).length;
    return Math.ceil((wordCount / 150) * 60); // seconds
  }
}
