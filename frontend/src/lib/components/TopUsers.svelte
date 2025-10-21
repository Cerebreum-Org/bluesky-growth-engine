<script lang="ts">
  let { users } = $props<{ users: any[] }>();
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
  <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
    Top Users by Followers
  </h2>
  <div class="space-y-3">
    {#each users as user, i}
      <div class="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600 rounded-lg hover:shadow-md transition-shadow">
        <div class="flex items-center space-x-3">
          <div class="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
            {i + 1}
          </div>
          <div>
            <p class="font-semibold text-gray-900 dark:text-white">
              {user.displayName || user.handle}
            </p>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              @{user.handle}
            </p>
          </div>
        </div>
        <div class="text-right">
          <p class="font-bold text-blue-600 dark:text-blue-400">
            {user.followersCount?.toLocaleString() || 0}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            followers
          </p>
        </div>
      </div>
    {/each}
  </div>
</div>
