/**
 * Result type for explicit error handling without exceptions
 */

export type Result<T, E = string> = 
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Create a successful result
 */
export const Ok = <T>(data: T): Result<T, never> => ({ 
  success: true, 
  data 
});

/**
 * Create an error result  
 */
export const Err = <E>(error: E): Result<never, E> => ({ 
  success: false, 
  error 
});

/**
 * Result utility namespace for creating Results
 */
export namespace Result {
  export function success<T>(data: T): Result<T, string> {
    return { success: true, data };
  }

  export function error<E = string>(error: E): Result<never, E> {
    return { success: false, error };
  }
}

// Helper functions for working with Results
export const map = <T, U, E>(
  fn: (data: T) => U,
  result: Result<T, E>
): Result<U, E> => {
  if (result.success) {
    return Ok(fn(result.data));
  } else {
    return result; // TypeScript knows this is the error case
  }
};

export const flatMap = <T, U, E>(
  fn: (data: T) => Result<U, E>,
  result: Result<T, E>
): Result<U, E> => {
  if (result.success) {
    return fn(result.data);
  } else {
    return result as Result<U, E>; // Cast because the error type is the same
  }
};

// Add isSuccess and isError as standalone functions
export const isSuccess = <T, E>(result: Result<T, E>): result is { success: true; data: T } => {
  return result.success;
};

export const isError = <T, E>(result: Result<T, E>): result is { success: false; error: E } => {
  return !result.success;
};
