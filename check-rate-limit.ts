import 'dotenv/config';
import { BskyAgent } from '@atproto/api';

async function check() {
  const agent = new BskyAgent({ service: 'https://bsky.social' });
  await agent.login({
    identifier: process.env.BLUESKY_HANDLE!,
    password: process.env.BLUESKY_PASSWORD!,
  });
  
  try {
    const response = await agent.getAuthorFeed({
      actor: 'neoreactionary.bsky.social',
      limit: 1,
    });
    console.log('✅ Rate limit OK - can proceed');
  } catch (e: any) {
    if (e.headers) {
      const reset = parseInt(e.headers['ratelimit-reset']);
      const remaining = e.headers['ratelimit-remaining'];
      const limit = e.headers['ratelimit-limit'];
      
      console.log(`Rate limit: ${remaining}/${limit} remaining`);
      console.log(`Resets at: ${new Date(reset * 1000).toLocaleString()}`);
      console.log(`Wait: ${Math.ceil((reset - Date.now()/1000) / 60)} minutes`);
    } else {
      console.log('Error:', e.message);
    }
  }
}

check();
