<script lang="ts">
  import { onMount } from 'svelte';

  let analytics = $state<any>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const response = await fetch('/api/analytics');
      if (!response.ok) throw new Error('Failed to fetch analytics');
      analytics = await response.json();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      loading = false;
    }
  });

  function formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  function formatEngagementRate(rate: number): string {
    return rate.toFixed(2) + '%';
  }
</script>

<svelte:head>
  <title>Analytics - Bluesky Growth Engine</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
  <div class="container mx-auto px-4 py-8">
    <!-- Header -->
    <header class="mb-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            📊 Engagement Analytics
          </h1>
          <p class="text-gray-600 dark:text-gray-300">
            Viral posts, engagement patterns, and content insights
          </p>
        </div>
        <a 
          href="/" 
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          ← Back to Dashboard
        </a>
      </div>
    </header>

    {#if loading}
      <div class="flex items-center justify-center h-64">
        <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    {:else if error}
      <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p>Error: {error}</p>
      </div>
    {:else if analytics}
      
      <!-- Viral Posts Section -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          🔥 Viral Posts (Last 7 Days)
        </h2>
        <div class="space-y-4">
          {#each analytics.viralPosts.slice(0, 10) as post}
            <div class="border dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
              <div class="flex items-start justify-between mb-2">
                <div class="flex-1">
                  <div class="font-semibold text-gray-900 dark:text-white">
                    {post.display_name || post.handle}
                  </div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    @{post.handle}
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formatNumber(post.engagement_score)}
                  </div>
                  <div class="text-xs text-gray-600 dark:text-gray-400">
                    engagement
                  </div>
                </div>
              </div>
              <p class="text-gray-700 dark:text-gray-300 mb-3 line-clamp-3">
                {post.text}
              </p>
              <div class="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span>❤️ {formatNumber(post.like_count)}</span>
                <span>🔄 {formatNumber(post.repost_count)}</span>
                <span>💬 {formatNumber(post.reply_count)}</span>
                <span>📊 {formatEngagementRate(post.engagement_rate)} rate</span>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Engagement by Time and Tier -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        
        <!-- Posts by Hour -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            ⏰ Activity by Hour
          </h2>
          <div class="space-y-2">
            {#each analytics.postsByHour as hourData}
              {@const maxPosts = Math.max(...analytics.postsByHour.map((h: any) => h.post_count))}
              {@const widthPercent = (hourData.post_count / maxPosts) * 100}
              <div class="flex items-center gap-2">
                <div class="w-12 text-sm text-gray-600 dark:text-gray-400">
                  {hourData.hour}:00
                </div>
                <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 relative">
                  <div 
                    class="bg-blue-600 h-6 rounded-full transition-all"
                    style="width: {widthPercent}%"
                  ></div>
                  <span class="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white">
                    {formatNumber(hourData.post_count)} posts
                  </span>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Engagement by Follower Tier -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            👥 Engagement by Follower Tier
          </h2>
          <div class="space-y-4">
            {#each analytics.engagementByTier as tier}
              <div class="border dark:border-gray-700 rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-semibold text-gray-900 dark:text-white">
                    {tier.follower_tier} followers
                  </span>
                  <span class="text-sm text-gray-600 dark:text-gray-400">
                    {formatNumber(tier.user_count)} users
                  </span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600 dark:text-gray-400">
                    Avg: {formatNumber(tier.avg_engagement)}
                  </span>
                  <span class="text-blue-600 dark:text-blue-400 font-semibold">
                    Total: {formatNumber(tier.total_engagement)}
                  </span>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <!-- Most Active Users -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          ⚡ Most Active Users (Last 7 Days)
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {#each analytics.mostActiveUsers as user}
            <div class="border dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
              <div class="font-semibold text-gray-900 dark:text-white mb-1">
                {user.display_name || user.handle}
              </div>
              <div class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                @{user.handle}
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600 dark:text-gray-400">
                  📝 {user.posts_last_7_days} posts
                </span>
                <span class="text-blue-600 dark:text-blue-400">
                  ~{formatNumber(user.avg_engagement)} eng/post
                </span>
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-500 mt-2">
                {formatNumber(user.followers_count)} followers
              </div>
            </div>
          {/each}
        </div>
      </div>

    {/if}
  </div>
</div>
