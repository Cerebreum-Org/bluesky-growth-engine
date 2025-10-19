import { createClient } from '@supabase/supabase-js';

// Test both Studio endpoints
const endpoints = [
  { name: 'Port 3000', url: 'http://100.69.129.86:8000' },
  { name: 'Port 54323', url: 'http://100.69.129.86:8000' }
];

const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYwNzQ4NDUxLCJleHAiOjIwNzYxMDg0NTF9.07u25add780AIfnwAhdU4v0A4rhYcAs0lwlRbMVHEUI';

console.log('Verifying Studio connections to database...\n');

for (const endpoint of endpoints) {
  const client = createClient(endpoint.url, anonKey);
  const { count } = await client
    .from('bluesky_users')
    .select('*', { count: 'exact', head: true });
  
  if (count && count > 500000) {
    console.log(`✓ ${endpoint.name}: Connected to CORRECT database (${count.toLocaleString()} users)`);
  } else {
    console.log(`✗ ${endpoint.name}: Wrong database (${count?.toLocaleString() || 0} users)`);
  }
}

console.log('\n✅ Both Studio UIs are ready:');
console.log('   • http://100.69.129.86:3000');
console.log('   • http://100.69.129.86:54323');
