// Integration layer monitoring service - now using focused monitoring services
import { Injectable } from '@angular/core';
import { MonitoringService as CoreMonitoringService } from './monitoring/monitoring.service';
import { ModelProvider } from '../domain/tts.entity';

// Re-export types for backward compatibility
export type { HealthStatus, HealthCheck } from './monitoring/health-check.service';
export type { ApplicationMetrics } from './monitoring/metrics-collection.service';
export type { Alert } from './monitoring/alert.service';

@Injectable({
  providedIn: 'root'
})
export class MonitoringService {
  constructor(private coreMonitoring: CoreMonitoringService) {}

  // Delegate all methods to the core monitoring service
  async getHealthStatus() {
    return this.coreMonitoring.getHealthStatus();
  }

  async runHealthChecks() {
    return this.coreMonitoring.runHealthChecks();
  }

  recordRequest(operation: string, duration: number, success: boolean, provider?: ModelProvider, metadata?: Record<string, unknown>) {
    this.coreMonitoring.recordRequest(operation, duration, success, provider, metadata);
  }

  updateStorageMetrics(used: number, available: number) {
    this.coreMonitoring.updateStorageMetrics(used, available);
  }

  getMetrics() {
    return this.coreMonitoring.getMetrics();
  }

  getActiveAlerts() {
    return this.coreMonitoring.getActiveAlerts();
  }

  getAllAlerts() {
    return this.coreMonitoring.getAllAlerts();
  }

  acknowledgeAlert(alertId: string) {
    return this.coreMonitoring.acknowledgeAlert(alertId);
  }

  acknowledgeAllAlerts() {
    return this.coreMonitoring.acknowledgeAllAlerts();
  }

  checkAlerts() {
    return this.coreMonitoring.checkAlerts();
  }

  async runMonitoringCycle() {
    return this.coreMonitoring.runMonitoringCycle();
  }

  clearAllData() {
    this.coreMonitoring.clearAllData();
  }

  getMonitoringSummary() {
    return this.coreMonitoring.getMonitoringSummary();
  }

  // Legacy methods for backward compatibility
  recordHealthCheck(provider: ModelProvider, isHealthy: boolean): void {
    this.recordRequest(`healthCheck_${provider}`, 0, isHealthy, provider, { healthCheck: true });
  }

  exportDiagnostics(): string {
    const summary = this.getMonitoringSummary();
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      health: summary.health,
      metrics: summary.metrics,
      alerts: summary.activeAlerts,
      summary: summary.summary
    }, null, 2);
  }
}
