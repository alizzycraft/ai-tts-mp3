// Data Serialization Service - Handles conversion between domain objects and storage formats
import { Injectable } from '@angular/core';
import { HistoryItem } from '../../domain/types/storage-types';
import { TTSResult, TTSSettings, TTSResultStatus, ModelProvider } from '../../domain/entities/tts.entity';
import { QueryId } from '../../common/value-objects/query/query-id';
import { ApiKey } from '../../common/value-objects/text/api-key';
import { ProviderConfiguration } from '../../domain/configuration/provider-configuration';

@Injectable({
  providedIn: 'root'
})
export class DataSerializationService {
  // Serialize history item for localStorage (includes audioData as number array)
  serializeForLocalStorage(item: HistoryItem): Record<string, unknown> {
    const serializedItem: Record<string, unknown> = {
      id: item.id,
      text: item.text,
      settings: this.sanitizeSettings(item.settings),
      result: {
        queryId: item.result?.queryId?.getValue(),
        status: item.result.status,
        audioData: item.result.audioData ? Array.from(item.result.audioData) : undefined,
        createdAt: item.result.createdAt.toISOString(),
        updatedAt: item.result.updatedAt.toISOString(),
        duration: item.result?.duration,
        fileSize: item.result?.fileSize,
        error: item.result?.error,
        processingTime: item.result?.processingTime,
      },
      createdAt: item.createdAt.toISOString(),
      audioSize: item.audioSize,
            metadata: item.metadata,
    };    // Ensure metadata has a title if available in queryInfo
    const itemWithQueryInfo = item as HistoryItem & { queryInfo?: { title?: string } };
    if (item.metadata?.title === undefined && itemWithQueryInfo.queryInfo?.title) {
      serializedItem['metadata'] = { ...item.metadata, title: itemWithQueryInfo.queryInfo.title };
    }

    return serializedItem;
  }

  // Serialize history item for file system metadata (excludes audioData)
  serializeForFileSystemMetadata(item: HistoryItem): Record<string, unknown> {
    const serializedItem: Record<string, unknown> = {
      id: item.id,
      text: item.text,
      settings: this.sanitizeSettings(item.settings),
      result: {
        queryId: item.result?.queryId?.getValue(),
        status: item.result.status,
        createdAt: item.result.createdAt.toISOString(),
        updatedAt: item.result.updatedAt.toISOString(),
        duration: item.result?.duration,
        fileSize: item.result?.fileSize,
        error: item.result?.error,
        processingTime: item.result?.processingTime,      },
      createdAt: item.createdAt.toISOString(),
      audioSize: item.audioSize,
      metadata: item.metadata,
    };

    // Ensure metadata has a title if available in queryInfo
    const itemWithQueryInfo = item as HistoryItem & { queryInfo?: { title?: string } };
    if (item.metadata?.title === undefined && itemWithQueryInfo.queryInfo?.title) {
      serializedItem['metadata'] = { ...item.metadata, title: itemWithQueryInfo.queryInfo.title };
    }

    return serializedItem;
  }  // Deserialize history item from localStorage
  deserializeFromLocalStorage(serializedItem: Record<string, unknown>): HistoryItem {
    const resultData = serializedItem['result'] as Record<string, unknown> || {};
    const historyItem: HistoryItem = {
      id: serializedItem['id'] as string,
      text: serializedItem['text'] as string,
      settings: this.mapLoadedSettings(serializedItem['settings'] as Record<string, unknown>),
      result: {
        queryId: resultData['queryId'] ? QueryId.fromString(resultData['queryId'] as string) : QueryId.generate(),
        status: (resultData['status'] as TTSResultStatus) || TTSResultStatus.COMPLETED,
        audioData: resultData['audioData'] ? Uint8Array.from(resultData['audioData'] as number[]) : undefined,
        createdAt: new Date((resultData['createdAt'] as string) || (serializedItem['createdAt'] as string)),
        updatedAt: new Date((resultData['updatedAt'] as string) || (serializedItem['createdAt'] as string)),        duration: resultData['duration'] as number | undefined,
        fileSize: resultData['fileSize'] as number | undefined,
        error: resultData['error'] as { readonly code: string; readonly message: string; readonly details?: unknown } | undefined,
        processingTime: resultData['processingTime'] as number | undefined,
      },
      createdAt: new Date(serializedItem['createdAt'] as string),
      audioSize: serializedItem['audioSize'] as number,
      metadata: serializedItem['metadata'] as HistoryItem['metadata'],
    };

    return historyItem;
  }
  // Deserialize history item from file system metadata (audioData loaded separately)
  deserializeFromFileSystemMetadata(serializedItem: Record<string, unknown>, audioData?: Uint8Array): HistoryItem {
    const resultData = serializedItem['result'] as Record<string, unknown> || {};
    let text = serializedItem['text'];
    if (typeof text !== 'string') {
      console.warn('[DataSerializationService] HistoryItem.text is not a string during deserialization:', text);
      text = text !== undefined && text !== null ? String(text) : '';
    }
    const historyItem: HistoryItem = {
      id: serializedItem['id'] as string,
      text: text as string,
      settings: this.mapLoadedSettings(serializedItem['settings'] as Record<string, unknown>),
      result: {
        queryId: resultData['queryId'] ? QueryId.fromString(resultData['queryId'] as string) : QueryId.generate(),
        status: (resultData['status'] as TTSResultStatus) || TTSResultStatus.COMPLETED,
        audioData: audioData,
        createdAt: new Date((resultData['createdAt'] as string) || (serializedItem['createdAt'] as string)),
        updatedAt: new Date((resultData['updatedAt'] as string) || (serializedItem['createdAt'] as string)),
        duration: resultData['duration'] as number | undefined,
        fileSize: resultData['fileSize'] as number | undefined,
        error: resultData['error'] as { readonly code: string; readonly message: string; readonly details?: unknown } | undefined,
        processingTime: resultData['processingTime'] as number | undefined,
      },
      createdAt: new Date(serializedItem['createdAt'] as string),
      audioSize: serializedItem['audioSize'] as number,
      metadata: serializedItem['metadata'] as HistoryItem['metadata'],
    };

    return historyItem;
  }

  // Create a new HistoryItem instance
  createHistoryItem(
    text: string,
    settings: TTSSettings,
    result: TTSResult,
    metadata?: { title?: string; tags?: string[]; duration?: number }
  ): HistoryItem {
    // Ensure a unique ID, use result queryId if available, otherwise generate
    const id = result.queryId?.getValue() || Date.now().toString();
    
    return {
      id,
      text,
      settings: this.sanitizeSettings(settings),
      result: result,
      createdAt: new Date(),
      audioSize: result.audioData?.byteLength || 0,
      metadata: metadata,
    };
  }  // Sanitize settings before saving (e.g., remove API keys)
  sanitizeSettings<T extends TTSSettings | ProviderConfiguration>(settings: T): T {
    const sanitized = { ...settings } as T & { apiKey?: unknown };
    delete sanitized.apiKey;
    return sanitized;
  }
  // Map loaded settings to the correct type/structure
  mapLoadedSettings(settings: Record<string, unknown>): TTSSettings {
    // Perform mapping and type assertions as needed based on your loaded data structure
    const mappedSettings: TTSSettings = {
      provider: (settings['provider'] as ModelProvider) || ModelProvider.OPENAI,
      model: (settings['model'] as string) || '',
      voice: (settings['voice'] as string) || '',
      apiKey: settings['apiKey'] ? ApiKey.fromString(settings['apiKey'] as string) : undefined,
      // Map other settings properties as needed
    };
    return mappedSettings;
  }
}
