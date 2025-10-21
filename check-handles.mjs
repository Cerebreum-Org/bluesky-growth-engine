import { supabase } from './src/supabase.js';

const { data, error } = await supabase
  .from('bluesky_users')
  .select('did, handle, display_name, followers_count')
  .order('followers_count', { ascending: false })
  .limit(10);

if (error) {
  console.error('Error:', error);
} else {
  console.log('Top users by followers:');
  data.forEach((user, i) => {
    console.log(`${i+1}. ${user.display_name || 'No display name'} (@${user.handle}) - ${user.followers_count} followers`);
    if (user.handle.startsWith('did:')) {
      console.log(`   ⚠️ Handle is a DID: ${user.handle}`);
    }
  });
}
