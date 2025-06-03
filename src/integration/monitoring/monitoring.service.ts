// Orchestrating monitoring service that coordinates health, metrics, and alerts
import { Injectable, computed, signal, effect } from '@angular/core';
import { HealthCheckService, HealthStatus } from './health-check.service';
import { MetricsCollectionService, ApplicationMetrics } from './metrics-collection.service';
import { AlertService, Alert } from './alert.service';
import { LoggingService } from '../logging.service';
import { ModelProvider } from '../../domain/tts.entity';

@Injectable({
  providedIn: 'root'
})
export class MonitoringService {
  // Reactive orchestration signals
  private monitoringEnabled = signal(true);
  private lastMonitoringRun = signal<Date | null>(null);
  private monitoringInterval = signal(60 * 1000); // 1 minute
  
  // Computed signals for reactive coordination
  readonly currentHealthStatus = computed(() => this.healthCheck.healthStatus());
  readonly currentMetrics = computed(() => this.metricsCollection.applicationMetrics());
  readonly activeAlerts = computed(() => this.alertService.activeAlerts());
  readonly criticalAlerts = computed(() => this.alertService.criticalAlerts());
  readonly alertsByType = computed(() => this.alertService.alertsByType());
  
  // Overall system status computed from all monitoring components
  readonly systemStatus = computed(() => {
    const health = this.currentHealthStatus();
    const alerts = this.activeAlerts();
    const criticalCount = this.criticalAlerts().length;
    
    if (criticalCount > 0 || health.status === 'unhealthy') {
      return 'unhealthy' as const;
    } else if (alerts.length > 0 || health.status === 'degraded') {
      return 'degraded' as const;
    }
    return 'healthy' as const;
  });
  
  // Monitoring summary computed signal
  readonly monitoringSummary = computed(() => {
    const metrics = this.currentMetrics();
    const activeAlerts = this.activeAlerts();
    const health = this.currentHealthStatus();
    
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Analyze metrics for issues and recommendations
    if (metrics.storage.percentageUsed > 90) {
      issues.push('Storage critically low');
      recommendations.push('Clear old history items or enable file system storage');
    } else if (metrics.storage.percentageUsed > 80) {
      issues.push('Storage usage high');
      recommendations.push('Consider clearing old history items');
    }
    
    if (metrics.requests.total > 0) {
      const errorRate = (metrics.requests.failed / metrics.requests.total) * 100;
      if (errorRate > 10) {
        issues.push(`High error rate: ${errorRate.toFixed(1)}%`);
        recommendations.push('Check provider configurations and network connectivity');
      }
    }
    
    if (metrics.requests.averageResponseTime > 5000) {
      issues.push('Slow response times');
      recommendations.push('Check network connection and provider status');
    }
    
    if (activeAlerts.length > 0) {
      issues.push(`${activeAlerts.length} unacknowledged alert(s)`);
      recommendations.push('Review and acknowledge alerts');
    }
    
    return {
      health,
      metrics,
      activeAlerts,
      status: this.systemStatus(),
      issues,
      recommendations
    };
  });

  constructor(
    private healthCheck: HealthCheckService,
    private metricsCollection: MetricsCollectionService,
    private alertService: AlertService,
    private logging: LoggingService
  ) {
    // Reactive effects for monitoring coordination
    effect(() => {
      const enabled = this.monitoringEnabled();
      if (enabled) {
        this.startMonitoringTimer();
      }
    });
    
    // Effect to log system status changes
    effect(() => {
      const status = this.systemStatus();
      const criticalCount = this.criticalAlerts().length;
      
      if (status === 'unhealthy') {
        this.logging.error(`System unhealthy - ${criticalCount} critical alerts`, new Error('System Status'), 'Monitoring');
      } else if (status === 'degraded') {
        this.logging.warn(`System degraded - ${this.activeAlerts().length} active alerts`, 'Monitoring');
      }
    });
    
    // Effect to automatically trigger alert checks when metrics change
    effect(() => {
      const metrics = this.currentMetrics();
      // Trigger alert evaluation when metrics are updated
      this.alertService.checkAlerts(metrics);
    });
  }
  
