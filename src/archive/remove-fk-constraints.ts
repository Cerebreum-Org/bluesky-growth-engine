import 'dotenv/config';
import pkg from 'pg';
const { Client } = pkg;

async function removeFKs() {
  const client = new Client({
    host: '100.69.129.86',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'postgres'
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');
    console.log('🔧 Removing foreign key constraints...\n');
    
    const constraints = [
      'bluesky_posts_author_did_fkey',
      'bluesky_reposts_subject_uri_fkey',
      'bluesky_reposts_author_did_fkey',
      'bluesky_likes_subject_uri_fkey',
      'bluesky_likes_author_did_fkey'
    ];
    
    for (const constraint of constraints) {
      const table = constraint.split('_')[1]; // posts, reposts, likes
      try {
        await client.query(`ALTER TABLE bluesky_${table} DROP CONSTRAINT IF EXISTS ${constraint}`);
        console.log(`  ✓ Dropped ${constraint}`);
      } catch (err: any) {
        console.log(`  ⚠️  ${constraint}: ${err.message}`);
      }
    }
    
    console.log('\n✅ Done! Foreign key constraints removed');
    console.log('💡 Jetstream can now insert data without validation');
    
    await client.end();
  } catch (error: any) {
    console.error('❌ Connection error:', error.message);
    console.log('\n💡 Try checking if PostgreSQL is accessible on port 5432');
    process.exit(1);
  }
  
  process.exit(0);
}

removeFKs();
