import 'dotenv/config';
import { supabase } from '../supabase.js';

async function main() {
  const head = await supabase
    .from('bluesky_likes')
    .select('*', { count: 'exact' }).limit(1);
  console.log('Head count result:', head.count, head.error || 'ok');

  const sample = await supabase
    .from('bluesky_likes')
    .select('uri, author_did, subject_uri')
    .limit(3);
  console.log('Sample rows length:', sample.data?.length || 0, sample.error || 'ok');
  console.log(sample.data);
}

main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
