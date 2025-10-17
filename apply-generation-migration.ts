import 'dotenv/config';
import { supabase } from './src/supabase';
import { readFileSync } from 'fs';

async function applyMigration() {
  console.log('Applying generation column migration...\n');
  
  try {
    // Read the SQL file
    const sql = readFileSync('./supabase/add-generation-column.sql', 'utf-8');
    
    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));
    
    console.log(`Executing ${statements.length} SQL statements...\n`);
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`${i + 1}. ${stmt.substring(0, 60)}...`);
      
      const { error } = await supabase.rpc('exec_sql', { sql: stmt });
      
      if (error) {
        // Try direct query as fallback
        console.log('   Trying alternative method...');
        // Note: Supabase JS client doesn't support raw SQL directly
        // You may need to run this via Supabase dashboard SQL editor instead
        console.log('   ⚠️  Please run this SQL in Supabase dashboard SQL editor');
        console.log('   File: supabase/add-generation-column.sql\n');
        break;
      } else {
        console.log('   ✓ Success\n');
      }
    }
    
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║            MIGRATION INSTRUCTIONS                      ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    console.log('To apply this migration:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the contents of:');
    console.log('   supabase/add-generation-column.sql');
    console.log('4. Run the SQL\n');
    console.log('This will add a "generation" column to track network distance.\n');
    
  } catch (err) {
    console.error('Error:', err);
  }
}

applyMigration().catch(console.error);
