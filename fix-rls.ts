import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || supabaseKey;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixRLS() {
  console.log('Checking RLS policies...\n');
  
  // Check if we can query with service role
  const { data: users, error } = await supabase
    .from('bluesky_users')
    .select('did, handle')
    .limit(5);
  
  if (error) {
    console.error('Error with service role:', error);
    return;
  }
  
  console.log(`✅ Service role can access ${users?.length || 0} users`);
  
  // Now check with anon key (same as service key in this setup)
  const anonClient = createClient(supabaseUrl, anonKey);
  
  const { data: anonUsers, error: anonError } = await anonClient
    .from('bluesky_users')
    .select('did, handle')
    .limit(5);
  
  if (anonError) {
    console.error('\n❌ Anon role cannot access users:', anonError.message);
    console.log('\nThis is the issue! RLS is blocking anonymous access.');
    console.log('\nTo fix this, run the following SQL in your Supabase SQL Editor:\n');
    console.log('-- Enable RLS on all tables (if not already enabled)');
    console.log('ALTER TABLE bluesky_users ENABLE ROW LEVEL SECURITY;');
    console.log('ALTER TABLE bluesky_follows ENABLE ROW LEVEL SECURITY;');
    console.log('ALTER TABLE bluesky_posts ENABLE ROW LEVEL SECURITY;');
    console.log('ALTER TABLE bluesky_likes ENABLE ROW LEVEL SECURITY;');
    console.log('ALTER TABLE bluesky_reposts ENABLE ROW LEVEL SECURITY;');
    console.log('\n-- Create policies to allow public read access');
    console.log('CREATE POLICY "Allow public read access" ON bluesky_users FOR SELECT USING (true);');
    console.log('CREATE POLICY "Allow public read access" ON bluesky_follows FOR SELECT USING (true);');
    console.log('CREATE POLICY "Allow public read access" ON bluesky_posts FOR SELECT USING (true);');
    console.log('CREATE POLICY "Allow public read access" ON bluesky_likes FOR SELECT USING (true);');
    console.log('CREATE POLICY "Allow public read access" ON bluesky_reposts FOR SELECT USING (true);');
    console.log('\n-- Or disable RLS completely (less secure but simpler for a personal project)');
    console.log('ALTER TABLE bluesky_users DISABLE ROW LEVEL SECURITY;');
    console.log('ALTER TABLE bluesky_follows DISABLE ROW LEVEL SECURITY;');
    console.log('ALTER TABLE bluesky_posts DISABLE ROW LEVEL SECURITY;');
    console.log('ALTER TABLE bluesky_likes DISABLE ROW LEVEL SECURITY;');
    console.log('ALTER TABLE bluesky_reposts DISABLE ROW LEVEL SECURITY;');
  } else {
    console.log(`\n✅ Anon role can access ${anonUsers?.length || 0} users`);
    console.log('RLS is configured correctly!');
  }
}

fixRLS().catch(console.error);
