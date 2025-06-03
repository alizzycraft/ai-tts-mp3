// Health checking service focused on application health monitoring
import { Injectable, Inject, PLATFORM_ID, signal, computed, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LoggingService } from '../logging.service';
import { ProviderConfigurationService } from '../settings/provider-configuration.service';
// import { ModelProvider } from '../../domain/tts.entity'; // Removed unused import
// import { ProviderConfiguration } from '../settings/provider-configuration.service'; // Removed unused import

// Define a local interface for Performance that includes the non-standard memory property
interface PerformanceWithMemory extends Performance {
  memory?: { // Use optional chaining as it might not exist
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  lastUpdated: Date;
  uptime: number; // milliseconds
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration?: number; // milliseconds
  lastChecked: Date;
}

@Injectable({
  providedIn: 'root'
})
export class HealthCheckService {
  private startTime = new Date();
  private isBrowser = false;
  // Signals for reactive health monitoring
  private healthChecks = signal(new Map<string, HealthCheck>());
  private lastHealthCheckRun = signal(new Date());

  // Computed signal for health status
  readonly healthStatus = computed(() => {
    const uptime = Date.now() - this.startTime.getTime();
    const checks = Array.from(this.healthChecks().values());
    const status = this.calculateOverallStatus(checks);
    
    return {
      status,
      checks,
      lastUpdated: this.lastHealthCheckRun(),
      uptime
    } as HealthStatus;
  });

  // Computed signal for overall health status
  readonly overallStatus = computed(() => {
    return this.healthStatus().status;
  });

  // Computed signal for critical health checks
  readonly criticalChecks = computed(() => {
    const checks = Array.from(this.healthChecks().values());
    return checks.filter(check => check.status === 'fail');
  });

  constructor(
    @Inject(PLATFORM_ID) platformId: object,
    private logging: LoggingService,
    private providerConfig: ProviderConfigurationService
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    
    if (this.isBrowser) {
      // Effect to log health status changes
      effect(() => {
        const status = this.overallStatus();
        const criticalCount = this.criticalChecks().length;
        
        if (criticalCount > 0) {
          this.logging.warn(`Health status: ${status} (${criticalCount} critical issues)`, 'HealthCheck');
        }
      });

      // Run health checks every 5 minutes
      setInterval(() => this.runHealthChecks(), 5 * 60 * 1000);
      
      // Initial health check
      this.runHealthChecks();
    }
  }
  async getHealthStatus(): Promise<HealthStatus> {
    // Return the computed signal value
    return this.healthStatus();
  }

  async runHealthChecks(): Promise<void> {
    if (!this.isBrowser) return;

    const checkPromises = [
      this.checkLocalStorage(),
      this.checkMemoryUsage(),
      this.checkProviderConnectivity(),
      this.checkAudioSupport()
    ];

    await Promise.allSettled(checkPromises);
  }

  private async checkLocalStorage(): Promise<void> {
    const startTime = Date.now();
    const checkName = 'localStorage';

    try {
      // Test localStorage availability
      const testKey = 'health-check-test';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);

      this.updateHealthCheck(checkName, {
        name: checkName,
        status: 'pass',
        message: 'localStorage is available',
        duration: Date.now() - startTime,
        lastChecked: new Date()
      });
    } catch (error) {
      this.updateHealthCheck(checkName, {
        name: checkName,
        status: 'fail',
        message: `localStorage unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime,
        lastChecked: new Date()
      });
    }
  }

  private async checkMemoryUsage(): Promise<void> {
    const startTime = Date.now();
    const checkName = 'memory';

    try {
      // Check if performance and performance.memory exist
      if (typeof performance !== 'undefined' && 'memory' in performance) {
        // Safely access memory after casting to the custom interface
        const memory = (performance as PerformanceWithMemory).memory;

        if (memory) {
          const usedPercent = (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100;
          
          this.updateHealthCheck(checkName, {
            name: checkName,
            status: usedPercent > 80 ? 'warn' : 'pass',
            message: `Memory usage: ${usedPercent.toFixed(1)}%`,
            duration: Date.now() - startTime,
            lastChecked: new Date()
          });
        } else {
          this.updateHealthCheck(checkName, {
            name: checkName,
            status: 'warn',
            message: 'Memory information not available',
            duration: Date.now() - startTime,
            lastChecked: new Date()
          });
        }
      } else {
        this.updateHealthCheck(checkName, {
          name: checkName,
          status: 'warn',
          message: 'Memory information not available',
          duration: Date.now() - startTime,
          lastChecked: new Date()
        });
      }
    } catch (error) {
      this.updateHealthCheck(checkName, {
        name: checkName,
        status: 'fail',
        message: `Memory check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime,
        lastChecked: new Date()
      });
    }
  }

