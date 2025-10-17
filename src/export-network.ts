import 'dotenv/config';
import { supabase } from './supabase.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Export Network Data for Gephi/NetworkX
 * 
 * Exports nodes (users) and edges (follows) as CSV files
 * for network visualization and analysis
 */

interface User {
  did: string;
  handle: string;
  display_name: string | null;
  followers_count: number;
  following_count: number;
}

interface Follow {
  follower_did: string;
  following_did: string;
}

async function exportNetwork() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║            NETWORK DATA EXPORT                         ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Get engagement stats
  console.log('Loading user engagement stats...');
  const { data: engagementStats } = await supabase
    .from('user_engagement_stats')
    .select('*');

  const statsMap = new Map(
    engagementStats?.map(s => [s.did, s]) || []
  );

  // Export nodes (users)
  console.log('Exporting nodes (users)...');
  const users: User[] = [];
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('bluesky_users')
      .select('did, handle, display_name, followers_count, following_count')
      .range(offset, offset + batchSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    users.push(...data);
    offset += batchSize;

    if (offset % 10000 === 0) {
      console.log(`  Loaded ${offset.toLocaleString()} users...`);
    }
  }

  console.log(`✓ Loaded ${users.length.toLocaleString()} users\n`);

  // Build CSV for nodes
  console.log('Building nodes CSV...');
  const nodeRows: string[] = [];
  nodeRows.push('id,label,handle,followers,following,posts,likes_given,reposts_given,likes_received,reposts_received,replies_received,influence_score');

  for (const user of users) {
    const stats = statsMap.get(user.did);
    const influenceScore = 
      user.followers_count +
      (stats?.total_likes_received || 0) +
      (stats?.total_reposts_received || 0) * 2;

    nodeRows.push([
      user.did,
      `"${(user.display_name || user.handle).replace(/"/g, '""')}"`,
      user.handle,
      user.followers_count || 0,
      user.following_count || 0,
      stats?.post_count || 0,
      stats?.like_count || 0,
      stats?.repost_count || 0,
      stats?.total_likes_received || 0,
      stats?.total_reposts_received || 0,
      stats?.total_replies_received || 0,
      influenceScore
    ].join(','));
  }

  const nodesPath = join(process.cwd(), 'data', 'network_nodes.csv');
  writeFileSync(nodesPath, nodeRows.join('\n'));
  console.log(`✓ Nodes saved to: ${nodesPath}`);
  console.log(`  Total nodes: ${users.length.toLocaleString()}\n`);

  // Export edges (follows)
  console.log('Exporting edges (follows)...');
  const follows: Follow[] = [];
  offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('bluesky_follows')
      .select('follower_did, following_did')
      .range(offset, offset + batchSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    follows.push(...data);
    offset += batchSize;

    if (offset % 10000 === 0) {
      console.log(`  Loaded ${offset.toLocaleString()} follows...`);
    }
  }

  console.log(`✓ Loaded ${follows.length.toLocaleString()} follows\n`);

  // Build CSV for edges
  console.log('Building edges CSV...');
  const edgeRows: string[] = [];
  edgeRows.push('source,target,type');

  for (const follow of follows) {
    edgeRows.push([
      follow.follower_did,
      follow.following_did,
      'directed'
    ].join(','));
  }

  const edgesPath = join(process.cwd(), 'data', 'network_edges.csv');
  writeFileSync(edgesPath, edgeRows.join('\n'));
  console.log(`✓ Edges saved to: ${edgesPath}`);
  console.log(`  Total edges: ${follows.length.toLocaleString()}\n`);

  // Export handle mapping (for easier reading)
  console.log('Creating handle mapping...');
  const mappingRows: string[] = [];
  mappingRows.push('did,handle,display_name');

  for (const user of users) {
    mappingRows.push([
      user.did,
      user.handle,
      `"${(user.display_name || '').replace(/"/g, '""')}"`
    ].join(','));
  }

  const mappingPath = join(process.cwd(), 'data', 'handle_mapping.csv');
  writeFileSync(mappingPath, mappingRows.join('\n'));
  console.log(`✓ Handle mapping saved to: ${mappingPath}\n`);

  // Export mutual follows
  console.log('Finding mutual follows...');
  const mutualFollows: { did1: string; did2: string }[] = [];
  const followMap = new Map<string, Set<string>>();

  for (const follow of follows) {
    if (!followMap.has(follow.follower_did)) {
      followMap.set(follow.follower_did, new Set());
    }
    followMap.get(follow.follower_did)!.add(follow.following_did);
  }

  for (const follow of follows) {
    const reverseFollows = followMap.get(follow.following_did);
    if (reverseFollows?.has(follow.follower_did)) {
      // Mutual follow found - only add once (alphabetically sorted)
      if (follow.follower_did < follow.following_did) {
        mutualFollows.push({
          did1: follow.follower_did,
          did2: follow.following_did
        });
      }
    }
  }

  const mutualRows: string[] = [];
  mutualRows.push('user1,user2,type');

  for (const mutual of mutualFollows) {
    mutualRows.push([
      mutual.did1,
      mutual.did2,
      'mutual'
    ].join(','));
  }

  const mutualPath = join(process.cwd(), 'data', 'mutual_follows.csv');
  writeFileSync(mutualPath, mutualRows.join('\n'));
  console.log(`✓ Mutual follows saved to: ${mutualPath}`);
  console.log(`  Total mutual: ${mutualFollows.length.toLocaleString()}\n`);

  // Summary stats
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║                  EXPORT COMPLETE                       ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log('Network Statistics:');
  console.log('═════════════════════════════════════════════════════');
  console.log(`Nodes (Users):            ${users.length.toLocaleString()}`);
  console.log(`Edges (Follows):          ${follows.length.toLocaleString()}`);
  console.log(`Mutual Follows:           ${mutualFollows.length.toLocaleString()}`);
  console.log(`Avg Degree:               ${(follows.length / users.length * 2).toFixed(2)}`);
  console.log(`Reciprocity Rate:         ${(mutualFollows.length / follows.length * 100).toFixed(2)}%\n`);

  console.log('Files exported to data/:');
  console.log('  - network_nodes.csv     (user attributes)');
  console.log('  - network_edges.csv     (follow relationships)');
  console.log('  - mutual_follows.csv    (bidirectional follows)');
  console.log('  - handle_mapping.csv    (DID to handle lookup)\n');

  console.log('Next steps:');
  console.log('  1. Load network_nodes.csv and network_edges.csv into Gephi');
  console.log('  2. Run community detection (Modularity)');
  console.log('  3. Calculate PageRank/Betweenness centrality');
  console.log('  4. Visualize with ForceAtlas2 layout\n');
}

// Create data directory if it doesn't exist
import { mkdirSync } from 'fs';
try {
  mkdirSync(join(process.cwd(), 'data'), { recursive: true });
} catch (e) {
  // Directory exists
}

exportNetwork().catch(console.error);
