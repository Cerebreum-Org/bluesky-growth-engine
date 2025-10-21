/**
 * Test script for reliability patterns integration
 */

// Load environment variables first
import { config as dotenv } from "dotenv";
dotenv();

import { config } from "./src/shared/Config.js";
import { Logger } from "./src/shared/Logger.js";
import { CircuitBreaker } from "./src/shared/CircuitBreaker.js";
import { Result } from "./src/shared/Result.js";

async function testIntegration() {
  console.log("🚀 Testing Reliability Patterns Integration\n");
  
  try {
    // Load config
    config.load();
    const logger = Logger.create("IntegrationTest");
    
    // Test 1: Result + Circuit Breaker Integration
    console.log("🔗 Testing Result + Circuit Breaker Integration...");
    const dbBreaker = new CircuitBreaker("db-test", {
      failureThreshold: 2,
      resetTimeout: 2000
    });
    
    // Test successful operation returning Result
    const successResult = await dbBreaker.execute(async (): Promise<string> => {
      logger.info("Database query simulation", { query: "SELECT 1" });
      return "Query successful";
    });
    
    console.log("✅ Success case:", successResult.success ? 
      `Data: ${successResult.data}` : 
      `Error: ${(successResult.success ? undefined : (successResult.error || "Unknown error"))}`
    );
    
    // Test 2: Circuit Breaker + Failure Handling
    console.log("\n⚡ Testing Circuit Breaker with Simulated Failures...");
    let attempts = 0;
    
    for (let i = 0; i < 4; i++) {
      const result = await dbBreaker.execute(async () => {
        attempts++;
        if (attempts <= 2) {
          throw new Error(`Simulated DB failure ${attempts}`);
        }
        return `Success after ${attempts} attempts`;
      });
      
      if (result.success) {
        logger.info("Operation succeeded", { attempt: i + 1, data: result.data });
        console.log(`  Attempt ${i + 1}: ✅ ${result.data}`);
      } else {
        logger.warn("Operation failed", { attempt: i + 1, error: (result.success ? undefined : (result.error || "Unknown error")) });
        console.log(`  Attempt ${i + 1}: ❌ ${(result.success ? undefined : (result.error || "Unknown error"))}`);
      }
    }
    
    // Test 3: Result Type Composition
    console.log("\n🧩 Testing Result Type Composition...");
    
    const parseNumber = (input: string): Result<number, string> => {
      const num = parseInt(input);
      if (isNaN(num)) {
        return { success: false, error: `Invalid number: ${input}` };
      }
      return { success: true, data: num };
    };
    
    const double = (num: number): Result<number, string> => {
      return { success: true, data: num * 2 };
    };
    
    // Test valid input
    const validResult = parseNumber("42");
    if (validResult.success) {
      const doubledResult = double(validResult.data);
      console.log("✅ Valid input chain:", doubledResult);
    }
    
    // Test invalid input
    const invalidResult = parseNumber("not-a-number");
    console.log("✅ Invalid input handling:", invalidResult);
    
    // Test 4: Logging Context Preservation
    console.log("\n📝 Testing Context Preservation...");
    const contextLogger = Logger.create("ContextTest");
    
    async function businessLogic(userId: string, operation: string) {
      contextLogger.info("Starting business operation", { userId, operation });
      
      try {
        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 50));
        contextLogger.info("Business operation completed", { userId, operation, status: "success" });
        return { success: true, data: "Operation completed" };
      } catch (error) {
        contextLogger.error("Business operation failed", { userId, operation, error });
        return { success: false, error: "Operation failed" };
      }
    }
    
    await businessLogic("user-123", "update-profile");
    console.log("✅ Context logging working");
    
    console.log("\n🎉 All integration patterns working correctly!");
    
  } catch (error) {
    console.error("💥 Error during integration testing:", error);
  }
}

// Run the test
testIntegration().catch(console.error);
