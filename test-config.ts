/**
 * Test script for basic configuration and reliability components
 */

// Load environment variables first
import { config as dotenv } from "dotenv";
dotenv();

import { config } from "./src/shared/Config.js";
import { Logger } from "./src/shared/Logger.js";
import { CircuitBreaker } from "./src/shared/CircuitBreaker.js";
import { healthChecker } from "./src/shared/HealthCheck.js";

async function testBasicComponents() {
  console.log("🚀 Testing Basic Reliability Components\n");
  
  try {
    // Test 1: Configuration loading
    console.log("📋 Testing Configuration System...");
    const appConfig = config.load();
    console.log("✅ Configuration loaded successfully");
    console.log(`   Node version: ${appConfig.NODE_VERSION}`);
    console.log(`   Port: ${appConfig.server.port}`);
    console.log(`   Supabase URL: ${appConfig.supabase.url}`);
    console.log("");
    
    // Test 2: Logger
    console.log("📝 Testing Logger System...");
    const logger = Logger.create("TestRunner");
    logger.info("Logger test message", { test: true });
    logger.warn("Logger warning test", { level: "warning" });
    console.log("✅ Logger working correctly\n");
    
    // Test 3: Circuit Breaker
    console.log("⚡ Testing Circuit Breaker...");
    const testBreaker = new CircuitBreaker("test-breaker", {
      failureThreshold: 3,
      resetTimeout: 5000
    });
    
    // Test successful operation
    const successResult = await testBreaker.execute(async () => {
      return "Success!";
    });
    console.log("✅ Circuit breaker successful operation:", successResult);
    console.log("");
    
    // Test 4: Health Checker
    console.log("🏥 Testing Health Checker...");
    healthChecker.registerCheck("test-check", async () => {
      return { status: "healthy", timestamp: new Date().toISOString() };
    });
    
    const healthResults = await healthChecker.checkAll();
    console.log("✅ Health check results:");
    Object.entries(healthResults).forEach(([name, result]) => {
      console.log(`   ${name}: ${JSON.stringify(result)}`);
    });
    
    console.log("\n🎉 All basic components working correctly!");
    
  } catch (error) {
    console.error("💥 Error during component testing:", error);
  }
}

// Run the test
testBasicComponents().catch(console.error);
