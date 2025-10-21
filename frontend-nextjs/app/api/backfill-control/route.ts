// Updated: 2025-10-20 v2
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

async function getProcessInfo() {
  try {
    const { stdout } = await execAsync('ps aux | grep "backfill-social-graph-v2.ts" | grep -v grep');
    const lines = stdout.trim().split('\n').filter(line => line.length > 0);
    if (lines.length > 0) {
      const parts = lines[0].split(/\s+/);
      return { pid: parts[1], running: true };
    }
    return { pid: null, running: false };
  } catch {
    return { pid: null, running: false };
  }
}

export async function GET() {
  const info = await getProcessInfo();
  return NextResponse.json({ running: info.running, pid: info.pid });
}

export async function POST(request: Request) {
  const { action } = await request.json();
  
  if (action === 'start') {
    const info = await getProcessInfo();
    if (info.running) {
      return NextResponse.json({ success: false, message: 'Already running', pid: info.pid });
    }
    
    try {
      exec('cd .. && nohup npm run backfill:v2 >> backfill-v2.log 2>&1 &');
      await new Promise(resolve => setTimeout(resolve, 1500));
      const newInfo = await getProcessInfo();
      return NextResponse.json({ success: true, message: 'Started', pid: newInfo.pid });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ success: false, message }, { status: 500 });
    }
  }
  
  if (action === 'stop') {
    try {
      await execAsync('pkill -f "backfill-social-graph"');
      return NextResponse.json({ success: true, message: 'Stopped' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ success: false, message }, { status: 500 });
    }
  }
  
  return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
}