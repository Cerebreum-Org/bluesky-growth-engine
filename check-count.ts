import 'dotenv/config';
import { supabase } from './src/supabase.js';

const { count, error } = await supabase
  .from('bluesky_users')
  .select('*', { count: 'exact', head: true });

if (error) {
  console.error('Error:', error);
} else {
  console.log(`Total users in database: ${count}`);
}

// Also check recent activity by time periods
const now = new Date();
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

const { count: lastHour } = await supabase
  .from('bluesky_users')
  .select('*', { count: 'exact', head: true })
  .gte('indexed_at', oneHourAgo.toISOString());

const { count: lastDay } = await supabase
  .from('bluesky_users')
  .select('*', { count: 'exact', head: true })
  .gte('indexed_at', oneDayAgo.toISOString());

console.log(`Users indexed in last hour: ${lastHour}`);
console.log(`Users indexed in last 24 hours: ${lastDay}`);
