<script lang="ts">
  import { onMount } from 'svelte';
  import NetworkGraph from '$lib/components/NetworkGraph.svelte';
  import StatsCards from '$lib/components/StatsCards.svelte';
  import GrowthChart from '$lib/components/GrowthChart.svelte';
  import TopUsers from '$lib/components/TopUsers.svelte';
import LiveStats from '$lib/components/LiveStats.svelte';

  let stats = $state<any>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const response = await fetch('/api/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      stats = await response.json();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      loading = false;
    }
  });
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
  <div class="container mx-auto px-4 py-8">
    <!-- Header -->
    <header class="mb-12 text-center">
      <div class="mt-4 flex justify-center gap-4">
        <a href="/analytics" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
          📊 Analytics Dashboard
        </a>
      </div>
      <h1 class="text-5xl font-bold text-gray-900 dark:text-white mb-4">
        🚀 Bluesky Growth Engine
      </h1>
      <p class="text-xl text-gray-600 dark:text-gray-300">
        Real-time social graph analysis and visualization
      </p>
    </header>

    {#if loading}
      <div class="flex items-center justify-center h-64">
        <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    {:else if error}
      <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p>Error: {error}</p>
      </div>
    {:else if stats}
      <!-- Live Stats -->
      <div class="mb-8">
        <LiveStats />
      </div>
      <!-- Stats Cards -->
      <StatsCards {stats} />

      <!-- Main Content Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        <!-- Network Graph -->
        <div class="lg:col-span-2">
          <NetworkGraph />
        </div>

        <!-- Growth Chart -->
        <div>
          <GrowthChart data={stats.growthData} />
        </div>

        <!-- Top Users -->
        <div>
          <TopUsers users={stats.topUsers} />
        </div>
      </div>

      <!-- Generation Stats -->
      <div class="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Users by Generation
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {#each stats.usersByGeneration as gen}
            <div class="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900 dark:to-pink-900 rounded-lg">
              <div class="text-3xl font-bold text-purple-600 dark:text-purple-300">
                {gen.count.toLocaleString()}
              </div>
              <div class="text-sm text-gray-600 dark:text-gray-400">
                Gen {gen.generation}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>
