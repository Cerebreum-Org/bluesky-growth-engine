import 'dotenv/config';
import { BskyAgent } from '@atproto/api';

async function test() {
  const agent = new BskyAgent({ service: 'https://bsky.social' });
  await agent.login({
    identifier: process.env.BLUESKY_HANDLE!,
    password: process.env.BLUESKY_PASSWORD!,
  });
  
  console.log('✓ Authenticated');
  
  // Test with a known active user (me)
  const response = await agent.getAuthorFeed({
    actor: 'neoreactionary.bsky.social',
    limit: 10,
  });
  
  console.log(`Found ${response.data.feed.length} posts`);
  console.log('First post:', response.data.feed[0]?.post.record);
}

test().catch(console.error);
