/**
 * Example usage of Result type pattern
 * 
 * This file demonstrates how to use Result types in the codebase.
 * Delete or move to docs/ once pattern is widely adopted.
 */

import { Result, Ok, Err, fromPromise, tryCatch, andThen } from './Result.js';

// ============================================================================
// Example 1: Basic usage
// ============================================================================

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return Err("Division by zero");
  return Ok(a / b);
}

const result1 = divide(10, 2);
if (result1.ok) {
  console.log("✓ Division result:", result1.value);
} else {
  console.error("✗ Division error:", result1.error);
}

// ============================================================================
// Example 2: Database operations
// ============================================================================

async function fetchUser(id: string): Promise<Result<{ name: string }, string>> {
  // Simulate database fetch
  if (id === "123") {
    return Ok({ name: "Alice" });
  }
  return Err(`User ${id} not found`);
}

async function exampleDatabaseUsage() {
  const userResult = await fetchUser("123");
  
  if (userResult.ok) {
    console.log("✓ Found user:", userResult.value.name);
  } else {
    console.error("✗ Database error:", userResult.error);
  }
}

// ============================================================================
// Example 3: Converting promises
// ============================================================================

async function examplePromiseConversion() {
  // Convert a promise that might throw to a Result
  const result = await fromPromise(
    fetch('https://api.example.com/data').then(r => r.json())
  );
  
  if (result.ok) {
    console.log("✓ Fetched data:", result.value);
  } else {
    console.error("✗ Fetch failed:", result.error.message);
  }
}

// ============================================================================
// Example 4: Chaining operations (Railway Oriented Programming)
// ============================================================================

function parseNumber(str: string): Result<number, string> {
  const num = Number(str);
  if (isNaN(num)) return Err(`Invalid number: ${str}`);
  return Ok(num);
}

function validatePositive(num: number): Result<number, string> {
  if (num <= 0) return Err("Number must be positive");
  return Ok(num);
}

function calculateSquareRoot(str: string): Result<number, string> {
  return andThen(
    andThen(parseNumber(str), validatePositive),
    (num) => Ok(Math.sqrt(num))
  );
}

const sqrtResult = calculateSquareRoot("16");
if (sqrtResult.ok) {
  console.log("✓ Square root:", sqrtResult.value); // 4
}

// ============================================================================
// Example 5: Safe JSON parsing
// ============================================================================

function safeJsonParse<T>(json: string): Result<T, Error> {
  return tryCatch(
    () => JSON.parse(json) as T,
    (error) => new Error(`JSON parse failed: ${error}`)
  );
}

const jsonResult = safeJsonParse<{ name: string }>('{"name":"Bob"}');
if (jsonResult.ok) {
  console.log("✓ Parsed JSON:", jsonResult.value.name);
}

// ============================================================================
// Example 6: Using in existing code (Bluesky API calls)
// ============================================================================

interface BlueskyUser {
  did: string;
  handle: string;
}

async function fetchBlueskyProfile(handle: string): Promise<Result<BlueskyUser, Error>> {
  try {
    // Simulate API call
    const response = await fetch(`https://bsky.social/xrpc/com.atproto.repo.describeRepo?repo=${handle}`);
    
    if (!response.ok) {
      return Err(new Error(`HTTP ${response.status}: ${response.statusText}`));
    }
    
    const data = await response.json();
    return Ok({
      did: data.did,
      handle: data.handle
    });
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}

// Usage in strategy:
async function exampleStrategyUsage() {
  const profile = await fetchBlueskyProfile("alice.bsky.social");
  
  if (profile.ok) {
    console.log(`✓ Found user ${profile.value.handle} (${profile.value.did})`);
    // Continue with strategy logic
  } else {
    console.error(`✗ Failed to fetch profile: ${profile.error.message}`);
    // Handle error gracefully without crashing
  }
}

export { 
  divide, 
  fetchUser, 
  calculateSquareRoot, 
  safeJsonParse,
  fetchBlueskyProfile 
};
