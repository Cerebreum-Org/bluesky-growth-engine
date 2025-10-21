import 'dotenv/config';
import { BskyAgent } from '@atproto/api';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Config (env with sane defaults)
const SERVICE = process.env.BLUESKY_SERVICE || 'https://bsky.social';
const HANDLE = process.env.BLUESKY_HANDLE!;
const PASSWORD = process.env.BLUESKY_PASSWORD!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY!;

const CONCURRENCY = parseInt(process.env.CONCURRENCY || '2');
const RATE_LIMIT_MS = parseInt(process.env.RATE_LIMIT_DELAY || '1000');
const PAGE_SIZE = parseInt(process.env.PAGE_SIZE || '100'); // per API call
const POSTS_PER_USER_MAX = parseInt(process.env.MAX_POSTS_PER_USER || '0'); // 0 = no cap (paginate)
const COLLECT_LIKES = process.env.COLLECT_LIKES !== 'false';
const COLLECT_REPOSTS = process.env.COLLECT_REPOSTS !== 'false';
const COLLECT_FOLLOWS = process.env.COLLECT_FOLLOWS !== 'false';

// Keyset pagination checkpoint
type Checkpoint = { lastDid?: string; processed: number; updatedAt: string };
const CHECKPOINT_PATH = process.env.CHECKPOINT_PATH || 'backfill-v3.checkpoint.json';

function loadCheckpoint(): Checkpoint {
  try { if (fs.existsSync(CHECKPOINT_PATH)) return JSON.parse(fs.readFileSync(CHECKPOINT_PATH,'utf8')); } catch {}
  return { processed: 0, updatedAt: new Date().toISOString() };
}
function saveCheckpoint(cp: Checkpoint) {
  cp.updatedAt = new Date().toISOString();
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp,null,2));
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
let agent: BskyAgent;

async function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }

async function initAgent(){
  if(!HANDLE || !PASSWORD) throw new Error('Missing BLUESKY_HANDLE/BLUESKY_PASSWORD');
  agent = new BskyAgent({ service: SERVICE });
  await agent.login({ identifier: HANDLE, password: PASSWORD });
  console.log('✓ Authenticated as', HANDLE);
}

async function flush<T>(table:string, rows:T[], onConflict:string){
  if(!rows.length) return;
  const batch = rows.splice(0, rows.length);
  const { error } = await supabase.from(table).upsert(batch as any, { onConflict });
  if (error) throw error;
}

async function collectPostsFor(did:string){
  let cursor: string|undefined;
  let collected = 0;
  do{
    const res = await agent.getAuthorFeed({ actor: did, limit: PAGE_SIZE, cursor });
    const posts: any[] = [];
    for(const item of res.data.feed){
      const p = item.post;
      posts.push({
        uri: p.uri, cid: p.cid, author_did: p.author.did,
        text: (p.record as any)?.text ?? null,
        created_at: p.indexedAt,
        reply_parent: (p.record as any)?.reply?.parent?.uri ?? null,
        reply_root: (p.record as any)?.reply?.root?.uri ?? null,
        embed_type: p.embed?.$type ?? null,
        embed_uri: (p.embed as any)?.uri ?? null,
        like_count: p.likeCount ?? 0,
        repost_count: p.repostCount ?? 0,
        reply_count: p.replyCount ?? 0,
        quote_count: (p as any)?.quoteCount ?? 0,
      });
    }
    await flush('bluesky_posts', posts, 'uri');
    collected += posts.length;
    if (COLLECT_LIKES || COLLECT_REPOSTS){
      // best-effort engagement (optional pagination within helpers)
      for (const item of res.data.feed){
        if (COLLECT_LIKES) await collectLikesFor(item.post.uri);
        if (COLLECT_REPOSTS) await collectRepostsFor(item.post.uri);
        await sleep(50);
      }
    }
    cursor = res.data.cursor;
    if (POSTS_PER_USER_MAX>0 && collected>=POSTS_PER_USER_MAX) break;
    await sleep(RATE_LIMIT_MS);
  } while(cursor);
}

