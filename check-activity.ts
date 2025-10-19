import 'dotenv/config';
import { supabase } from './src/supabase.js';

const { data } = await supabase
  .from('bluesky_users')
  .select('indexed_at')
  .order('indexed_at', { ascending: false })
  .limit(1);

if (data?.[0]) {
  const lastActivity = new Date(data[0].indexed_at);
  const minutesAgo = Math.floor((Date.now() - lastActivity.getTime()) / 60000);
  console.log(`Last user indexed: ${minutesAgo} minutes ago (${lastActivity.toISOString()})`);
} else {
  console.log('No users found');
}
