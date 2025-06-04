// Alert service focused on system alerting and notifications
import { Injectable, Inject, PLATFORM_ID, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LoggingService } from '../logging.service';
import { ApplicationMetrics } from './metrics-collection.service';

export interface Alert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: ApplicationMetrics) => boolean;
  severity: Alert['type'];
  message: string;
  enabled: boolean;
  cooldownMinutes: number;
  lastTriggered?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class AlertService {
  private isBrowser = false;

  // Keep last 100 alerts
  private readonly MAX_ALERTS = 100;

  // Signals for reactive alert management
  private alerts = signal<Alert[]>([]);
  private alertRules = signal<AlertRule[]>([]);
  private acknowledgedAlerts = signal(new Set<string>());

  // Computed signals for derived data
  readonly activeAlerts = computed(() => 
    this.alerts().filter(alert => !alert.acknowledged)
  );

  readonly criticalAlerts = computed(() => 
    this.activeAlerts().filter(alert => alert.type === 'critical')
  );

  readonly alertsByType = computed(() => {
    const alerts = this.alerts();
    return {
      info: alerts.filter(alert => alert.type === 'info').length,
      warning: alerts.filter(alert => alert.type === 'warning').length,
      error: alerts.filter(alert => alert.type === 'error').length,
      critical: alerts.filter(alert => alert.type === 'critical').length
    };
  });

  // Replace effect with computed signal
  private readonly alertProcessor = computed(() => {
    const alerts = this.alerts();
    const acknowledged = this.acknowledgedAlerts();
    
    return {
      activeCount: alerts.filter(a => !acknowledged.has(a.id)).length,
      totalCount: alerts.length,
      lastProcessed: new Date()
    };
  });

  constructor(
    @Inject(PLATFORM_ID) platformId: object,
    private logging: LoggingService
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.initializeDefaultRules();

    if (this.isBrowser) {
      // Activate alert processor
      this.alertProcessor();
    }
  }

  checkAlerts(metrics: ApplicationMetrics): Alert[] {
    if (!this.isBrowser) return [];

    const triggeredAlerts: Alert[] = [];
    const now = new Date();
    const rules = this.alertRules();

    for (const rule of rules) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.lastTriggered) {
        const cooldownEnd = new Date(rule.lastTriggered.getTime() + (rule.cooldownMinutes * 60 * 1000));
        if (now < cooldownEnd) continue;
      }

      // Check condition
      if (rule.condition(metrics)) {
        const alert = this.createAlert(rule, metrics);
        triggeredAlerts.push(alert);
        this.addAlert(alert);
        
        // Update rule's last triggered time
        this.alertRules.update(currentRules => 
          currentRules.map(r => 
            r.id === rule.id ? { ...r, lastTriggered: now } : r
          )
        );
        
        this.logging.warn(`Alert triggered: ${rule.name}`, 'Alerts', {
          alertId: alert.id,
          severity: rule.severity,
          rule: rule.name
        });
      }
    }

    return triggeredAlerts;
  }

  getActiveAlerts(): Alert[] {
    return this.activeAlerts();
  }

  getAllAlerts(): Alert[] {
    return this.alerts();
  }

  acknowledgeAlert(alertId: string): boolean {
    const alerts = this.alerts();
    const alert = alerts.find(a => a.id === alertId);
    
    if (alert) {
      // Update alerts signal
      this.alerts.update(currentAlerts => 
        currentAlerts.map(a => 
          a.id === alertId ? { ...a, acknowledged: true } : a
        )
      );
      
      // Update acknowledged alerts set
      this.acknowledgedAlerts.update(current => {
        const newSet = new Set(current);
        newSet.add(alertId);
        return newSet;
      });
      
      this.logging.info(`Alert acknowledged: ${alertId}`, 'Alerts', {
        alertTitle: alert.title
      });
      
      return true;
    }
    return false;
  }

  acknowledgeAllAlerts(): number {
    const activeAlerts = this.activeAlerts();
    let count = 0;

    if (activeAlerts.length > 0) {
      // Acknowledge all active alerts
      this.alerts.update(currentAlerts => 
        currentAlerts.map(alert => {
          if (!alert.acknowledged) {
            count++;
            return { ...alert, acknowledged: true };
          }
          return alert;
        })
      );

      // Update acknowledged alerts set
      this.acknowledgedAlerts.update(current => {
        const newSet = new Set(current);
        activeAlerts.forEach(alert => newSet.add(alert.id));
        return newSet;
      });

      this.logging.info(`Acknowledged ${count} alerts`, 'Alerts');
    }

    return count;
  }

  addAlertRule(rule: AlertRule): void {
    this.alertRules.update(current => [...current, rule]);
    
    this.logging.info(`Alert rule added: ${rule.name}`, 'Alerts', {
      ruleId: rule.id
    });
  }

  removeAlertRule(ruleId: string): boolean {
    const rules = this.alertRules();
    const index = rules.findIndex(rule => rule.id === ruleId);
    
    if (index >= 0) {
      const rule = rules[index];
      this.alertRules.update(current => 
        current.filter(r => r.id !== ruleId)
      );
      
      this.logging.info(`Alert rule removed: ${rule.name}`, 'Alerts', {
        ruleId
      });
      return true;
    }
    return false;
  }

  enableAlertRule(ruleId: string, enabled: boolean): boolean {
    const rules = this.alertRules();
    const rule = rules.find(r => r.id === ruleId);
    
    if (rule) {
      this.alertRules.update(current => 
        current.map(r => 
          r.id === ruleId ? { ...r, enabled } : r
        )
      );
      
      this.logging.info(`Alert rule ${enabled ? 'enabled' : 'disabled'}: ${rule.name}`, 'Alerts', {
        ruleId
      });
      return true;
    }
    return false;
  }

  clearAlerts(): void {
    this.alerts.set([]);
    this.acknowledgedAlerts.set(new Set());
    this.logging.info('All alerts cleared', 'Alerts');
  }

  private createAlert(rule: AlertRule, metrics: ApplicationMetrics): Alert {
    return {
      id: this.generateAlertId(),
      type: rule.severity,
      title: rule.name,
      message: this.interpolateMessage(rule.message, metrics),
      timestamp: new Date(),
      acknowledged: false,
      source: 'system',
      metadata: {
        ruleId: rule.id,
        metrics: {
          healthScore: metrics.system.healthScore,
          errorRate: metrics.requests.failed / Math.max(1, metrics.requests.total),
          storageUsed: metrics.storage.percentageUsed
        }
      }
    };
  }

  private addAlert(alert: Alert): void {
    this.alerts.update(current => {
      const updated = [...current, alert];
      return updated.length > this.MAX_ALERTS 
        ? updated.slice(-this.MAX_ALERTS)
        : updated;
    });
  }

  private initializeDefaultRules(): void {
    this.alertRules.set([
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        condition: (metrics: ApplicationMetrics) => {
          const errorRate = metrics.requests.total > 0 
            ? metrics.requests.failed / metrics.requests.total 
            : 0;
          return errorRate > 0.1; // >10% error rate
        },
        severity: 'error',
        message: 'Error rate is above 10%: {{errorRate}}%',
        enabled: true,
        cooldownMinutes: 15
      },
      {
        id: 'storage-critical',
        name: 'Storage Critical',
        condition: (metrics: ApplicationMetrics) => metrics.storage.percentageUsed > 90,
        severity: 'critical',
        message: 'Storage usage is critically high: {{storageUsed}}%',
        enabled: true,
        cooldownMinutes: 30
      },
      {
        id: 'storage-warning',
        name: 'Storage Warning',
        condition: (metrics: ApplicationMetrics) => metrics.storage.percentageUsed > 80,
        severity: 'warning',
        message: 'Storage usage is high: {{storageUsed}}%',
        enabled: true,
        cooldownMinutes: 60
      },
      {
        id: 'slow-response',
        name: 'Slow Response Time',
        condition: (metrics: ApplicationMetrics) => metrics.requests.averageResponseTime > 5000,
        severity: 'warning',
        message: 'Average response time is high: {{responseTime}}ms',
        enabled: true,
        cooldownMinutes: 10
      },
      {
        id: 'low-health-score',
        name: 'Low Health Score',
        condition: (metrics: ApplicationMetrics) => metrics.system.healthScore < 70,
        severity: 'warning',
        message: 'System health score is low: {{healthScore}}/100',
        enabled: true,
        cooldownMinutes: 20
      }
    ]);
  }

  private interpolateMessage(template: string, metrics: ApplicationMetrics): string {
    return template
      .replace('{{errorRate}}', ((metrics.requests.failed / Math.max(1, metrics.requests.total)) * 100).toFixed(1))
      .replace('{{storageUsed}}', metrics.storage.percentageUsed.toFixed(1))
      .replace('{{responseTime}}', metrics.requests.averageResponseTime.toFixed(0))
      .replace('{{healthScore}}', metrics.system.healthScore.toString());
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  private processAlerts(): void {
    // Custom processing logic for alerts if needed
    // This can be used to trigger side-effects or additional logging
  }
}
