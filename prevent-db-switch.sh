#!/bin/bash
set -e

echo "🔒 Protecting your database from accidental switching..."

# 1. Rename the problematic config so it can't trigger new instances
if [ -f supabase/config.toml ]; then
    mv supabase/config.toml supabase/config.toml.DISABLED
    echo "✓ Disabled supabase/config.toml (renamed to .DISABLED)"
fi

# 2. Add protection comments to .env
if ! grep -q "DO NOT CHANGE" .env; then
    cat > .env.tmp << 'ENVEOF'
# ⚠️  DO NOT CHANGE SUPABASE_URL - Your 572k users are on port 8000!
# If you see port 54321, you're on the WRONG database (empty one)
ENVEOF
    cat .env >> .env.tmp
    mv .env.tmp .env
    echo "✓ Added protection warning to .env"
fi

# 3. Create a database sanity check script
cat > check-correct-db.ts << 'TSEOF'
import 'dotenv/config';
import { supabase } from './src/supabase.js';

const { count } = await supabase
  .from('bluesky_users')
  .select('*', { count: 'exact', head: true });

const expectedMin = 500000; // Should have 572k users

if (!count || count < expectedMin) {
  console.error(`\n❌ ERROR: Connected to WRONG database!`);
  console.error(`   Found: ${count?.toLocaleString() || 0} users`);
  console.error(`   Expected: ${expectedMin.toLocaleString()}+ users`);
  console.error(`\n   Your .env should have: SUPABASE_URL=http://localhost:8000`);
  console.error(`   NOT: http://100.69.129.86:54321\n`);
  process.exit(1);
}

console.log(`✓ Connected to correct database (${count.toLocaleString()} users)`);
TSEOF

echo "✓ Created check-correct-db.ts sanity check script"

echo ""
echo "✅ Protection installed!"
echo ""
echo "Now run: npx tsx check-correct-db.ts"
echo "This will verify you're on the right database before any script runs."
