import { Injectable } from '@angular/core';
import { ApiKey } from '../domain/value-objects/api-key';

@Injectable({
  providedIn: 'root'
})
export class ProviderConfigurationService {
  private convertToApiKey(apiKeyStr: string | undefined): ApiKey | undefined {
    return apiKeyStr ? ApiKey.fromString(apiKeyStr) : undefined;
  }

  private convertToApiKeyString(apiKey: ApiKey | undefined): string | undefined {
    return apiKey?.getValue();
  }
}