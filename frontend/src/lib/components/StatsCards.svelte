<script lang="ts">
  let { stats } = $props<{ stats: any }>();
</script>

<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
  <!-- Total Users Card -->
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 transform hover:scale-105 transition-transform">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          Total Users
        </p>
        <p class="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">
          {stats.totalUsers.toLocaleString()}
        </p>
      </div>
      <div class="text-4xl">👥</div>
    </div>
  </div>

  <!-- Total Follows Card -->
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 transform hover:scale-105 transition-transform">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          Total Follows
        </p>
        <p class="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
          {stats.totalFollows.toLocaleString()}
        </p>
      </div>
      <div class="text-4xl">🔗</div>
    </div>
  </div>

  <!-- Total Posts Card -->
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 transform hover:scale-105 transition-transform">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          Total Posts
        </p>
        <p class="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-2">
          {stats.totalPosts.toLocaleString()}
        </p>
      </div>
      <div class="text-4xl">📝</div>
    </div>
  </div>
</div>
