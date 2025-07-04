/**
 * Result Type for Error Handling
 * Provides type-safe error handling without exceptions
 */
export type Result<T, E = Error> = Success<T> | Failure<E>;

export class Success<T> {
  readonly isSuccess = true;
  readonly isFailure = false;

  constructor(public readonly value: T) {}

  map<U>(fn: (value: T) => U): Result<U, never> {
    return new Success(fn(this.value));
  }

  flatMap<U, E>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value);
  }
  mapError<F>(_fn: (error: never) => F): Result<T, F> {
    return this as unknown as Success<T>;
  }
}

export class Failure<E> {
  readonly isSuccess = false;
  readonly isFailure = true;

  constructor(public readonly error: E) {}
  map<U>(_fn: (value: never) => U): Result<U, E> {
    return this as unknown as Failure<E>;
  }

  flatMap<U, F>(_fn: (value: never) => Result<U, F>): Result<U, E | F> {
    return this as unknown as Failure<E>;
  }

  mapError<F>(fn: (error: E) => F): Result<never, F> {
    return new Failure(fn(this.error));
  }
}

export const success = <T>(value: T): Success<T> => new Success(value);
export const failure = <E>(error: E): Failure<E> => new Failure(error);

/**
 * Helper function to wrap async operations in Result type
 */
export async function tryCatch<T>(
  operation: () => Promise<T>
): Promise<Result<T, Error>> {
  try {
    const result = await operation();
    return success(result);
  } catch (error) {
    return failure(error instanceof Error ? error : new Error(String(error)));
  }
}
