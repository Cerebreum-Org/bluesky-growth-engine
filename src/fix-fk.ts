import { supabase } from './supabase.js';

async function fix() {
  console.log('🔧 Fixing foreign keys...');
  
  // Drop existing constraints
  await supabase.rpc('exec_sql', { sql: 'ALTER TABLE bluesky_posts DROP CONSTRAINT IF EXISTS bluesky_posts_author_did_fkey' });
  await supabase.rpc('exec_sql', { sql: 'ALTER TABLE bluesky_reposts DROP CONSTRAINT IF EXISTS bluesky_reposts_subject_uri_fkey' });
  await supabase.rpc('exec_sql', { sql: 'ALTER TABLE bluesky_reposts DROP CONSTRAINT IF EXISTS bluesky_reposts_author_did_fkey' });
  await supabase.rpc('exec_sql', { sql: 'ALTER TABLE bluesky_likes DROP CONSTRAINT IF EXISTS bluesky_likes_subject_uri_fkey' });
  await supabase.rpc('exec_sql', { sql: 'ALTER TABLE bluesky_likes DROP CONSTRAINT IF EXISTS bluesky_likes_author_did_fkey' });
  console.log('✓ Dropped constraints');
  
  // Add deferrable constraints
  await supabase.rpc('exec_sql', { sql: 'ALTER TABLE bluesky_posts ADD CONSTRAINT bluesky_posts_author_did_fkey FOREIGN KEY (author_did) REFERENCES bluesky_users(did) DEFERRABLE INITIALLY DEFERRED' });
  await supabase.rpc('exec_sql', { sql: 'ALTER TABLE bluesky_reposts ADD CONSTRAINT bluesky_reposts_author_did_fkey FOREIGN KEY (author_did) REFERENCES bluesky_users(did) DEFERRABLE INITIALLY DEFERRED' });
  await supabase.rpc('exec_sql', { sql: 'ALTER TABLE bluesky_reposts ADD CONSTRAINT bluesky_reposts_subject_uri_fkey FOREIGN KEY (subject_uri) REFERENCES bluesky_posts(uri) DEFERRABLE INITIALLY DEFERRED' });
  await supabase.rpc('exec_sql', { sql: 'ALTER TABLE bluesky_likes ADD CONSTRAINT bluesky_likes_author_did_fkey FOREIGN KEY (author_did) REFERENCES bluesky_users(did) DEFERRABLE INITIALLY DEFERRED' });
  await supabase.rpc('exec_sql', { sql: 'ALTER TABLE bluesky_likes ADD CONSTRAINT bluesky_likes_subject_uri_fkey FOREIGN KEY (subject_uri) REFERENCES bluesky_posts(uri) DEFERRABLE INITIALLY DEFERRED' });
  console.log('✓ Added deferrable constraints');
  
  console.log('✅ Done!');
  process.exit(0);
}

fix();
