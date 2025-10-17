import 'dotenv/config';
import { supabase } from './src/supabase';
import { setTimeout as sleep } from 'timers/promises';

async function checkStatus() {
  console.log('Checking follows collection status...\n');
  
  // Get current follows count
  const { count: followsCount } = await supabase
    .from('bluesky_follows')
    .select('*', { count: 'exact', head: true });
  
  console.log(`✓ Total follows in database: ${followsCount?.toLocaleString()}`);
  
  // Get a recent follow to check timestamp
  const { data: recentFollow } = await supabase
    .from('bluesky_follows')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (recentFollow) {
    const age = Math.round((Date.now() - new Date(recentFollow.created_at).getTime()) / 1000);
    console.log(`✓ Most recent follow: ${age} seconds ago\n`);
  }
  
  // Sample 10 users and check how many of their follows are in our network
  const { data: sampleUsers } = await supabase
    .from('bluesky_users')
    .select('did, handle, following_count')
    .gt('following_count', 100)
    .limit(10);
  
  console.log('Sample analysis (checking if follows are internal or external):');
  console.log('─'.repeat(60));
  
  for (const user of sampleUsers || []) {
    const { count } = await supabase
      .from('bluesky_follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_did', user.did);
    
    const internalFollows = count || 0;
    const totalFollows = user.following_count || 0;
    const pct = totalFollows > 0 ? ((internalFollows / totalFollows) * 100).toFixed(1) : '0';
    
    console.log(`${user.handle.slice(0, 25).padEnd(25)} | ${String(internalFollows).padStart(4)}/${String(totalFollows).padStart(4)} (${pct}% internal)`);
  }
  
  console.log('\n📊 Interpretation:');
  console.log('   - Low % = Most follows go to users OUTSIDE your indexed set');
  console.log('   - High % = Most follows stay within your network');
  console.log('   - This is normal for a large Bluesky sample!\n');
}

checkStatus().catch(console.error);
