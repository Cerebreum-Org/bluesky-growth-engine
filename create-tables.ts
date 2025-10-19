import 'dotenv/config';
import { readFileSync } from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const sql = readFileSync('./supabase/schema_social_graph.sql', 'utf8');

async function createTables() {
  try {
    // Use Supabase's REST API to execute SQL
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY!,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ sql })
    });

    if (response.ok) {
      console.log('✓ Tables created successfully');
    } else {
      const error = await response.text();
      console.log('Response:', error);
      console.log('Note: Tables may already exist or need to be created via Supabase dashboard');
    }
  } catch (error: any) {
    console.log('Error:', error.message);
    console.log('\nTo create tables manually, run this SQL in Supabase dashboard:');
    console.log(sql.substring(0, 200) + '...');
  }
}

createTables();
