/**
 * Jetstream utility functions
 */

export function calculateEngagementScore(
  likes: number, 
  reposts: number, 
  replies: number,
  followers = 1
): number {
  const engagement = likes + (reposts * 2) + (replies * 3);
  const normalized = engagement / Math.max(followers, 1);
  return Math.round(normalized * 100) / 100;
}

export function shouldProcessUser(
  userDid: string, 
  processedUsers: Set<string>,
  maxUsers: number
): boolean {
  return !processedUsers.has(userDid) && processedUsers.size < maxUsers;
}

export function formatMemoryUsage(): string {
  const used = process.memoryUsage();
  const format = (bytes: number) => Math.round(bytes / 1024 / 1024);
  return `RSS: ${format(used.rss)}MB, Heap: ${format(used.heapUsed)}/${format(used.heapTotal)}MB`;
}
