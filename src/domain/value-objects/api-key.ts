/**
 * API Key Value Object
 * Encapsulates API key validation and handling
 */
export class ApiKey {
  private constructor(private readonly value: string) {
    if (!this.isValid(value)) {
      throw new Error('Invalid API key format');
    }
  }

  static fromString(apiKey: string): ApiKey {
    return new ApiKey(apiKey);
  }

  getValue(): string {
    return this.value;
  }

  getMasked(): string {
    if (this.value.length <= 8) {
      return '*'.repeat(this.value.length);
    }
    const start = this.value.substring(0, 4);
    const end = this.value.substring(this.value.length - 4);
    return `${start}${'*'.repeat(this.value.length - 8)}${end}`;
  }

  private isValid(value: string): boolean {
    // Basic validation - at least 8 characters, no whitespace
    return typeof value === 'string' && 
           value.length >= 8 && 
           !/\s/.test(value);
  }

  equals(other: ApiKey): boolean {
    return this.value === other.value;
  }
}
