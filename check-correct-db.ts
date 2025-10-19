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
