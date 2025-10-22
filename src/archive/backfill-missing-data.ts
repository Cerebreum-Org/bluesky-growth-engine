import 'dotenv/config';
import { BskyAgent } from '@atproto/api';
import { supabase } from './supabase.js';

const agent = new BskyAgent({ service: 'https://public.api.bsky.app' });

const BATCH_SIZE = 100;
const DELAY_MS = 1000; // Rate limit: 1 second between batches

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function findMissingUsers() {
  console.log('🔍 Finding posts with missing authors...');
  
  const { data, error } = await supabase.rpc('find_missing_authors', {}, { count: 'exact' });
  
  if (error) {
    // Fallback query if RPC doesn't exist
    const result = await supabase
      .from('bluesky_posts')
      .select('author_did')
      .not('author_did', 'in', 
        supabase.from('bluesky_users').select('did')
      )
      .limit(1000);
    
    return [...new Set(result.data?.map(p => p.author_did) || [])];
  }
  
  return data || [];
}

async function findMissingPosts() {
  console.log('🔍 Finding likes/reposts with missing posts...');
  
  // Find missing posts from likes
  const { data: likesData } = await supabase
    .from('bluesky_likes')
    .select('subject_uri')
    .limit(1000);
  
  // Find missing posts from reposts
  const { data: repostsData } = await supabase
    .from('bluesky_reposts')
    .select('subject_uri')
    .limit(1000);
  
  const allUris = [
    ...(likesData?.map(l => l.subject_uri) || []),
    ...(repostsData?.map(r => r.subject_uri) || [])
  ];
  
  // Check which ones don't exist
  const { data: existingPosts } = await supabase
    .from('bluesky_posts')
    .select('uri')
    .in('uri', allUris);
  
  const existingSet = new Set(existingPosts?.map(p => p.uri) || []);
  return [...new Set(allUris.filter(uri => !existingSet.has(uri)))];
}

async function fetchAndInsertUsers(dids: string[]) {
  console.log(`📥 Fetching ${dids.length} missing users...`);
  
  let fetched = 0;
  let failed = 0;
  let deleted = 0;
  
  for (let i = 0; i < dids.length; i += BATCH_SIZE) {
    const batch = dids.slice(i, i + BATCH_SIZE);
    
    try {
      const { data } = await agent.getProfiles({ actors: batch });
      
      const users = data.profiles.map(profile => ({
        did: profile.did,
        handle: profile.handle,
        display_name: profile.displayName,
        description: profile.description,
        avatar: profile.avatar,
        followers_count: profile.followersCount,
        following_count: profile.followsCount,
        posts_count: profile.postsCount,
        indexed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      
      const { error } = await supabase
        .from('bluesky_users')
        .upsert(users, { onConflict: 'did', ignoreDuplicates: true });
      
      if (!error) {
        fetched += users.length;
        console.log(`  ✓ Batch ${Math.floor(i / BATCH_SIZE) + 1}: +${users.length} users`);
      }
      
    } catch (error: any) {
      failed += batch.length;
      console.error(`  ⚠️  Batch failed:`, error.message);
    }
    
    if (i + BATCH_SIZE < dids.length) {
      await sleep(DELAY_MS);
    }
  }
  
  return { fetched, failed, deleted };
}

async function fetchAndInsertPosts(uris: string[]) {
  console.log(`📥 Fetching ${uris.length} missing posts...`);
  
  let fetched = 0;
  let failed = 0;
  let deleted = 0;
  
  for (const uri of uris) {    try {
      // Parse AT URI: at://did:plc:xxx/app.bsky.feed.post/rkey
      const parts = uri.replace('at://', '').split('/');
      const repo = parts[0];
      const rkey = parts[2];      const response = await agent.app.bsky.feed.post.get({ repo, rkey });      
      if (!response?.data?.value) {        // Post was deleted - insert placeholder record
        const deletedPost = {
          uri,
          cid: 'deleted',
          author_did: repo,
          text: '[DELETED]',
          created_at: new Date().toISOString(),
          reply_count: 0,
          repost_count: 0,
          like_count: 0,
          quote_count: 0
        };
        
        const { error } = await supabase
          .from('bluesky_posts')
          .upsert([deletedPost], { onConflict: 'uri' });        
        if (!error) {
          deleted++;
          if (deleted % 50 === 0) {
            console.log(`  🗑️  ${deleted} deleted posts stored...`);
          }
        }
        continue;
      }
      
      const data = response.data;
        const post = {
          uri,
          cid: data.cid,
          author_did: repo,
          text: (data.value as any).text || '',
          created_at: (data.value as any).createdAt,
          reply_count: 0,
          repost_count: 0,
          like_count: 0,
          quote_count: 0
        };
        
        const { error } = await supabase
          .from('bluesky_posts')
          .upsert([post], { onConflict: 'uri' });
        
        if (!error) {
          fetched++;
          if (fetched % 10 === 0) {
            console.log(`  ✓ Fetched ${fetched} posts...`);
          }
        }
      
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      if (errorMsg.includes('Could not locate record') || errorMsg.includes('Could not find repo')) {
        // Insert placeholder for deleted post
        const parts = uri.replace('at://', '').split('/');
        const repo = parts[0];
        const deletedPost = {
          uri,
          cid: 'deleted',
          author_did: repo,
          text: '[DELETED]',
          created_at: new Date().toISOString(),
          reply_count: 0,
          repost_count: 0,
          like_count: 0,
          quote_count: 0
        };
        
        const { error: insertError } = await supabase
          .from('bluesky_posts')
          .upsert([deletedPost], { onConflict: 'uri' });
        
        if (!insertError) {
          deleted++;
          if (deleted % 50 === 0) {
            console.log(`  🗑️  ${deleted} deleted posts stored...`);
          }
        }
        continue;
      }
      failed++;
      console.error(`  ⚠️  Failed to fetch post ${uri}:`, errorMsg);
      if (failed % 10 === 0) {
        console.error(`  📊 Total failed: ${failed} posts...`);
      }
    }
  }
  
  return { fetched, failed, deleted };
}

async function run() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║              BACKFILL MISSING DATA                        ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  // Step 1: Backfill missing users
  const missingUserDids = await findMissingUsers();
  console.log(`📊 Found ${missingUserDids.length} missing users\n`);
  
  if (missingUserDids.length > 0) {
    const userResults = await fetchAndInsertUsers(missingUserDids);
    console.log(`\n✅ Users: ${userResults.fetched} fetched, ${userResults.failed} failed\n`);
  }
  
  // Step 2: Backfill missing posts
  const missingPostUris = await findMissingPosts();
  console.log(`📊 Found ${missingPostUris.length} missing posts\n`);
  
  if (missingPostUris.length > 0) {
    const postResults = await fetchAndInsertPosts(missingPostUris);
    console.log(`\n✅ Posts: ${postResults.fetched} fetched, ${postResults.deleted} deleted, ${postResults.failed} failed\n`);
  }
  
  console.log('🎉 Backfill complete!');
  process.exit(0);
}

run();