  private async checkProviderConnectivity(): Promise<void> {
    try {
      // Use the correct public method to get available providers
      const enabledProviders = this.providerConfig.getAvailableProviders();

      // const providerCount = enabledProviders.length; // Removed unused variable
      // const failedProviders: string[] = []; // Not needed with this approach

      // TODO: Implement actual provider connectivity check logic
      console.warn('[HealthCheckService] Provider connectivity check is not fully implemented, checking for configured providers instead.');

      // Update health check state based on whether any providers are enabled
      const currentChecks = new Map(this.healthChecks());
      currentChecks.set('provider_configuration', { // Renamed check name
        name: 'Provider Configuration', // Renamed check name
        status: enabledProviders.length > 0 ? 'pass' : 'warn', // Assume pass if at least one enabled
        message: enabledProviders.length > 0 ? 
                `Configured providers: ${enabledProviders.join(', ')}` : 
                'No providers are configured.',
        lastChecked: new Date()
      });

      this.healthChecks.set(currentChecks);
      this.lastHealthCheckRun.set(new Date());

    } catch (error) {
      this.updateHealthCheck('provider_configuration', { // Updated check name in catch block
        name: 'Provider Configuration', // Updated check name in catch block
        status: 'fail',
        message: `Provider configuration check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date()
      });
    }
  }

  private async checkAudioSupport(): Promise<void> {
    const startTime = Date.now();
    const checkName = 'audio';

    try {
      const audio = new Audio();
      const canPlayMP3 = audio.canPlayType('audio/mpeg') !== '';
      
      this.updateHealthCheck(checkName, {
        name: checkName,
        status: canPlayMP3 ? 'pass' : 'warn',
        message: canPlayMP3 ? 'Audio playback supported' : 'Limited audio support',
        duration: Date.now() - startTime,
        lastChecked: new Date()
      });
    } catch (error) {
      this.updateHealthCheck(checkName, {
        name: checkName,
        status: 'fail',
        message: `Audio check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime,
        lastChecked: new Date()
      });
    }
  }

  private updateHealthCheck(name: string, check: HealthCheck): void {
    // Update the signal by creating a new Map with the updated check
    const currentChecks = this.healthChecks();
    const updatedChecks = new Map(currentChecks);
    updatedChecks.set(name, check);
    this.healthChecks.set(updatedChecks);
    
    // Update the last check run time to trigger reactive updates
    this.lastHealthCheckRun.set(new Date());
    
    this.logging.debug(`Health check updated: ${name}`);
  }

  private calculateOverallStatus(checks: HealthCheck[]): 'healthy' | 'degraded' | 'unhealthy' | 'initializing' {
    if (checks.length === 0) return 'initializing';
    
    const failedChecks = checks.filter(check => check.status === 'fail');
    const warnChecks = checks.filter(check => check.status === 'warn');
    
    if (failedChecks.length > 0) return 'unhealthy';
    if (warnChecks.length > 0) return 'degraded';
    
    return 'healthy';
  }
}
