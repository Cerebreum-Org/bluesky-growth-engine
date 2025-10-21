import { describe, it, expect, vi } from "vitest";

// Simple retry helper for testing
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retryWithBackoff<T>(
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
      if (attempt === maxRetries) break;
      
      // Check for rate limit
      const isRateLimit = 
        error?.error === "RateLimitExceeded" || 
        error?.status === 429;
      
      if (isRateLimit) {
        const resetTime = error?.headers?.["ratelimit-reset"];
        const waitTime = resetTime 
          ? (parseInt(resetTime) * 1000 - Date.now()) 
          : baseDelay * Math.pow(2, attempt - 1);
        await delay(Math.max(0, waitTime));
      } else {
        await delay(baseDelay * Math.pow(2, attempt - 1));
      }
    }
  }
  throw lastError;
}

describe("retryWithBackoff", () => {
  it("should succeed on first try", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await retryWithBackoff(fn);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on failure and eventually succeed", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("success");
    
    const result = await retryWithBackoff(fn, 5, 10);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should throw after max retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));
    
    await expect(retryWithBackoff(fn, 3, 10)).rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should handle rate limit errors", async () => {
    const rateLimitError = { 
      error: "RateLimitExceeded", 
      status: 429 
    };
    const fn = vi.fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValue("success after rate limit");
    
    const result = await retryWithBackoff(fn, 3, 10);
    expect(result).toBe("success after rate limit");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
