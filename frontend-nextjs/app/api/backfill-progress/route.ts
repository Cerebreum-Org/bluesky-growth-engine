import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function readLastLines(filePath: string, maxBytes = 256 * 1024, maxLines = 500): string[] {
  try {
    const stat = fs.statSync(filePath);
    const start = Math.max(0, stat.size - maxBytes);
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(stat.size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    fs.closeSync(fd);
    const lines = buf.toString('utf-8').split('\n');
    const trimmed = lines.filter(l => l.trim().length > 0);
    return trimmed.slice(-maxLines);
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const logPath = '/tmp/backfill-v2.log';

    // Recent log lines (efficient tail read)
    const recentLines = fs.existsSync(logPath)
      ? readLastLines(logPath, 256 * 1024, 200)
      : [];

    // Parse progress and stats from logs (fallback only)
    let indexedUsersFromLog = 0;
    // Try to read from checkpoint first
    const checkpoint = readCheckpoint();
    if (checkpoint) {
      indexedUsersFromLog = checkpoint.processedUsers;
    }

    const progressLines = recentLines.filter(line => line.includes('Indexed') && line.includes('user DIDs'));
    const lastProgressLine = progressLines[progressLines.length - 1];
    if (lastProgressLine) {
      const m = lastProgressLine.match(/Indexed ([\d,]+) user DIDs/);
      if (m) indexedUsersFromLog = parseInt(m[1].replace(/,/g, '')) || 0;
    }

    // Robust counts from DB (likes can be huge → use estimated)
    const nowIso = new Date().toISOString();
    const [usersTotal, usersWithPosts, postsTotal, likesTotal] = await Promise.all([
      supabase.from('bluesky_users').select('*', { count: 'exact' }).limit(1),
      supabase.from('bluesky_users').select('*', { count: 'exact' }).gt('posts_count', 0).limit(1),
      supabase.from('bluesky_posts').select('*', { count: 'exact' }).limit(1),
      supabase.from('bluesky_likes').select('*', { count: 'exact' }).limit(1),
    ]);

    const indexedUsers = Math.max(indexedUsersFromLog || 0, usersWithPosts.count || 0);
    const totalPosts = postsTotal.count ?? 0;
    const totalLikes = likesTotal.count ?? 0;

    // Build recent entries (tail of log)
    const recentEntries = recentLines.slice(-50).map(line => ({
      timestamp: nowIso,
      message: line,
    }));

    // Check if backfill process is actually running
    const { execSync } = require("child_process");
    let running = false;
    try {
      const stdout = execSync("ps aux | grep \"backfill-social-graph-v2.ts\" | grep -v grep || true", { encoding: "utf8" });
      running = stdout.trim().length > 0;
    } catch (e) {
      running = false;
    }

    // Calculate deltas from checkpoint if available
    const checkpointForDeltas = readCheckpoint();
    const newPosts = checkpointForDeltas ? (checkpointForDeltas.collectedPosts || 0) : 0;    const newLikes = checkpointForDeltas ? (checkpointForDeltas.collectedLikes || 0) : 0;    const newFollows = checkpointForDeltas ? (checkpointForDeltas.collectedFollows || 0) : 0;
    const newReposts = 0; // Reposts not tracked in checkpoint yet

    const response = NextResponse.json({
      running,
      indexedUsers,
      totalLikes,
      totalPosts,
      newPosts,
      newLikes,
      newFollows,
      newReposts,
      recentEntries,
      lastUpdate: nowIso,
    });
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");    response.headers.set("Pragma", "no-cache");    response.headers.set("Expires", "0");    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ running: false, error: message }, { status: 500 });
  }
}

// Also read checkpoint file if available
function readCheckpoint() {
  try {
    const checkpointPath = path.join(process.cwd(), '..', 'backfill-checkpoint.json');
    if (fs.existsSync(checkpointPath)) {
      const data = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'));
      return {
        processedUsers: data.processedUsers || 0,
        collectedPosts: data.collectedPosts || 0,
        collectedLikes: data.collectedLikes || 0,
        collectedFollows: data.collectedFollows || 0,
        updatedAt: data.updatedAt,
      };
    }
  } catch (e) {
    // Ignore
  }
  return null;
}