async function collectLikesFor(postUri:string){
  let cursor: string|undefined;
  const likes:any[] = [];
  do{
    const res = await agent.app.bsky.feed.getLikes({ uri: postUri, limit: PAGE_SIZE as any, cursor } as any);
    for(const l of res.data.likes){
      likes.push({
        uri: `${l.actor.did}:${postUri}:like`,
        author_did: l.actor.did,
        subject_uri: postUri,
        subject_cid: (l as any)?.subject?.cid ?? '',
        created_at: l.createdAt,
      });
    }
    cursor = (res.data as any).cursor;
    if (likes.length>=500) { await flush('bluesky_likes', likes, 'uri'); }
    await sleep(50);
  } while(cursor);
  await flush('bluesky_likes', likes, 'uri');
}

async function collectRepostsFor(postUri:string){
  let cursor: string|undefined;
  const reps:any[] = [];
  do{
    const res = await agent.app.bsky.feed.getRepostedBy({ uri: postUri, limit: PAGE_SIZE as any, cursor } as any);
    for(const r of res.data.repostedBy){
      reps.push({
        uri: `${r.did}:${postUri}:repost`,
        author_did: r.did,
        subject_uri: postUri,
        subject_cid: (r as any)?.subject?.cid ?? '',
        created_at: (r as any)?.createdAt ?? new Date().toISOString(),
      });
    }
    cursor = (res.data as any).cursor;
    if (reps.length>=500) { await flush('bluesky_reposts', reps, 'uri'); }
    await sleep(50);
  } while(cursor);
  await flush('bluesky_reposts', reps, 'uri');
}

async function collectFollowsFor(did:string){
  if (!COLLECT_FOLLOWS) return;
  // following
  let cursor: string|undefined; const follows:any[]=[]; let count=0;
  do{
    const res = await agent.getFollows({ actor: did, limit: 100, cursor });
    for(const f of res.data.follows){
      follows.push({ follower_did: did, following_did: f.did, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      count++;
    }
    cursor = res.data.cursor; await sleep(100);
  } while(cursor);
  // followers
  cursor = undefined;
  do{
    const res = await agent.getFollowers({ actor: did, limit: 100, cursor });
    for(const f of res.data.followers){
      follows.push({ follower_did: f.did, following_did: did, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      count++;
    }
    cursor = res.data.cursor; await sleep(100);
  } while(cursor);
  await flush('bluesky_follows', follows, 'follower_did,following_did');
}

async function processUser(did:string){
  try{
    await collectPostsFor(did);
    await collectFollowsFor(did);
    // mark backfilled
    await supabase.from('bluesky_users').update({ last_backfilled_at: new Date().toISOString(), backfill_version: 'v3' }).eq('did', did);
  }catch(e:any){ console.error('User error', did, e?.message||e); }
}

async function* keysetUsers(lastDid?:string){
  let cursor = lastDid || '';
  while(true){
    let query = supabase.from('bluesky_users').select('did').order('did', { ascending: true }).limit(1000);
    if (cursor) query = query.gt('did', cursor);
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length===0) return;
    for (const row of data) yield row.did as string;
    cursor = data[data.length-1].did as string;
    saveCheckpoint({ lastDid: cursor, processed: 0, updatedAt: new Date().toISOString() });
  }
}

async function main(){
  console.log('Bluesky Backfill v3 starting...');
  await initAgent();
  const cp = loadCheckpoint();
  let inFlight: Promise<any>[] = [];
  let processed = 0;
  for await (const did of keysetUsers(cp.lastDid)){
    inFlight.push(processUser(did));
    if (inFlight.length>=CONCURRENCY){ await Promise.race(inFlight); inFlight = inFlight.filter(p=>!p.hasOwnProperty('settled')); }
    processed++;
    if (processed % 50 === 0){ console.log(`Processed ${processed} users...`); }
    await sleep(RATE_LIMIT_MS);
  }
  await Promise.allSettled(inFlight);
  console.log('Backfill v3 done.');
}

main().catch(e=>{ console.error('Fatal', e); process.exit(1); });
