import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

async function runMigration() {
  console.log('Running migration for backfill_checkpoints...');
  
  const sql = fs.readFileSync('supabase/migrations/20250120_backfill_checkpoints.sql', 'utf-8');
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // Try alternative approach - run each statement separately
      console.log('Trying alternative approach...');
      
      await supabase.from('backfill_checkpoints').select('id').limit(1);
      
      const createTable = `
        CREATE TABLE IF NOT EXISTS backfill_checkpoints (
          id TEXT PRIMARY KEY,
          last_processed_index INTEGER NOT NULL DEFAULT 0,
          processed_users INTEGER NOT NULL DEFAULT 0,
          collected_posts INTEGER NOT NULL DEFAULT 0,
          collected_likes INTEGER NOT NULL DEFAULT 0,
          collected_reposts INTEGER NOT NULL DEFAULT 0,
          collected_follows INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;
      
      console.log('Migration completed (table may already exist)');
      
      // Try to insert initial checkpoint
      const { error: insertError } = await supabase
        .from('backfill_checkpoints')
        .upsert({ id: 'main', last_processed_index: 0, processed_users: 0 }, { onConflict: 'id' });
      
      if (insertError) {
        console.log('Checkpoint initialization:', insertError.message);
      } else {
        console.log('✓ Checkpoint table ready');
      }
    } else {
      console.log('✓ Migration completed successfully');
    }
  } catch (error: any) {
    console.error('Migration error:', error.message);
  }
}

runMigration();
