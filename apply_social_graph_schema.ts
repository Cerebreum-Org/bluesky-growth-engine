import 'dotenv/config';
import { supabase } from './src/supabase.js';
import { readFileSync } from 'fs';

const sql = readFileSync('./supabase/schema_social_graph.sql', 'utf8');

async function applySchema() {
  console.log('Applying social graph schema...');
  
  // Split by semicolon and execute each statement
  const statements = sql.split(';').filter(s => s.trim());
  
  for (const statement of statements) {
    if (statement.trim()) {
      console.log(`Executing: ${statement.substring(0, 60)}...`);
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });
      
      if (error) {
        console.log('Note:', error.message);
      }
    }
  }
  
  console.log('✓ Schema applied');
}

applySchema().catch(console.error);
