// Enhanced stub to satisfy all usage patterns
export class QuotePostCollector {
  private supabaseUrl?: string;
  private supabaseKey?: string;
  
  constructor(supabaseUrl?: string, supabaseKey?: string) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseKey = supabaseKey;
  }
  
  async processBatch(posts: unknown[]): Promise<{ quotePosts: number }> {
    return { quotePosts: posts.length };
  }
  
  // Add missing methods that jetstream collectors expect
  clearCache(): void {
    // Stub implementation
  }
  
  getQuoteChainAnalytics(): unknown {
    // Stub implementation
    return {
      totalQuotes: 0,
      averageChainLength: 0,
      longestChain: 0
    };
  }
}

export function isQuotePost(record: unknown): boolean {
  return !!(record?.embed?.record && record.embed?.$type === "app.bsky.embed.record");
}

export function extractQuoteTarget(record: unknown): { uri?: string; author?: string } | null {
  if (!isQuotePost(record)) return null;
  const embedRecord = (record as any).embed?.record;
  if (!embedRecord) return null;
  return {
    uri: embedRecord.uri,
    author: embedRecord.uri?.split("/")[2]
  };
}

export default QuotePostCollector;
