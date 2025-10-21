#!/usr/bin/env python3
import re
import sys

def fix_template_literals(filename):
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Fix escaped backticks
        content = re.sub(r'\\\\`', '`', content)
        
        # Fix escaped dollar signs in template literals
        content = re.sub(r'\\\\\\$', '$', content)
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(content)
            
        print(f"Fixed {filename}")
    except Exception as e:
        print(f"Error fixing {filename}: {e}")

if __name__ == "__main__":
    files = [
        "src/api-server.ts",
        "src/backfill/utils.ts", 
        "src/jetstream-collector-enhanced.ts",
        "src/production-test.ts",
        "src/startup-validator.ts",
        "src/strategies.ts"
    ]
    
    for filename in files:
        fix_template_literals(filename)
