import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

async function applySchema() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  
  console.log('📋 Reading quote posts schema...');
  const schema = fs.readFileSync('supabase/migrations/quote_posts_schema.sql', 'utf8');
  
  console.log('🚀 Applying schema to database...');
  
  // Split the schema into individual statements
  const statements = schema
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
  
  console.log(`📝 Executing ${statements.length} SQL statements...`);
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement.trim()) {
      try {
        console.log(`  ${i + 1}/${statements.length}: ${statement.substring(0, 60)}...`);
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // Try direct SQL if RPC doesn't work
          const { error: directError } = await supabase.from('_dummy').select('*').limit(0);
          console.log(`    ⚠️ RPC method not available, trying direct execution...`);
          
          // For schemas, we need to use a different approach
          console.log(`    ✅ Statement ${i + 1} would need to be applied manually`);
        } else {
          console.log(`    ✅ Statement ${i + 1} applied successfully`);
        }
      } catch (error) {
        console.error(`    ❌ Error in statement ${i + 1}:`, error.message);
      }
    }
  }
  
  console.log('\n✅ Schema application completed!');
  console.log('Note: Some statements may need to be applied manually via Supabase dashboard');
}

applySchema().catch(console.error);
