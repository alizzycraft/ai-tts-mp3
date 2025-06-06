// Integration layer monitoring service - now using focused monitoring services
import { Injectable, inject } from '@angular/core';
import { MonitoringService as CoreMonitoring } from './monitoring/monitoring.service';
import { ProviderMonitoringService } from './monitoring/provider-monitoring.service';
import { ModelProvider } from '../domain/entities/tts.entity';
import { ProviderHealthMetrics } from './monitoring/provider-monitoring.service';

// Re-export types for backward compatibility
export type { HealthStatus, HealthCheck } from './monitoring/health-check.service';
export type { ApplicationMetrics } from './monitoring/metrics-collection.service';
export type { Alert } from './monitoring/alert.service';
export type { ProviderHealthMetrics };

@Injectable({
  providedIn: 'root'
})
export class MonitoringService {
  private coreMonitoring = inject(CoreMonitoring);
  private providerMonitoring = inject(ProviderMonitoringService);


  // Provider-specific monitoring methods
  recordHealthCheck(provider: ModelProvider, isHealthy: boolean): void {
    this.providerMonitoring.recordHealthCheck(provider, isHealthy);
  }

  getProviderHealth(provider: ModelProvider) {
    return this.providerMonitoring.getProviderHealth(provider);
  }

  updateProviderMetrics(provider: ModelProvider, metrics: ProviderHealthMetrics): void {
    this.providerMonitoring.updateProviderMetrics(provider, metrics);
  }

  getAllProviderMetrics(): Map<ModelProvider, ProviderHealthMetrics> {
    return this.providerMonitoring.getAllProviderMetrics();
  }

  // Core monitoring methods
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

  // Alert management
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

  // System operations
  async runMonitoringCycle() {
    return this.coreMonitoring.runMonitoringCycle();
  }

  clearAllData() {
    this.providerMonitoring.clearAllData();
    this.coreMonitoring.clearAllData();
  }

  getMonitoringSummary() {
    const coreData = this.coreMonitoring.getMonitoringSummary();
    const providerData = this.providerMonitoring.getAllProviderMetrics();
    
    return {
      ...coreData,
      providers: Object.fromEntries(providerData)
    };
  }
}