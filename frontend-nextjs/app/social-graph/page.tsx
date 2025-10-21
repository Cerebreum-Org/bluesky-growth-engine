'use client';

import { useEffect, useState } from 'react';
import { DashboardHeader } from '@/components/DashboardHeader';

interface SocialGraphData {
  counts: {
    blocks: number;
    lists: number;
    listItems: number;
  };
  recent: {
    blocks: Array<{
      author_did: string;
      subject_did: string;
      created_at: string;
    }>;
    lists: Array<{
      uri: string;
      author_did: string;
      name: string;
      purpose: string;
      description?: string;
      created_at: string;
    }>;
    listItems: Array<{
      uri: string;
      author_did: string;
      subject_did: string;
      list_uri: string;
      created_at: string;
    }>;
  };
  timestamp: string;
}

interface BlockAnalytics {
  totalBlocks: number;
  topBlockers: Array<{
    blocker_did: string;
    block_count: number;
    handle?: string;
  }>;
  topBlocked: Array<{
    blocked_did: string;
    blocked_count: number;
    handle?: string;
  }>;
  blocksOverTime: Array<{
    date: string;
    count: number;
  }>;
}

export default function SocialGraphPage() {
  const [data, setData] = useState<SocialGraphData | null>(null);
  const [blockAnalytics, setBlockAnalytics] = useState<BlockAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'blocks' | 'lists' | 'moderation'>('overview');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [socialResponse, blockResponse] = await Promise.all([
          fetch('/api/social-graph', { cache: 'no-store' }),
          fetch('/api/block-analytics', { cache: 'no-store' })
        ]);
        
        const socialData = await socialResponse.json();
        setData(socialData);
        
        if (blockResponse.ok) {
          const blockData = await blockResponse.json();
          setBlockAnalytics(blockData);
        }
      } catch (error) {
        console.error('Failed to fetch social graph data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <DashboardHeader />
        <div className="p-6">
          <div className="animate-pulse flex items-center space-x-2">
            <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
            <div className="text-gray-600">Loading social graph analytics...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <DashboardHeader />
      
      <div className="p-6 space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              🕸️ Social Graph Analytics
              <span className="text-sm font-normal text-gray-500 bg-green-100 dark:bg-green-900 px-2 py-1 rounded-full">
                Live
              </span>
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Real-time analysis of social relationships, moderation patterns, and community structure
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="px-6 py-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex space-x-1">
              {[
                { key: 'overview', label: '📊 Overview', icon: '📊' },
                { key: 'blocks', label: '🚫 Blocks', icon: '🚫' },
                { key: 'lists', label: '📋 Lists', icon: '📋' },
                { key: 'moderation', label: '🛡️ Moderation', icon: '🛡️' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-lg p-6 border border-red-200 dark:border-red-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-red-600 dark:text-red-400 text-sm font-medium">Total Blocks</p>
                        <p className="text-red-900 dark:text-red-100 text-3xl font-bold">
                          {data?.counts.blocks.toLocaleString() || 0}
                        </p>
                        <p className="text-red-700 dark:text-red-300 text-xs mt-1">
                          Moderation actions
                        </p>
                      </div>
                      <div className="text-red-500 text-5xl opacity-80">🚫</div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-600 dark:text-blue-400 text-sm font-medium">Active Lists</p>
                        <p className="text-blue-900 dark:text-blue-100 text-3xl font-bold">
                          {data?.counts.lists.toLocaleString() || 0}
                        </p>
                        <p className="text-blue-700 dark:text-blue-300 text-xs mt-1">
                          Community curation
                        </p>
                      </div>
                      <div className="text-blue-500 text-5xl opacity-80">📋</div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-600 dark:text-green-400 text-sm font-medium">List Memberships</p>
                        <p className="text-green-900 dark:text-green-100 text-3xl font-bold">
                          {data?.counts.listItems.toLocaleString() || 0}
                        </p>
                        <p className="text-green-700 dark:text-green-300 text-xs mt-1">
                          Social connections
                        </p>
                      </div>
                      <div className="text-green-500 text-5xl opacity-80">👥</div>
                    </div>
                  </div>
                </div>

                {/* Real-time Activity Feed */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    ⚡ Real-time Social Activity
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  </h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {data?.recent.blocks.slice(0, 10).map((block, index) => (
                      <div key={`block-${index}`} className="bg-white dark:bg-gray-600 rounded-lg p-4 border-l-4 border-red-500">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">🚫</span>
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">Block Action</div>
                              <div className="text-xs text-gray-600 dark:text-gray-300">
                                <span className="font-mono bg-gray-100 dark:bg-gray-500 px-2 py-1 rounded">
                                  {block.author_did.slice(8, 20)}...
                                </span>
                                <span className="mx-2">→</span>
                                <span className="font-mono bg-gray-100 dark:bg-gray-500 px-2 py-1 rounded">
                                  {block.subject_did.slice(8, 20)}...
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTimeAgo(block.created_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {data?.recent.lists.slice(0, 5).map((list, index) => (
                      <div key={`list-${index}`} className="bg-white dark:bg-gray-600 rounded-lg p-4 border-l-4 border-blue-500">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">📋</span>
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                New List: {list.name || 'Untitled'}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-300">
                                Purpose: {list.purpose || 'General'} 
                                {list.description && <span> • {list.description.slice(0, 50)}...</span>}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTimeAgo(list.created_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {(!data?.recent.blocks.length && !data?.recent.lists.length) && (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <div className="text-4xl mb-2">🌊</div>
                        <div>Waiting for social activity...</div>
                        <div className="text-sm mt-1">New blocks, lists, and memberships will appear here</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Blocks Tab */}
            {activeTab === 'blocks' && (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">🚫</div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Block Analysis
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Analyzing {data?.counts.blocks} blocking relationships
                  </p>
                  
                  {data?.recent.blocks.length ? (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 max-w-4xl mx-auto">
                      <h4 className="font-semibold mb-4">Recent Blocking Activity</h4>
                      <div className="space-y-3">
                        {data.recent.blocks.slice(0, 20).map((block, index) => (
                          <div key={index} className="bg-white dark:bg-gray-600 rounded p-3 text-sm flex justify-between items-center">
                            <div className="font-mono text-xs">
                              <span className="text-red-600 dark:text-red-400">
                                {block.author_did.slice(8, 24)}...
                              </span>
                              <span className="mx-3 text-gray-500">blocked</span>
                              <span className="text-blue-600 dark:text-blue-400">
                                {block.subject_did.slice(8, 24)}...
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatTimeAgo(block.created_at)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-500 dark:text-gray-400">
                      No recent blocking activity in the last hour
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Lists Tab */}
            {activeTab === 'lists' && (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">📋</div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Community Lists
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Tracking {data?.counts.lists} active lists and {data?.counts.listItems} memberships
                  </p>
                  
                  {data?.recent.lists.length ? (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 max-w-4xl mx-auto">
                      <h4 className="font-semibold mb-4">Recently Created Lists</h4>
                      <div className="grid gap-4">
                        {data.recent.lists.map((list, index) => (
                          <div key={index} className="bg-white dark:bg-gray-600 rounded-lg p-4 text-left">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h5 className="font-semibold text-gray-900 dark:text-white">
                                  {list.name || 'Untitled List'}
                                </h5>
                                <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                                  <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-xs">
                                    {list.purpose}
                                  </span>
                                </div>
                                {list.description && (
                                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                                    {list.description}
                                  </p>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
                                <div>{formatTimeAgo(list.created_at)}</div>
                                <div className="font-mono text-xs mt-1">
                                  {list.author_did.slice(8, 20)}...
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-500 dark:text-gray-400">
                      No recent list activity in the last hour
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Moderation Tab */}
            {activeTab === 'moderation' && (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">🛡️</div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Moderation Insights
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Network health and community self-moderation patterns
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                    <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-lg p-6">
                      <h4 className="font-semibold text-red-900 dark:text-red-100 mb-3">Blocking Activity</h4>
                      <div className="text-3xl font-bold text-red-700 dark:text-red-300 mb-2">
                        {data?.counts.blocks}
                      </div>
                      <p className="text-red-600 dark:text-red-400 text-sm">
                        Total moderation actions by users
                      </p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-6">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">Curation Lists</h4>
                      <div className="text-3xl font-bold text-blue-700 dark:text-blue-300 mb-2">
                        {data?.counts.lists}
                      </div>
                      <p className="text-blue-600 dark:text-blue-400 text-sm">
                        Community-driven content lists
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 max-w-2xl mx-auto mt-8">
                    <h4 className="font-semibold mb-4">Moderation Health Score</h4>
                    <div className="flex items-center justify-center space-x-4">
                      <div className="text-4xl">📊</div>
                      <div>
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          Healthy
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Active community self-moderation
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 rounded-b-lg">
            <div className="flex items-center justify-between text-sm">
              <div className="text-gray-600 dark:text-gray-400">
                Last updated: {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : 'Never'}
              </div>
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Live data from comprehensive collector</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
