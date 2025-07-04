/**
 * Logging utilities for the application
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  timestamp: Date;
  data?: unknown;
}

export class Logger {
  private static currentLevel: LogLevel = LogLevel.INFO;

  static setLevel(level: LogLevel): void {
    Logger.currentLevel = level;
  }
  static debug(message: string, context?: string, data?: unknown): void {
    Logger.log(LogLevel.DEBUG, message, context, data);
  }

  static info(message: string, context?: string, data?: unknown): void {
    Logger.log(LogLevel.INFO, message, context, data);
  }

  static warn(message: string, context?: string, data?: unknown): void {
    Logger.log(LogLevel.WARN, message, context, data);
  }

  static error(message: string, context?: string, data?: unknown): void {
    Logger.log(LogLevel.ERROR, message, context, data);
  }
  private static log(level: LogLevel, message: string, context?: string, data?: unknown): void {
    if (level < Logger.currentLevel) {
      return;
    }

    const prefix = context ? `[${context}]` : '';
    const formattedMessage = `${prefix} ${message}`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, data);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, data);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, data);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage, data);
        break;
    }
  }
}

/**
 * Utility functions for common operations
 */
export class StringUtils {
  static truncate(text: string, maxLength: number, suffix = '...'): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - suffix.length) + suffix;
  }

  static capitalize(text: string): string {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }

  static isEmpty(text?: string | null): boolean {
    return !text || text.trim().length === 0;
  }

  static wordCount(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
}

export class DateUtils {
  static formatRelative(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) {
      return 'just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  static formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}

export class FileUtils {
  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  static getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }
}
