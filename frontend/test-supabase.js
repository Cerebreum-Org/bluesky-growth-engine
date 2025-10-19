const { createClient } = require('@supabase/supabase-js');

// Manually test with the values
const supabaseUrl = 'http://100.69.129.86:8000';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYwNzQ4NDUxLCJleHAiOjIwNzYxMDg0NTF9.07u25add780AIfnwAhdU4v0A4rhYcAs0lwlRbMVHEUI';

console.log('Testing Supabase connection...');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseAnonKey.substring(0, 20) + '...');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  try {
    const { count, error } = await supabase
      .from('bluesky_users')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error:', error);
    } else {
      console.log('Success! User count:', count);
    }
  } catch (err) {
    console.error('Caught error:', err);
  }
}

test();
