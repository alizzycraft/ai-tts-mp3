// Domain types for provider configuration
import { ModelProvider } from '../entities/tts.entity';

export interface ProviderConfiguration {
  provider: ModelProvider;
  apiKey?: string;
  customEndpoint?: string;
  timeout?: number;
  maxRetries?: number;
  enabled: boolean;
  displayName: string;
  priority: number;
  rateLimits?: {
    requestsPerMinute: number;
    charactersPerMinute: number;
  };
}
