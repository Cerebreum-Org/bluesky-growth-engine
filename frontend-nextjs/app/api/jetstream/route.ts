import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function getCollectorStatus() {
  try {
    // Check if the Docker collector is running
    const { stdout } = await execAsync('docker ps --filter "name=bluesky-collector" --format "{{.Names}}\t{{.Status}}"');
    const lines = stdout.trim().split('\n').filter(l => l.length > 0);
    
    if (lines.length > 0 && lines[0].includes('bluesky-collector')) {
      const status = lines[0].split('\t')[1];
      const isHealthy = status.includes('healthy');
      return { 
        running: true, 
        container: 'bluesky-collector', 
        status,
        healthy: isHealthy
      };
    }
    return { running: false, container: null, status: 'stopped', healthy: false };
  } catch (error) {
    return { running: false, container: null, status: 'error', healthy: false };
  }
}

export async function GET() {
  try {
    const status = await getCollectorStatus();
    return NextResponse.json(status, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'status_check_failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'start') {
      const status = await getCollectorStatus();
      if (status.running) {
        return NextResponse.json({ error: 'already_running', status }, { status: 400 });
      }

      await execAsync('docker start bluesky-collector');
      await new Promise(resolve => setTimeout(resolve, 2000));
      const newStatus = await getCollectorStatus();
      
      return NextResponse.json({ success: true, status: newStatus }, { status: 200 });
    }

    if (action === 'stop') {
      const status = await getCollectorStatus();
      if (!status.running) {
        return NextResponse.json({ error: 'not_running', status }, { status: 400 });
      }

      await execAsync('docker stop bluesky-collector');
      await new Promise(resolve => setTimeout(resolve, 2000));
      const newStatus = await getCollectorStatus();
      
      return NextResponse.json({ success: true, status: newStatus }, { status: 200 });
    }

    if (action === 'restart') {
      await execAsync('docker restart bluesky-collector');
      await new Promise(resolve => setTimeout(resolve, 2000));
      const newStatus = await getCollectorStatus();
      
      return NextResponse.json({ success: true, status: newStatus }, { status: 200 });
    }

    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  } catch (e: any) {
    console.error('[jetstream API] Error:', e);
    return NextResponse.json({ error: e?.message || 'jetstream_control_error' }, { status: 500 });
  }
}
