import { Injectable } from '@angular/core';
import { StorageStateIntegrationService } from '../storage-state-integration.service';

/**
 * @deprecated Use StorageStateIntegrationService directly
 * This service exists for backwards compatibility only
 */
@Injectable({
  providedIn: 'root'
})
export class StorageStateService extends StorageStateIntegrationService {
  constructor() {
    super();
  }
}