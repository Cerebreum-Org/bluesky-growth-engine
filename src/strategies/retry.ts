/**
 * Retry utilities with exponential backoff
 */

export function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  baseDelay = 5000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      if (attempt === maxRetries) {
        break;
      }
      
      // Check for rate limiting
      const isRateLimit = error?.error === "RateLimitExceeded" || error?.status === 429;
      
      if (isRateLimit) {
        const resetTime = error?.headers?.["ratelimit-reset"];
        const waitTime = resetTime 
          ? (parseInt(resetTime) * 1000 - Date.now()) 
          : baseDelay * Math.pow(2, attempt - 1);
        
        console.log(`⏳ Rate limited. Waiting ${Math.round(waitTime / 1000)}s before retry ${attempt}/${maxRetries}...`);
        await delay(Math.max(0, waitTime));
      } else {
        const waitTime = baseDelay * Math.pow(2, attempt - 1);
        console.log(`⚠️  Error on attempt ${attempt}/${maxRetries}. Retrying in ${Math.round(waitTime / 1000)}s...`);
        await delay(waitTime);
      }
    }
  }
  
  throw lastError;
}
