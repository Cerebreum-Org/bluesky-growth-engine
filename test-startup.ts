/**
 * Test script for startup validation
 */

import { config } from "./src/shared/Config.js";
import { startupValidator } from "./src/startup-validator.js";

async function testStartupValidation() {
  console.log("🚀 Testing Startup Validation System\n");
  
  try {
    // Load configuration first
    console.log("📋 Loading configuration...");
    await config.load();
    console.log("✅ Configuration loaded successfully\n");
    
    // Run validation
    console.log("🔍 Running startup validation...");
    const result = await startupValidator.validateAll();
    
    if (result.success) {
      console.log("✅ STARTUP VALIDATION PASSED\n");
      console.log(startupValidator.generateReport());
    } else {
      console.log("❌ STARTUP VALIDATION FAILED\n"); 
      console.log("Error:", (result.success ? undefined : (result.error || "Unknown error")));
      console.log("\nDetailed Report:");
      console.log(startupValidator.generateReport());
    }
    
  } catch (error) {
    console.error("💥 Error during startup validation:", error);
  }
}

// Run the test
testStartupValidation().catch(console.error);
