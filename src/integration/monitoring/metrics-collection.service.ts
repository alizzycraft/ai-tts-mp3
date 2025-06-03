// Metrics collection service focused on application performance metrics
import { Injectable, Inject, PLATFORM_ID, signal, computed, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LoggingService, LogLevel } from '../logging.service';
import { ModelProvider } from '../../domain/tts.entity';

export interface ApplicationMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
  };
  providers: Partial<Record<ModelProvider, {
      requests: number;
      errors: number;
      averageResponseTime: number;
      lastUsed: Date;
      lastHealthCheck?: string;
      isHealthy?: boolean;
    }>>;
  storage: {
    used: number;
    available: number;
    percentageUsed: number;
  };
  errors: {
    total: number;
    byLevel: Record<LogLevel, number>;
    recentErrorRate: number; // errors per hour
  };
  system: {
    healthScore: number; // 0-100
    uptime: number;
    startTime: Date;
  };
}

export interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  provider?: ModelProvider;
  metadata?: Record<string, unknown>;
}

// Interface for provider-specific metric data
export interface ProviderMetricData {
  requests: number;
  errors: number;
  totalResponseTime: number;
  lastUsed: Date;
  isHealthy: boolean;
  averageResponseTime: number;
  lastHealthCheck?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MetricsCollectionService {
  private startTime = new Date();
  private isBrowser = false;

  // Keep last 1000 metrics for analysis
  private readonly MAX_METRICS = 1000;

  // Signals for reactive metrics
  private requestMetrics = signal<PerformanceMetric[]>([]);
  private providerMetrics = signal(new Map<ModelProvider, ProviderMetricData>());
  private storageMetrics = signal({
    used: 0,
    available: 0
  });

  // Computed signals for derived metrics
  readonly applicationMetrics = computed((): ApplicationMetrics => {
    const requests = this.requestMetrics();
    const providers = this.providerMetrics();
    const storage = this.storageMetrics();

    const successful = requests.filter(r => r.success).length;
    const failed = requests.filter(r => !r.success).length;
    const averageResponseTime = requests.length > 0 
      ? requests.reduce((sum, r) => sum + r.duration, 0) / requests.length 
      : 0;

    const healthScore = this.calculateHealthScore(successful, failed, providers);

    return {
      requests: {
        total: requests.length,
        successful,
        failed,
        averageResponseTime
      },
      providers: Object.fromEntries(
        Array.from(providers.entries()).map(([provider, metrics]) => [
          provider,
          {
            requests: metrics.requests,
            errors: metrics.errors,
            averageResponseTime: metrics.requests > 0 
              ? metrics.totalResponseTime / metrics.requests 
              : 0,
            lastUsed: metrics.lastUsed,
            isHealthy: metrics.isHealthy,
            lastHealthCheck: providers.get(provider)?.lastHealthCheck
          }
        ])
      ) as Partial<Record<ModelProvider, ProviderMetricData>>,
      storage: {
        used: storage.used,
        available: storage.available,
        percentageUsed: storage.available > 0 
          ? (storage.used / storage.available) * 100 
          : 0
      },      errors: {
        total: failed,
        byLevel: {
          [LogLevel.DEBUG]: 0,
          [LogLevel.INFO]: 0, 
          [LogLevel.WARN]: 0,
          [LogLevel.ERROR]: failed,
          [LogLevel.CRITICAL]: 0
        },
        recentErrorRate: this.calculateRecentErrorRate(requests)
      },
      system: {
        healthScore,
        uptime: Date.now() - this.startTime.getTime(),
        startTime: this.startTime
      }
    };
  });

  constructor(
    @Inject(PLATFORM_ID) platformId: object,
    private logging: LoggingService
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser) {
      // Effect to log performance metrics periodically
      effect(() => {
        const metrics = this.applicationMetrics();
        if (metrics.requests.total > 0 && metrics.requests.total % 10 === 0) {
          this.logging.debug(`Performance summary: ${metrics.requests.total} requests, ${metrics.requests.failed} failed`);
        }
      });
    }
  }

  recordRequest(operation: string, duration: number, success: boolean, provider?: ModelProvider, metadata?: Record<string, unknown>): void {
    if (!this.isBrowser) return;

    const metric: PerformanceMetric = {
      operation,
      duration,
      timestamp: new Date(),
      success,
      provider,
      metadata
    };

    // Update the signal by adding new metric and trimming if needed
    this.requestMetrics.update(metrics => {
      const updated = [...metrics, metric];
      return updated.length > this.MAX_METRICS 
        ? updated.slice(-this.MAX_METRICS)
        : updated;
    });

    // Update provider-specific metrics
    if (provider) {
      this.updateProviderMetrics(provider, duration, success);
    }

    this.logging.debug(`Metric recorded: ${operation}`);
  }

  updateStorageMetrics(used: number, available: number): void {
    this.storageMetrics.set({ used, available });
    
    this.logging.debug('Storage metrics updated');
  }

  getMetrics(): ApplicationMetrics {
    return this.applicationMetrics();
  }

  clearMetrics(): void {
    this.requestMetrics.set([]);
    this.providerMetrics.set(new Map());
    this.storageMetrics.set({ used: 0, available: 0 });
    
    this.logging.info('Metrics cleared');
  }

  private updateProviderMetrics(provider: ModelProvider, duration: number, success: boolean): void {
    this.providerMetrics.update(providers => {
      const updated = new Map(providers);
      const existing = updated.get(provider) || {
        requests: 0,
        errors: 0,
        totalResponseTime: 0,
        lastUsed: new Date(),
        isHealthy: true,
        averageResponseTime: 0
      };

      existing.requests++;
      existing.totalResponseTime += duration;
      existing.lastUsed = new Date();
      
      if (!success) {
        existing.errors++;
        existing.isHealthy = existing.errors / existing.requests < 0.1; // 10% error threshold
      }

      updated.set(provider, existing);
      return updated;
    });
  }

  private calculateHealthScore(successful: number, failed: number, providers: Map<ModelProvider, ProviderMetricData>): number {
    if (successful + failed === 0) return 100;
    
    const errorRate = failed / (successful + failed);
    const providerHealthy = Array.from(providers.values()).filter(p => p.isHealthy).length;
    const totalProviders = providers.size || 1;
    
    const baseScore = (1 - errorRate) * 100;
    const providerScore = (providerHealthy / totalProviders) * 100;
    
    return Math.min(100, Math.max(0, (baseScore + providerScore) / 2));
  }

  private calculateRecentErrorRate(requests: PerformanceMetric[]): number {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentErrors = requests.filter(r => !r.success && r.timestamp >= oneHourAgo);
    return recentErrors.length;
  }
}
