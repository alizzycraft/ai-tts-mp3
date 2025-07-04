/**
 * Query ID Value Object
 * Represents a unique identifier for TTS queries
 */
export class QueryId {
  private constructor(private readonly value: string) {
    if (!this.isValid(value)) {
      throw new Error('Invalid query ID format');
    }
  }

  static generate(): QueryId {
    const uuid = crypto.randomUUID();
    return new QueryId(uuid);
  }

  static fromString(id: string): QueryId {
    return new QueryId(id);
  }

  getValue(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }

  private isValid(value: string): boolean {
    // UUID v4 format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }

  equals(other: QueryId): boolean {
    return this.value === other.value;
  }
}
