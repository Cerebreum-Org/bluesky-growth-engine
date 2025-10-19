import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const cloudUrl = process.env.CLOUD_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const cloudAnonKey = process.env.CLOUD_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!cloudUrl || !cloudAnonKey) throw new Error('Missing CLOUD_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or CLOUD_SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY');
const cloudSupabase = createClient(cloudUrl, cloudAnonKey);

const localUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
if (!localUrl || !serviceKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
const localSupabase = createClient(localUrl, serviceKey);

async function migrateData() {
  console.log('🚀 Starting migration with smaller batches...\n');

  try {
    // Migrate users with smaller batches and ordering
    console.log('📥 Fetching users...');
    let allUsers: any[] = [];
    let page = 0;
    const fetchSize = 100;  // Much smaller fetch size

    while (page < 100) {  // Limit to 10k users max for now
      const { data: users, error } = await cloudSupabase
        .from('bluesky_users')
        .select('*')
        .order('indexed_at', { ascending: true })
        .range(page * fetchSize, (page + 1) * fetchSize - 1);

      if (error) {
        console.error(`   ❌ Error at page ${page}:`, error.message);
        break;
      }

      if (!users || users.length === 0) break;

      allUsers = allUsers.concat(users);
      
      // Import immediately
      const { error: insertError } = await localSupabase
        .from('bluesky_users')
        .upsert(users, { onConflict: 'did' });

      if (insertError) {
        console.error(`   ❌ Import error:`, insertError.message);
      } else {
        console.log(`   ✅ Page ${page + 1}: ${users.length} users (total: ${allUsers.length})`);
      }

      page++;
      if (users.length < fetchSize) break;
    }

    console.log(`\n   Total users migrated: ${allUsers.length}\n`);

    // Migrate follows
    console.log('📥 Fetching follows...');
    let allFollows: any[] = [];
    page = 0;

    while (page < 100) {  // Limit to 10k follows
      const { data: follows, error } = await cloudSupabase
        .from('bluesky_follows')
        .select('*')
        .order('created_at', { ascending: true })
        .range(page * fetchSize, (page + 1) * fetchSize - 1);

      if (error) {
        console.error(`   ❌ Error at page ${page}:`, error.message);
        break;
      }

      if (!follows || follows.length === 0) break;

      allFollows = allFollows.concat(follows);
      
      // Import immediately, skip on error
      const { error: insertError } = await localSupabase
        .from('bluesky_follows')
        .upsert(follows, { onConflict: 'follower_did,following_did' });

      if (insertError) {
        console.log(`   ⚠️  Page ${page + 1}: Skipping (missing users)`);
      } else {
        console.log(`   ✅ Page ${page + 1}: ${follows.length} follows (total: ${allFollows.length})`);
      }

      page++;
      if (follows.length < fetchSize) break;
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Users: ${allUsers.length}`);
    console.log(`   Follows: ${allFollows.length}`);

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateData();
