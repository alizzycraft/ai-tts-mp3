/**
 * Storage Integration Service Tests
 * Tests for reactive storage integration functionality
 */

import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { StorageIntegrationService } from './storage-integration.service';
import { LocalStorageService } from '../../infrastructure/storage/local-storage.service';
import { HistoryItem, HistoryItemFactory } from '../../domain/storage.entity';
import { TTSQuery, TTSSettings, ModelProvider, Voice } from '../../domain/tts.entity';
import { TTSResponse } from '../../infrastructure/tts/interfaces/tts-provider.interface';
import { success, failure } from '../../common/result';

describe('StorageIntegrationService', () => {
  let service: StorageIntegrationService;
  let mockStorageService: jasmine.SpyObj<LocalStorageService>;

  beforeEach(() => {
    // Create spy object for LocalStorageService
    const spy = jasmine.createSpyObj('LocalStorageService', [
      'initialize',
      'storeItem',
      'removeItem',
      'clearHistory',
      'getItem',
      'canStore',
      'getCapacityInfo'
    ], {
      state: signal({
        mode: 'localStorage' as any,
        isReady: false,
        info: {} as any,
        history: [],
        error: undefined
      }),
      storageInfo: signal({
        used: 0,
        available: 1000000,
        total: 1000000,
        usedPercentage: 0,
        itemCount: 0,
        isNearFull: false,
        isCritical: false
      }),
      history: signal([])
    });

    TestBed.configureTestingModule({
      providers: [
        StorageIntegrationService,
        { provide: LocalStorageService, useValue: spy }
      ]
    });

    service = TestBed.inject(StorageIntegrationService);
    mockStorageService = TestBed.inject(LocalStorageService) as jasmine.SpyObj<LocalStorageService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initialize', () => {
    it('should initialize storage service successfully', () => {
      // Arrange
      mockStorageService.initialize.and.returnValue(success(true));      // Act
      const result = service.initialize();

      // Assert
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value).toBe(true);
      }
      expect(mockStorageService.initialize).toHaveBeenCalledTimes(1);
    });

    it('should handle storage initialization failure', () => {
      // Arrange
      const errorMessage = 'Storage initialization failed';
      mockStorageService.initialize.and.returnValue(failure(errorMessage));      // Act
      const result = service.initialize();

      // Assert
      expect(result.isSuccess).toBe(false);
      if (result.isFailure) {
        expect(result.error).toBe(errorMessage);
      }
    });
  });

  describe('storeTTSResult', () => {
    let mockQuery: TTSQuery;
    let mockResponse: TTSResponse;    beforeEach(() => {
      mockQuery = new TTSQuery(
        'test-query-id',
        'Hello, world!',
        {
          provider: ModelProvider.OPENAI,
          model: 'tts-1',
          voice: Voice.ALLOY,
          speed: 1.0,
          pitch: 1.0,
          apiKey: 'test-api-key'
        },
        new Date()
      );

      mockResponse = {
        audioData: new Uint8Array([1, 2, 3, 4]),
        format: 'mp3',
        duration: 1000
      };

      // Mock isReady to return true by mocking the underlying state
      service['_integrationState'].set({
        isInitialized: true,
        lastError: undefined,
        storageReady: true
      });

      // Update storage service state signal to be ready
      (mockStorageService.state as any).set({
        mode: 'localStorage' as any,
        isReady: true,
        info: {} as any,
        history: [],
        error: undefined
      });

      mockStorageService.canStore.and.returnValue(true);
      mockStorageService.storeItem.and.returnValue(success(true));
    });

    it('should store TTS result successfully', () => {
      // Act
      const result = service.storeTTSResult(mockQuery, mockResponse);

      // Assert
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value).toBe(true);
      }
      expect(mockStorageService.canStore).toHaveBeenCalledWith(4); // audioData.byteLength
      expect(mockStorageService.storeItem).toHaveBeenCalledTimes(1);
    });it('should fail when storage integration is not ready', () => {
      // Arrange - Mock isReady to return false by mocking the underlying state
      service['_integrationState'].set({
        isInitialized: false,
        lastError: undefined,
        storageReady: false
      });

      // Act
      const result = service.storeTTSResult(mockQuery, mockResponse);

      // Assert
      expect(result.isSuccess).toBe(false);
      if (result.isFailure) {
        expect(result.error).toBe('Storage integration not ready');
      }
    });
  });

  describe('reactive signals', () => {
    it('should expose storage state signals', () => {
      // Assert
      expect(service.storageState).toBeDefined();
      expect(service.storageInfo).toBeDefined();
      expect(service.history).toBeDefined();
      expect(service.isReady).toBeDefined();
      expect(service.hasHistory).toBeDefined();
      expect(service.isNearCapacity).toBeDefined();
      expect(service.isCriticalCapacity).toBeDefined();
    });
  });
});
