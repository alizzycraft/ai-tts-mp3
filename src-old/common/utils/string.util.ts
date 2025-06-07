// filepath: d:\dev\github\ai-tts-mp3\src\common\utils\string.util.ts

export class StringUtil {
  static capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  static truncate(str: string, maxLength: number): string {
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
  }

  static isEmpty(str: string | null | undefined): boolean {
    return !str || str.trim().length === 0;
  }

  static countWords(str: string): number {
    if (!str || str.trim().length === 0) return 0;
    return str.trim().split(/\s+/).length;
  }

  static countCharacters(str: string): number {
    return str.length;
  }

  static normalizeWhitespace(str: string): string {
    return str.trim().replace(/\s+/g, ' ');
  }

  static isAlphanumeric(str: string): boolean {
    return /^[a-zA-Z0-9]+$/.test(str);
  }

  static sanitize(str: string): string {
    return str.replace(/[<>]/g, '');
  }
}
