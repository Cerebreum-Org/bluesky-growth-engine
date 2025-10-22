// Simple stub to avoid compilation errors
export class QuotePostCollector {
  constructor() {}
  
  async processBatch(posts: any[]): Promise<{ quotePosts: number }> {
    return { quotePosts: posts.length };
  }
}

export function isQuotePost(record: any): boolean {
  return !!(record?.embed?.record && record.embed?.$type === 'app.bsky.embed.record');
}

export function extractQuoteTarget(record: any): { uri?: string; author?: string } | null {
  if (!isQuotePost(record)) return null;
  const embedRecord = record.embed?.record;
  if (!embedRecord) return null;
  return {
    uri: embedRecord.uri,
    author: embedRecord.uri?.split('/')[2]
  };
}

export default QuotePostCollector;
