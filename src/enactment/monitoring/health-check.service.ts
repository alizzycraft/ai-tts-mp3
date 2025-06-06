// Health checking service focused on application health monitoring
import { Injectable, PLATFORM_ID, signal, computed, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LoggingService } from '../../common/services/logging.service';
import { ProviderConfigurationService } from '../tts-providers/provider-configuration.service';
import { ModelProvider } from '../../domain/entities/tts.entity';

// Define a local interface for Performance that includes the non-standard memory property
interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  lastUpdated: Date;
  uptime: number;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration?: number;
  lastChecked: Date;
  provider?: ModelProvider;
}

export interface ProviderHealthStatus {
  provider: ModelProvider;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  duration?: number;
  lastChecked: Date;
}

@Injectable({
  providedIn: 'root'
})
export class HealthCheckService {
  private logging = inject(LoggingService);
  private providerConfig = inject(ProviderConfigurationService);

  // Static initialization guard
  private static isInitialized = false;
  
  private startTime = new Date();
  private isBrowser = false;
  
  // Signals for reactive health monitoring
  private healthChecks = signal(new Map<string, HealthCheck>());
  private lastHealthCheckRun = signal(new Date());
  private providerChecks = signal(new Map<ModelProvider, ProviderHealthStatus>());

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
  readonly overallStatus = computed(() => this.healthStatus().status);

  // Computed signal for critical health checks
  readonly criticalChecks = computed(() => {
    const checks = Array.from(this.healthChecks().values());
    return checks.filter(check => check.status === 'fail');
  });

  // Computed signal for provider health status
  readonly providerHealth = computed(() => Array.from(this.providerChecks().values()));

  constructor() {
    const platformId = inject(PLATFORM_ID);

    if (HealthCheckService.isInitialized) {
      this.logging.debug('HealthCheckService already initialized', 'HealthCheck');
      return;
    }

    HealthCheckService.isInitialized = true;
    this.isBrowser = isPlatformBrowser(platformId);
    
    // Provider health checks are now performed manually through testProviderConnectivity()
    this.logging.info('HealthCheckService initialized - Provider health checks will be performed manually', 'HealthCheck');
  }

  async getHealthStatus(): Promise<HealthStatus> {
    return this.healthStatus();
  }

  async getProviderHealth(): Promise<ProviderHealthStatus[]> {
    return this.providerHealth();
  }

  /**
   * Run system health checks excluding provider connectivity
   */
  async runSystemHealthChecks(): Promise<void> {
    if (!this.isBrowser) return;

    const checkPromises = [
      this.checkLocalStorage(),
      this.checkMemoryUsage(),
      this.checkAudioSupport()
    ];

    await Promise.allSettled(checkPromises);
  }

  /**
   * Test provider connectivity manually
   * This method is called by the UI when the user clicks "Test Connection"
   */  async testProviderConnectivity(provider: ModelProvider): Promise<ProviderHealthStatus> {
    const startTime = Date.now();
    
    try {
      // Get provider configuration
      const configResult = this.providerConfig.getProviderConfiguration(provider);
      if (configResult.isFailure()) {
        throw new Error(`Failed to get provider configuration: ${configResult.getError()}`);
      }

      const config = configResult.getValue();
      if (!config.enabled) {
        throw new Error('Provider is not enabled');
      }

      // Test provider configuration
      const validationResult = await this.providerConfig.validateProviderConfiguration(provider);
      if (validationResult.isFailure()) {
        throw new Error(`Failed to validate configuration: ${validationResult.getError()}`);
      }

      const validation = validationResult.getValue();
      if (!validation.isValid) {
        throw new Error(validation.message);
      }

      // Update status
      const status: ProviderHealthStatus = {
        provider,
        status: 'pass',
        message: 'Provider connection test passed successfully',
        duration: Date.now() - startTime,
        lastChecked: new Date()
      };

      // Update signals
      const currentChecks = new Map(this.providerChecks());
      currentChecks.set(provider, status);
      this.providerChecks.set(currentChecks);
      this.lastHealthCheckRun.set(new Date());

      this.logging.info(`Provider connectivity test passed for ${provider}`, 'HealthCheck');
      return status;

    } catch (error) {
      const status: ProviderHealthStatus = {
        provider,
        status: 'fail',
        message: `Connectivity test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - startTime,
        lastChecked: new Date()
      };

      // Update signals
      const currentChecks = new Map(this.providerChecks());
      currentChecks.set(provider, status);
      this.providerChecks.set(currentChecks);
      this.lastHealthCheckRun.set(new Date());

      this.logging.error(`Provider connectivity test failed for ${provider}`, error as Error, 'HealthCheck');
      return status;
    }
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