  private startMonitoringTimer(): void {
    const interval = this.monitoringInterval();
    setInterval(() => {
      if (this.monitoringEnabled()) {
        this.runMonitoringCycle();
      }
    }, interval);
  }

  // Health monitoring - enhanced with signals
  async getHealthStatus(): Promise<HealthStatus> {
    return this.healthCheck.getHealthStatus();
  }

  async runHealthChecks(): Promise<void> {
    return this.healthCheck.runHealthChecks();
  }

  // Metrics collection - enhanced with signals
  recordRequest(operation: string, duration: number, success: boolean, provider?: ModelProvider, metadata?: Record<string, unknown>): void {
    this.metricsCollection.recordRequest(operation, duration, success, provider, metadata);
  }

  updateStorageMetrics(used: number, available: number): void {
    this.metricsCollection.updateStorageMetrics(used, available);
  }

  getMetrics(): ApplicationMetrics {
    return this.currentMetrics(); // Use computed signal
  }

  // Alert management - enhanced with signals  
  getActiveAlerts(): Alert[] {
    return this.activeAlerts(); // Use computed signal
  }

  getAllAlerts(): Alert[] {
    return this.alertService.getAllAlerts();
  }

  acknowledgeAlert(alertId: string): boolean {
    return this.alertService.acknowledgeAlert(alertId);
  }

  acknowledgeAllAlerts(): number {
    return this.alertService.acknowledgeAllAlerts();
  }

  checkAlerts(): Alert[] {
    const metrics = this.getMetrics();
    return this.alertService.checkAlerts(metrics);
  }

  // Reactive monitoring operations
  enableMonitoring(): void {
    this.monitoringEnabled.set(true);
  }

  disableMonitoring(): void {
    this.monitoringEnabled.set(false);
  }

  setMonitoringInterval(milliseconds: number): void {
    this.monitoringInterval.set(milliseconds);
  }

  // Combined monitoring operations
  async runMonitoringCycle(): Promise<void> {
    try {
      this.lastMonitoringRun.set(new Date());
      
      // Run health checks
      await this.runHealthChecks();
      
      // Check for alerts
      const newAlerts = this.checkAlerts();
      
      if (newAlerts.length > 0) {
        this.logging.warn(`${newAlerts.length} new alert(s) triggered`, 'Monitoring');
      }
      
      // Log monitoring summary
      const metrics = this.getMetrics();
      const health = await this.getHealthStatus();
      
      this.logging.debug('Monitoring cycle completed', 'Monitoring', {
        healthStatus: health.status,
        healthScore: metrics.system.healthScore,
        activeAlerts: this.getActiveAlerts().length,
        totalRequests: metrics.requests.total,
        errorRate: `${((metrics.requests.failed / Math.max(1, metrics.requests.total)) * 100).toFixed(1)}%`
      });
      
    } catch (error) {
      this.logging.error('Monitoring cycle failed', error as Error, 'Monitoring');
    }
  }

  // Utility methods
  clearAllData(): void {
    this.metricsCollection.clearMetrics();
    this.alertService.clearAlerts();
    this.logging.info('All monitoring data cleared', 'Monitoring');
  }

  getMonitoringSummary(): {
    health: Promise<HealthStatus>;
    metrics: ApplicationMetrics;
    activeAlerts: Alert[];
    summary: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      issues: string[];
      recommendations: string[];
    };
  } {
    const summary = this.monitoringSummary();
    
    return {
      health: this.getHealthStatus(),
      metrics: summary.metrics,
      activeAlerts: summary.activeAlerts,
      summary: {
        status: summary.status,
        issues: summary.issues,
        recommendations: summary.recommendations
      }
    };
  }
}
