/**
 * Simple, memory-based rate limiter
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) { // 100 requests per minute by default
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(key: string): { allowed: boolean; resetTime?: number; remaining?: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    // Clean up expired entries periodically
    if (Math.random() < 0.01) {
      this.cleanup();
    }

    if (!entry || now > entry.resetTime) {
      // First request or window expired
      this.store.set(key, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return { 
        allowed: true, 
        remaining: this.maxRequests - 1,
        resetTime: now + this.windowMs
      };
    }

    if (entry.count >= this.maxRequests) {
      // Rate limit exceeded
      return { 
        allowed: false, 
        resetTime: entry.resetTime,
        remaining: 0
      };
    }

    // Increment count
    entry.count++;
    return { 
      allowed: true, 
      remaining: this.maxRequests - entry.count,
      resetTime: entry.resetTime
    };
  }

  private cleanup() {
    const now = Date.now();
    // Convert Map to Array to avoid iteration issues
    const storeEntries = Array.from(this.store.entries());
    
    for (const [key, entry] of storeEntries) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  // Get current status without affecting the counter
  getStatus(key: string): { remaining: number; resetTime: number } {
    const entry = this.store.get(key);
    const now = Date.now();

    if (!entry || now > entry.resetTime) {
      return { remaining: this.maxRequests, resetTime: now + this.windowMs };
    }

    return { 
      remaining: Math.max(0, this.maxRequests - entry.count),
      resetTime: entry.resetTime
    };
  }

  reset(key: string) {
    this.store.delete(key);
  }
}

// Pre-configured rate limiters for different use cases
export const apiRateLimit = new RateLimiter(100, 60000); // 100 requests per minute for API
export const collectRateLimit = new RateLimiter(50, 60000);  // 50 requests per minute for collection
export const strictRateLimit = new RateLimiter(10, 60000);   // 10 requests per minute for sensitive operations
