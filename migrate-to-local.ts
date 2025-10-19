import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Cloud Supabase (using anon key - service role not available)
const cloudUrl = process.env.CLOUD_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const cloudAnonKey = process.env.CLOUD_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!cloudUrl || !cloudAnonKey) throw new Error('Missing CLOUD_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or CLOUD_SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY');
const cloudSupabase = createClient(cloudUrl, cloudAnonKey);

// Self-hosted Supabase (using service role for direct DB access)
const localUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
if (!localUrl || !serviceKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
const localSupabase = createClient(localUrl, serviceKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

async function migrateData() {
  console.log('🚀 Starting data migration from cloud to self-hosted Supabase...\n');

  try {
    // 1. Export users from cloud
    console.log('📥 Step 1: Fetching users from cloud Supabase...');
    let allUsers: any[] = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
      const { data: users, error } = await cloudSupabase
        .from('bluesky_users')
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('❌ Error fetching users:', error);
        break;
      }

      if (!users || users.length === 0) break;

      allUsers = allUsers.concat(users);
      console.log(`   Fetched ${users.length} users (total: ${allUsers.length})`);
      page++;

      if (users.length < pageSize) break;
    }

    console.log(`\n   ✅ Total users to migrate: ${allUsers.length}\n`);

    // 2. Import users to local
    if (allUsers.length > 0) {
      console.log('📤 Step 2: Importing users to self-hosted Supabase...');
      const batchSize = 100;

      for (let i = 0; i < allUsers.length; i += batchSize) {
        const batch = allUsers.slice(i, i + batchSize);
        const { error } = await localSupabase
          .from('bluesky_users')
          .upsert(batch, { onConflict: 'did' });

        if (error) {
          console.error(`   ❌ Error importing batch ${Math.floor(i / batchSize) + 1}:`, error);
        } else {
          console.log(`   ✅ Imported batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allUsers.length / batchSize)} (${batch.length} users)`);
        }
      }
    }

    // 3. Export follows from cloud
    console.log('\n📥 Step 3: Fetching follows from cloud Supabase...');
    let allFollows: any[] = [];
    page = 0;

    while (true) {
      const { data: follows, error } = await cloudSupabase
        .from('bluesky_follows')
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('❌ Error fetching follows:', error);
        break;
      }

      if (!follows || follows.length === 0) break;

      allFollows = allFollows.concat(follows);
      console.log(`   Fetched ${follows.length} follows (total: ${allFollows.length})`);
      page++;

      if (follows.length < pageSize) break;
    }

    console.log(`\n   ✅ Total follows to migrate: ${allFollows.length}\n`);

    // 4. Import follows to local
    if (allFollows.length > 0) {
      console.log('📤 Step 4: Importing follows to self-hosted Supabase...');
      const batchSize = 100;

      for (let i = 0; i < allFollows.length; i += batchSize) {
        const batch = allFollows.slice(i, i + batchSize);
        const { error } = await localSupabase
          .from('bluesky_follows')
          .upsert(batch, { onConflict: 'follower_did,following_did' });

        if (error) {
          console.error(`   ❌ Error importing batch ${Math.floor(i / batchSize) + 1}:`, error);
        } else {
          console.log(`   ✅ Imported batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allFollows.length / batchSize)} (${batch.length} follows)`);
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Migration complete!');
    console.log('='.repeat(50));
    console.log(`\n📊 Summary:`);
    console.log(`   Users migrated:   ${allUsers.length.toLocaleString()}`);
    console.log(`   Follows migrated: ${allFollows.length.toLocaleString()}`);
    console.log('\n💡 Next step: Ensure your .env contains SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for local, and NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY for cloud.');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateData();
