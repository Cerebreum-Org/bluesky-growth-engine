import 'dotenv/config';
import { supabase } from './src/supabase.js';

async function testSupabaseSetup() {
  console.log('Testing Supabase connection and schema...\n');

  // Test 1: Connection
  console.log('1. Testing connection...');
  const { error: connectionError } = await supabase
    .from('bluesky_users')
    .select('count')
    .limit(1);
  
  if (connectionError) {
    console.error('❌ Connection failed:', connectionError.message);
    return false;
  }
  console.log('✅ Connected to Supabase\n');

  // Test 2: Insert a test user
  console.log('2. Testing user insert...');
  const testUser = {
    did: 'did:plc:test123',
    handle: 'test.bsky.social',
    display_name: 'Test User',
    description: 'Test description',
    followers_count: 100,
    following_count: 50,
    posts_count: 25,
    labels: { test: 'value' },
    associated: { verified: true },
    viewer_following: true,
    indexed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: insertError } = await supabase
    .from('bluesky_users')
    .upsert(testUser, { onConflict: 'did' });

  if (insertError) {
    console.error('❌ User insert failed:', insertError.message);
    return false;
  }
  console.log('✅ User insert successful\n');

  // Test 3: Test composite key upsert for relationships
  console.log('3. Testing relationship insert...');
  
  // Insert a second test user
  const testUser2 = {
    did: 'did:plc:test456',
    handle: 'test2.bsky.social',
    indexed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await supabase.from('bluesky_users').upsert(testUser2, { onConflict: 'did' });

  const testFollow = {
    follower_did: 'did:plc:test123',
    following_did: 'did:plc:test456',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: followError } = await supabase
    .from('bluesky_follows')
    .upsert(testFollow, { onConflict: 'follower_did,following_did' });

  if (followError) {
    console.error('❌ Relationship insert failed:', followError.message);
    console.error('This might be because the bluesky_follows table doesn\'t exist yet.');
    console.error('Run the migration: supabase/migration_add_follows_table.sql\n');
    return false;
  }
  console.log('✅ Relationship insert successful\n');

  // Test 4: Test foreign key constraints
  console.log('4. Testing foreign key constraint...');
  const invalidFollow = {
    follower_did: 'did:plc:nonexistent',
    following_did: 'did:plc:test123',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: fkError } = await supabase
    .from('bluesky_follows')
    .insert(invalidFollow);

  if (!fkError) {
    console.error('❌ Foreign key constraint not working (should have failed)');
    return false;
  }
  console.log('✅ Foreign key constraint working correctly\n');

  // Test 5: Test JSONB fields
  console.log('5. Testing JSONB fields...');
  const { data: userWithJson, error: jsonError } = await supabase
    .from('bluesky_users')
    .select('did, labels, associated')
    .eq('did', 'did:plc:test123')
    .single();

  if (jsonError) {
    console.error('❌ JSONB query failed:', jsonError.message);
    return false;
  }
  console.log('✅ JSONB fields working:', JSON.stringify(userWithJson, null, 2), '\n');

  // Cleanup
  console.log('6. Cleaning up test data...');
  await supabase.from('bluesky_follows').delete().eq('follower_did', 'did:plc:test123');
  await supabase.from('bluesky_users').delete().eq('did', 'did:plc:test123');
  await supabase.from('bluesky_users').delete().eq('did', 'did:plc:test456');
  console.log('✅ Cleanup complete\n');

  console.log('🎉 All tests passed! Supabase setup is working correctly.');
  return true;
}

testSupabaseSetup().catch(console.error);
