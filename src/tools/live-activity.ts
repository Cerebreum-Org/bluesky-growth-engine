import 'dotenv/config';
import { supabase } from '../supabase.js';

async function snapshot() {
  const [posts, follows, likes, reposts] = await Promise.all([
    supabase.from('bluesky_posts').select('*', { count: 'exact' }).limit(1),
    supabase.from('bluesky_follows').select('*', { count: 'exact' }).limit(1),
    supabase.from('bluesky_likes').select('*', { count: 'exact' }).limit(1),
    supabase.from('bluesky_reposts').select('*', { count: 'exact' }).limit(1),
  ]);
  return {
    posts: posts.count || 0,
    follows: follows.count || 0,
    likes: likes.count || 0,
    reposts: reposts.count || 0,
  };
}

async function latest() {
  const now = new Date();
  const since = new Date(now.getTime() - 60_000).toISOString();
  const [p, f, l, r] = await Promise.all([
    supabase.from('bluesky_posts').select('uri, created_at').gte('indexed_at', since).limit(3).order('indexed_at', { ascending: false }),
    supabase.from('bluesky_follows').select('follower_did, following_did, created_at').gte('indexed_at', since).limit(3).order('indexed_at', { ascending: false }),
    supabase.from('bluesky_likes').select('author_did, subject_uri, created_at').gte('indexed_at', since).limit(3).order('indexed_at', { ascending: false }),
    supabase.from('bluesky_reposts').select('author_did, subject_uri, created_at').gte('indexed_at', since).limit(3).order('indexed_at', { ascending: false }),
  ]);
  return { p: p.data || [], f: f.data || [], l: l.data || [], r: r.data || [] };
}

async function main() {
  const a = await snapshot();
  console.log('Now:', a);
  const first = await latest();
  console.log('Recent (≤60s):', JSON.stringify(first));
  await new Promise(r => setTimeout(r, 10000));
  const b = await snapshot();
  console.log('10s later:', b, 'Δ', { posts: b.posts - a.posts, follows: b.follows - a.follows, likes: b.likes - a.likes, reposts: b.reposts - a.reposts });
  const second = await latest();
  console.log('Recent (≤60s) now:', JSON.stringify(second));
}

main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
