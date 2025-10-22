/**
 * Result Type Pattern for Functional Error Handling
 * 
 * Provides a type-safe way to handle operations that may fail without throwing exceptions.
 * Inspired by Rust's Result<T, E> and functional programming patterns.
 * 
 * @example
 * ```typescript
 * function divide(a: number, b: number): Result<number, string> {
 *   if (b === 0) return Err("Division by zero");
 *   return Ok(a / b);
 * }
 * 
 * const result = divide(10, 2);
 * if (result.ok) {
 *   console.log("Result:", result.value); // Result: 5
 * } else {
 *   console.error("Error:", result.error);
 * }
 * ```
 */

/**
 * Successful result containing a value
 */
export interface OkResult<T> {
  ok: true;
  value: T;
}

/**
 * Failed result containing an error
 */
export interface ErrResult<E> {
  ok: false;
  error: E;
}

/**
 * Result type that represents either success (Ok) or failure (Err)
 */
export type Result<T, E = Error> = OkResult<T> | ErrResult<E>;

/**
 * Create a successful result
 */
export function Ok<T>(value: T): OkResult<T> {
  return { ok: true, value };
}

/**
 * Create a failed result
 */
export function Err<E>(error: E): ErrResult<E> {
  return { ok: false, error };
}

/**
 * Type guard to check if result is Ok
 */
export function isOk<T, E>(result: Result<T, E>): result is OkResult<T> {
  return result.ok === true;
}

/**
 * Type guard to check if result is Err
 */
export function isErr<T, E>(result: Result<T, E>): result is ErrResult<E> {
  return result.ok === false;
}

/**
 * Unwrap a result, throwing if it's an error.
 * Use only when you're certain the result is Ok.
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  // Type guard doesn't work here, so we manually cast
  const errResult = result as ErrResult<E>;
  throw new Error(`Called unwrap on an Err result: ${String(errResult.error)}`);
}

/**
 * Unwrap a result, returning a default value if it's an error
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return result.ok ? result.value : defaultValue;
}

/**
 * Map a function over the Ok value of a result
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (result.ok) {
    return Ok(fn(result.value));
  }
  return result as ErrResult<E>;
}

/**
 * Chain operations that return Results (flatMap/bind)
 */
export function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (result.ok) {
    return fn(result.value);
  }
  return result as ErrResult<E>;
}

/**
 * Convert a promise to a Result
 */
export async function fromPromise<T>(
  promise: Promise<T>
): Promise<Result<T, Error>> {
  try {
    const value = await promise;
    return Ok(value);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Wrap a function that might throw in a Result
 */
export function tryCatch<T, E = Error>(
  fn: () => T,
  errorHandler?: (error: unknown) => E
): Result<T, E> {
  try {
    return Ok(fn());
  } catch (error) {
    const err = errorHandler
      ? errorHandler(error)
      : (error instanceof Error ? error : new Error(String(error))) as E;
    return Err(err);
  }
}

/**
 * Combine multiple Results into one
 * Returns Ok with array of values if all are Ok, otherwise returns first Err
 */
export function all<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (result.ok) {
      values.push(result.value);
    } else {
      return result as ErrResult<E>;
    }
  }
  return Ok(values);
}
