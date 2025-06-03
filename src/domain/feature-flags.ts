// Feature flags to control availability of different features
export const FEATURE_FLAGS = {
  METRICS_COLLECTION: false, // Metrics collection disabled by default
  FILE_SYSTEM_STORAGE: true, // File system storage enabled by default
  ADVANCED_SETTINGS: false, // Advanced settings disabled by default
  EXPERIMENTAL_PROVIDERS: false, // Experimental providers disabled by default
} as const;

// Type guard for feature names
export type FeatureName = keyof typeof FEATURE_FLAGS;

// Helper to check if a feature is enabled
export function isFeatureEnabled(feature: FeatureName): boolean {
  return FEATURE_FLAGS[feature];
}
