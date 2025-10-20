import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const JETSTREAM_SCRIPT = '/home/cerebreum/bluesky-growth-engine/src/jetstream-final.ts';
const PROJECT_DIR = '/home/cerebreum/bluesky-growth-engine';

async function getJetstreamStatus() {
  try {
    const { stdout } = await execAsync('ps aux | grep jetstream-final.ts | grep -v grep');
    const lines = stdout.trim().split('\n').filter(l => l.length > 0);
    
    if (lines.length > 0) {
      const match = lines[0].match(/^\S+\s+(\d+)/);
      const pid = match ? parseInt(match[1]) : null;
      return { running: true, pid, processCount: lines.length };
    }
    return { running: false, pid: null, processCount: 0 };
  } catch (error) {
    return { running: false, pid: null, processCount: 0 };
  }
}

export async function GET() {
  try {
    const status = await getJetstreamStatus();
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
      const status = await getJetstreamStatus();
      if (status.running) {
        return NextResponse.json({ error: 'already_running', status }, { status: 400 });
      }

      const command = `cd ${PROJECT_DIR} && nohup npm exec tsx ${JETSTREAM_SCRIPT} > /tmp/jetstream.log 2>&1 & echo $!`;
      const { stdout } = await execAsync(command);
      const pid = parseInt(stdout.trim());
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      const newStatus = await getJetstreamStatus();
      
      return NextResponse.json({ success: true, pid, status: newStatus }, { status: 200 });
    }

    if (action === 'stop') {
      const status = await getJetstreamStatus();
      if (!status.running) {
        return NextResponse.json({ error: 'not_running', status }, { status: 400 });
      }

      await execAsync(`pkill -f 'jetstream-final.ts'`);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      const newStatus = await getJetstreamStatus();
      
      return NextResponse.json({ success: true, status: newStatus }, { status: 200 });
    }

    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  } catch (e: any) {
    console.error('[jetstream API] Error:', e);
    return NextResponse.json({ error: e?.message || 'jetstream_control_error' }, { status: 500 });
  }
}