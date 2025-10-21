<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  
  let liveCount = $state(0);
  let lastUpdate = $state<Date | null>(null);
  let isConnected = $state(false);
  
  // Simulated real-time updates (polling every 30 seconds)
  let interval: number;
  
  async function fetchLatestCount() {
    try {
      const response = await fetch('/api/stats');
      if (response.ok) {
        const data = await response.json();
        liveCount = data.totalUsers;
        lastUpdate = new Date();
        isConnected = true;
      }
    } catch (error) {
      console.error('Failed to fetch live stats:', error);
      isConnected = false;
    }
  }
  
  onMount(() => {
    fetchLatestCount();
    interval = window.setInterval(fetchLatestCount, 30000); // Update every 30s
  });
  
  onDestroy(() => {
    if (interval) clearInterval(interval);
  });
</script>

<div class="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4 text-white shadow-lg">
  <div class="flex items-center justify-between">
    <div>
      <div class="text-sm opacity-80 mb-1">Live User Count</div>
      <div class="text-3xl font-bold">{liveCount.toLocaleString()}</div>
      {#if lastUpdate}
        <div class="text-xs opacity-70 mt-1">
          Updated: {lastUpdate.toLocaleTimeString()}
        </div>
      {/if}
    </div>
    <div class="flex flex-col items-center">
      <div class="relative">
        <div class="w-3 h-3 rounded-full {isConnected ? 'bg-green-400' : 'bg-red-400'}"></div>
        {#if isConnected}
          <div class="absolute inset-0 w-3 h-3 rounded-full bg-green-400 animate-ping"></div>
        {/if}
      </div>
      <div class="text-xs mt-1">{isConnected ? 'Live' : 'Offline'}</div>
    </div>
  </div>
</div>
