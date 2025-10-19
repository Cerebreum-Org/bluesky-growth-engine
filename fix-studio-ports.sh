#!/bin/bash
set -e

echo "🔧 Fixing Studio ports to point to correct database..."

# Stop the wrong studio on 54323
echo "1. Stopping incorrect studio on port 54323..."
docker stop supabase_studio_bluesky-growth-engine 2>/dev/null || true

# Stop the old studio on 3001 so we can move it
echo "2. Stopping studio on port 3001..."
docker stop supabase-studio 2>/dev/null || true

# Start studio on both ports, connected to the correct database
echo "3. Starting studio on port 3000 (correct database)..."
docker rm -f supabase-studio-3000 2>/dev/null || true
docker run -d \
  --name supabase-studio-3000 \
  --network supabase_default \
  -p 3000:3000 \
  -e SUPABASE_URL=http://supabase-kong:8000 \
  -e SUPABASE_PUBLIC_URL=http://100.69.129.86:8000 \
  -e SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYwNzQ4NDUxLCJleHAiOjIwNzYxMDg0NTF9.07u25add780AIfnwAhdU4v0A4rhYcAs0lwlRbMVHEUI \
  -e SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NjA3NDg0NTEsImV4cCI6MjA3NjEwODQ1MX0.NRLERRynpuHgpR-_36FAid92fUlFrud3LFc8ClUA9S0 \
  -e STUDIO_PG_META_URL=http://supabase-meta:8080 \
  -e POSTGRES_PASSWORD=postgres \
  supabase/studio:latest

echo "4. Starting studio on port 54323 (correct database)..."
docker rm -f supabase-studio-54323 2>/dev/null || true
docker run -d \
  --name supabase-studio-54323 \
  --network supabase_default \
  -p 54323:3000 \
  -e SUPABASE_URL=http://supabase-kong:8000 \
  -e SUPABASE_PUBLIC_URL=http://100.69.129.86:8000 \
  -e SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYwNzQ4NDUxLCJleHAiOjIwNzYxMDg0NTF9.07u25add780AIfnwAhdU4v0A4rhYcAs0lwlRbMVHEUI \
  -e SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NjA3NDg0NTEsImV4cCI6MjA3NjEwODQ1MX0.NRLERRynpuHgpR-_36FAid92fUlFrud3LFc8ClUA9S0 \
  -e STUDIO_PG_META_URL=http://supabase-meta:8080 \
  -e POSTGRES_PASSWORD=postgres \
  supabase/studio:latest

echo ""
echo "✅ Studio is now available on both ports, connected to your 572k user database:"
echo "   • http://100.69.129.86:3000"
echo "   • http://100.69.129.86:54323"
echo ""
echo "Give it 10 seconds to start, then test with:"
echo "   curl -s http://100.69.129.86:3000 | grep -q studio && echo '✓ Port 3000 OK'"
echo "   curl -s http://100.69.129.86:54323 | grep -q studio && echo '✓ Port 54323 OK'"
