import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const c = createClient(url, key);

for (const cnt of ['exact','planned','estimated']) {
  try {
    const r = await c.from('bluesky_likes').select('*', { count: cnt, head: true });
    console.log(cnt, 'status', r.status, 'count', r.count, 'err', r.error?.message||null);
  } catch (e) {
    console.log(cnt, 'threw', e.message);
  }
}
