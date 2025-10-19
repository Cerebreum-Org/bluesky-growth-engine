import 'dotenv/config';
import { supabase } from './supabase.js';

async function testRepost() {
  console.log('Testing repost insert...\n');
  
  const testRepost = {
    uri: 'at://test/app.bsky.feed.repost/test123',
    author_did: 'did:plc:test',
    subject_uri: 'at://nonexistent/app.bsky.feed.post/fake',
    subject_cid: 'test_cid',
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('bluesky_reposts')
    .insert(testRepost);

  if (error) {
    console.log('❌ Error:', error);
  } else {
    console.log('✓ Success! Repost saved:', data);
  }
  
  // Check existing reposts
  const { count } = await supabase
    .from('bluesky_reposts')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\nTotal reposts in database: ${count}`);
}

testRepost();
