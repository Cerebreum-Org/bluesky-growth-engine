import { NextResponse, NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const TARGET_BASE = 'http://100.69.129.86:8000';

async function proxy(request: Request, method: string, path: string[]) {
  try {
    const inUrl = new URL(request.url);
    const dest = `${TARGET_BASE}/${path.join('/')}${inUrl.search}`;

    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('connection');
    headers.delete('content-length');

    const body = (method !== 'GET' && method !== 'HEAD') ? await request.arrayBuffer() : undefined;
    const init: RequestInit = { method, headers, body: body as BodyInit | undefined };

    const res = await fetch(dest, init);
    const outHeaders = new Headers(res.headers);
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: outHeaders,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'proxy_error', message }, { status: 502 });
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, 'GET', path || []);
}
export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, 'POST', path || []);
}
export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, 'PUT', path || []);
}
export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, 'PATCH', path || []);
}
export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, 'DELETE', path || []);
}
export async function OPTIONS(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, 'OPTIONS', path || []);
}
