'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Database } from '@/lib/database.types';

type BlueskyUser = Database['public']['Tables']['bluesky_users']['Row'];

export function UserList() {
  const [users, setUsers] = useState<BlueskyUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<BlueskyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'following' | 'followers' | 'high_value' | 'influencers' | 'active' | 'mutual_potential'>('all');
  const [sortBy, setSortBy] = useState<'followers' | 'recent' | 'influence_ratio' | 'activity' | 'posts'>('followers');
  const [page, setPage] = useState(0);
  const [minFollowers, setMinFollowers] = useState(0);
  const [maxFollowers, setMaxFollowers] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    async function fetchUsers() {
      try {
        // Fetch all users by getting count first, then paginating
        const { count } = await supabase
          .from('bluesky_users')
          .select('*', { count: 'exact', head: true });

        const totalUsers = count || 0;
        const batchSize = 1000;
        const allUsers: BlueskyUser[] = [];

        // Fetch in batches of 1000
        for (let i = 0; i < totalUsers; i += batchSize) {
          const { data, error } = await supabase
            .from('bluesky_users')
            .select('*')
            .order('followers_count', { ascending: false })
            .range(i, i + batchSize - 1);

          if (error) throw error;
          if (data) allUsers.push(...data);
        }

        setUsers(allUsers);
        setFilteredUsers(allUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, []);

  useEffect(() => {
    let filtered = [...users];

    // Apply search filter
    if (search) {
      filtered = filtered.filter(
        (u) =>
          u.handle.toLowerCase().includes(search.toLowerCase()) ||
          u.display_name?.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply advanced filters
    if (filter === 'following') {
      filtered = filtered.filter((u) => u.viewer_following);
    } else if (filter === 'followers') {
      filtered = filtered.filter((u) => u.viewer_followed_by);
    } else if (filter === 'high_value') {
      // High follower/following ratio (influencers)
      filtered = filtered.filter((u) => {
        const ratio = (u.followers_count || 0) / Math.max(u.following_count || 1, 1);
        return (u.followers_count || 0) > 1000 && ratio > 5;
      });
    } else if (filter === 'influencers') {
      // Major influencers (>10K followers)
      filtered = filtered.filter((u) => (u.followers_count || 0) > 10000);
    } else if (filter === 'active') {
      // Active content creators (high posts count)
      filtered = filtered.filter((u) => (u.posts_count || 0) > 50);
    } else if (filter === 'mutual_potential') {
      // Users likely to follow back (follow many people)
      filtered = filtered.filter((u) => {
        const followingCount = u.following_count || 0;
        const followersCount = u.followers_count || 0;
        return followingCount > 500 && followersCount < 20000 && !u.viewer_following;
      });
    }
    
    // Apply follower range filters
    if (minFollowers > 0) {
      filtered = filtered.filter((u) => (u.followers_count || 0) >= minFollowers);
    }
    if (maxFollowers > 0) {
      filtered = filtered.filter((u) => (u.followers_count || 0) <= maxFollowers);
    }

    // Apply advanced sorting
    if (sortBy === 'followers') {
      filtered.sort((a, b) => (b.followers_count || 0) - (a.followers_count || 0));
    } else if (sortBy === 'recent') {
      filtered.sort((a, b) => new Date(b.indexed_at).getTime() - new Date(a.indexed_at).getTime());
    } else if (sortBy === 'influence_ratio') {
      filtered.sort((a, b) => {
        const ratioA = (a.followers_count || 0) / Math.max(a.following_count || 1, 1);
        const ratioB = (b.followers_count || 0) / Math.max(b.following_count || 1, 1);
        return ratioB - ratioA;
      });
    } else if (sortBy === 'activity' || sortBy === 'posts') {
      filtered.sort((a, b) => (b.posts_count || 0) - (a.posts_count || 0));
    }

    setFilteredUsers(filtered);
    setPage(0); // Reset to first page when filters change
  }, [search, filter, sortBy, minFollowers, maxFollowers, users]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm dark:border dark:border-zinc-800/50 p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100 mb-4">Users</h2>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse flex items-center space-x-4">
              <div className="h-12 w-12 bg-slate-200 dark:bg-zinc-800 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded w-1/4"></div>
                <div className="h-3 bg-slate-200 dark:bg-zinc-800 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const paginatedUsers = filteredUsers.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filteredUsers.length / pageSize);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm dark:border dark:border-zinc-800/50 overflow-hidden">
      <div className="p-6 border-b border-slate-200 dark:border-zinc-800">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100">
              Users Database ({filteredUsers.length.toLocaleString()} total)
            </h2>
          </div>
          
          {/* Advanced Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            {/* Search */}
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950/50 text-slate-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm"
              />
            </div>

            {/* Advanced Filter */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | 'following' | 'followers' | 'high_value' | 'influencers' | 'active' | 'mutual_potential')}
              className="px-3 py-2 border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950/50 text-slate-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm"
            >
              <option value="all">All Users</option>
              <option value="following">Following</option>
              <option value="followers">Followers</option>
              <option value="high_value">High Value (5x+ Ratio)</option>
              <option value="influencers">Influencers (10K+)</option>
              <option value="active">Active Creators (50+ Posts)</option>
              <option value="mutual_potential">Mutual Potential</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'followers' | 'recent' | 'influence_ratio' | 'activity' | 'posts')}
              className="px-3 py-2 border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950/50 text-slate-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm"
            >
              <option value="followers">Most Followers</option>
              <option value="recent">Recently Added</option>
              <option value="influence_ratio">Influence Ratio</option>
              <option value="posts">Most Active</option>
            </select>

            {/* Min Followers */}
            <input
              type="number"
              placeholder="Min followers"
              value={minFollowers || ''}
              onChange={(e) => setMinFollowers(parseInt(e.target.value) || 0)}
              className="px-3 py-2 border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950/50 text-slate-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm"
            />

            {/* Max Followers */}
            <input
              type="number"
              placeholder="Max followers"
              value={maxFollowers || ''}
              onChange={(e) => setMaxFollowers(parseInt(e.target.value) || 0)}
              className="px-3 py-2 border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950/50 text-slate-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm"
            />
          </div>
          
          {/* Active Filter Summary */}
          {(filter !== 'all' || minFollowers > 0 || maxFollowers > 0 || search) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-600">Active filters:</span>
              {filter !== 'all' && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {filter.replace('_', ' ')}
                  <button
                    onClick={() => setFilter('all')}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              )}
              {search && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  &ldquo;{search}&rdquo;
                  <button
                    onClick={() => setSearch('')}
                    className="ml-1 text-green-600 hover:text-green-800"
                  >
                    ×
                  </button>
                </span>
              )}
              {(minFollowers > 0 || maxFollowers > 0) && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  {minFollowers > 0 && `${minFollowers}+`}{minFollowers > 0 && maxFollowers > 0 && ' - '}{maxFollowers > 0 && `${maxFollowers}`} followers
                  <button
                    onClick={() => { setMinFollowers(0); setMaxFollowers(0); }}
                    className="ml-1 text-purple-600 hover:text-purple-800"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <p className="text-slate-500 dark:text-slate-400 text-center py-12">No users found</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-zinc-950/50 border-b border-slate-200 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                    Handle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                    Bio
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                    Followers
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                    Following
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                    Posts
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                    Influence Ratio
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-zinc-900 divide-y divide-slate-200 dark:divide-gray-700">
                {paginatedUsers.map((user) => (
                  <tr key={user.did} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {user.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user.handle}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                            {user.handle[0].toUpperCase()}
                          </div>
                        )}
                        <div className="ml-4">
                          <a
                            href={`https://bsky.app/profile/${user.handle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-slate-900 hover:text-blue-600"
                          >
                            {user.display_name || user.handle}
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <a
                        href={`https://bsky.app/profile/${user.handle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-slate-600 hover:text-blue-600"
                      >
                        @{user.handle}
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-600 max-w-xs truncate">
                        {user.description || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-900">
                      {(user.followers_count || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-900">
                      {(user.following_count || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-900">
                      {(user.posts_count || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {(() => {
                        const ratio = (user.followers_count || 0) / Math.max(user.following_count || 1, 1);
                        const ratioColor = ratio > 50 ? 'text-purple-600' : 
                                         ratio > 10 ? 'text-blue-600' : 
                                         ratio > 5 ? 'text-green-600' : 
                                         'text-slate-600';
                        return (
                          <div className={`text-sm font-medium ${ratioColor}`}>
                            {ratio.toFixed(1)}x
                            {ratio > 50 && (
                              <div className="text-xs text-purple-600">Mega</div>
                            )}
                            {ratio > 10 && ratio <= 50 && (
                              <div className="text-xs text-blue-600">High</div>
                            )}
                            {ratio > 5 && ratio <= 10 && (
                              <div className="text-xs text-green-600">Good</div>
                            )}
                          </div>
                        );
                      })()} 
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center space-x-1">
                        {user.viewer_following && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Following
                          </span>
                        )}
                        {user.viewer_followed_by && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                            Follower
                          </span>
                        )}
                        {!user.viewer_following && !user.viewer_followed_by && (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, filteredUsers.length)} of{' '}
                {filteredUsers.length.toLocaleString()} users
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
