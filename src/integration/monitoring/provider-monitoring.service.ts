// Provider-specific monitoring service to break circular dependencies
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { signal, computed } from '@angular/core';
import { LoggingService } from '../logging.service';
import { ModelProvider } from '../../domain/entities/tts.entity';
import { Result } from '../../common/value-objects/query/result';
import { isPlatformBrowser } from '@angular/common';

export interface ProviderHealthMetrics {
  synthesisCount: number;
  errorCount: number;
  successRate: number;
  lastCheckTime: Date;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unconfigured';
}

@Injectable({
  providedIn: 'root'
})
export class ProviderMonitoringService {
  private logging = inject(LoggingService);
  private platformId = inject(PLATFORM_ID);

  // Provider health state
  private readonly healthStatus = signal<Map<ModelProvider, boolean>>(new Map());
  private readonly providerMetrics = signal<Map<ModelProvider, ProviderHealthMetrics>>(new Map());
  private readonly lastUpdateTime = signal<Date>(new Date());
  private readonly initialized = signal(false);

  // Computed metrics
  readonly allProvidersHealth = computed(() => {
    const health = new Map<ModelProvider, boolean>();
    for (const [provider, metrics] of this.providerMetrics().entries()) {
      health.set(provider, metrics.status === 'healthy');
    }
    return health;
  });

  constructor() {
    if (!this.initialized() && isPlatformBrowser(this.platformId)) {
      this.initialized.set(true);
      this.logging.info('ProviderMonitoringService initialized', 'ProviderMonitoring');
    }
  }

  recordHealthCheck(provider: ModelProvider, isHealthy: boolean): void {
    this.healthStatus.update((currentMap) => {
      const newMap = new Map(currentMap);
      newMap.set(provider, isHealthy);
      return newMap;
    });
    this.lastUpdateTime.set(new Date());
  }

  updateProviderMetrics(provider: ModelProvider, metrics: ProviderHealthMetrics): void {
    this.providerMetrics.update((currentMap) => {
      const newMap = new Map(currentMap);
      newMap.set(provider, metrics);
      return newMap;
    });
    this.lastUpdateTime.set(new Date());

    // Log degraded/unhealthy status
    if (metrics.status !== 'healthy' && metrics.status !== 'unconfigured') {
      this.logging.warn(`Provider ${provider} health degraded`, 'ProviderMonitoring', {
        provider,
        status: metrics.status,
        successRate: metrics.successRate,
        totalRequests: metrics.synthesisCount,
        errors: metrics.errorCount
      });
    }
  }

  getProviderHealth(provider: ModelProvider): Result<boolean, string> {
    const health = this.healthStatus().get(provider);
    if (health === undefined) {
      return Result.failure(`No health data available for provider ${provider}`);
    }
    return Result.success(health);
  }

  getProviderMetrics(provider: ModelProvider): Result<ProviderHealthMetrics, string> {
    const metrics = this.providerMetrics().get(provider);
    if (!metrics) {
      return Result.failure(`No metrics available for provider ${provider}`);
    }
    return Result.success(metrics);
  }

  getAllProviderMetrics(): Map<ModelProvider, ProviderHealthMetrics> {
    return this.providerMetrics();
  }

  clearProviderData(provider: ModelProvider): void {
    this.healthStatus.update((currentMap) => {
      const newMap = new Map(currentMap);
      newMap.delete(provider);
      return newMap;
    });
    this.providerMetrics.update((currentMap) => {
      const newMap = new Map(currentMap);
      newMap.delete(provider);
      return newMap;
    });
    this.lastUpdateTime.set(new Date());
  }

  clearAllData(): void {
    this.healthStatus.set(new Map());
    this.providerMetrics.set(new Map());
    this.lastUpdateTime.set(new Date());
  }
}
