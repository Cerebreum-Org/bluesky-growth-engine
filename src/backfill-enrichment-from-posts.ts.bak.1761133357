import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import {
  extractMentions,
  extractHashtags,
  extractLinks,
  extractMediaData,
  extractTimePatterns,
} from './text-processors';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

const BATCH = Number(process.env.BATCH_SIZE || 500);

async function fetchPosts(offset: number) {
  const { data, error } = await supabase
    .from('bluesky_posts')
    .select('uri, author_did, text, created_at, embed_type, embed_uri')
    .order('created_at', { ascending: false })
    .range(offset, offset + BATCH - 1);
  if (error) throw new Error(error.message);
  return data || [];
}

async function upsert(table: string, rows: any[], conflict: string) {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: conflict, ignoreDuplicates: false });
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function run() {
  let offset = 0;
  let total = 0;
  for (;;) {
    const posts = await fetchPosts(offset);
    if (!posts.length) break;

    const mentions: any[] = [];
    const hashtags: any[] = [];
    const links: any[] = [];
    const media: any[] = [];
    const patterns: Map<string, any> = new Map();

    for (const p of posts) {
      const createdAt = p.created_at as string;

      for (const m of extractMentions(p.text || '')) {
        mentions.push({
          post_uri: p.uri,
          blocker_did: p.author_did,
          mentioned_handle: m.handle,
          mentioned_did: null,
          position: m.position,
          created_at: createdAt,
        });
      }

      for (const h of extractHashtags(p.text || '')) {
        hashtags.push({
          post_uri: p.uri,
          blocker_did: p.author_did,
          hashtag: h.hashtag,
          normalized_tag: h.normalized,
          position: h.position,
          created_at: createdAt,
        });
      }

      for (const l of extractLinks(p.text || '')) {
        links.push({
          post_uri: p.uri,
          blocker_did: p.author_did,
          url: l.url,
          domain: l.domain,
          position: l.position,
          created_at: createdAt,
        });
      }

      for (const md of extractMediaData({ embed: p.embed_uri ? { record: { uri: p.embed_uri } } : undefined })) {
        media.push({
          post_uri: p.uri,
          blocker_did: p.author_did,
          media_type: md.type,
          media_url: md.url,
          media_cid: md.cid,
          alt_text: md.alt,
          dimensions: md.dimensions ? JSON.stringify(md.dimensions) : null,
          metadata: md.metadata ? JSON.stringify(md.metadata) : null,
          created_at: createdAt,
        });
      }

      const tp = extractTimePatterns(createdAt);
      const key = `${p.author_did}-${tp.hourOfDay}-${tp.dayOfWeek}`;
      const existing = patterns.get(key) || {
        blocker_did: p.author_did,
        hour_of_day: tp.hourOfDay,
        day_of_week: tp.dayOfWeek,
        post_count: 0,
        like_count: 0,
        repost_count: 0,
        avg_engagement: 0,
      };
      existing.post_count += 1;
      patterns.set(key, existing);
    }

    await upsert('bluesky_mentions', mentions, 'id');
    await upsert('bluesky_hashtags', hashtags, 'id');
    await upsert('bluesky_links', links, 'id');
    await upsert('bluesky_media', media, 'id');
    await upsert('bluesky_activity_patterns', Array.from(patterns.values()), 'blocker_did,hour_of_day,day_of_week');

    offset += posts.length;
    total += posts.length;
    console.log(`✓ Enriched ${total} posts...`);
  }

  console.log('✅ Backfill enrichment complete');
}

run().catch((e) => {
  console.error('Backfill enrichment failed', e);
  process.exit(1);
});
