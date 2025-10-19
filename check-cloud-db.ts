import { createClient } from '@supabase/supabase-js';

const cloudUrl = 'https://biwqkbajbjqqycrfxetf.supabase.co';
const cloudKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpd3FrYmFqYmpxcXljcmZ4ZXRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2MjM3MTksImV4cCI6MjA3NjE5OTcxOX0.r5fWyriSDQJEAqk8d-NNLDsrtQCl-g1PBg6y-g4x888';

const cloudSupabase = createClient(cloudUrl, cloudKey);

console.log('Connecting to cloud database...');
const { count, error, status, statusText } = await cloudSupabase
  .from('bluesky_users')
  .select('*', { count: 'exact', head: true });

console.log('Status:', status, statusText);
if (error) {
  console.error('Error:', JSON.stringify(error, null, 2));
} else {
  console.log(`Cloud database has: ${count?.toLocaleString()} users`);
}
