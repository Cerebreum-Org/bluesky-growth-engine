import pg from 'pg';
import { readFileSync } from 'fs';

const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres:postgres@100.69.129.86:5432/postgres'
});

async function setup() {
  try {
    await client.connect();
    console.log('✓ Connected to database');

    const sql = readFileSync('./supabase/schema_social_graph.sql', 'utf8');
    await client.query(sql);
    
    console.log('✓ Tables created: bluesky_posts, bluesky_likes, bluesky_reposts, user_engagement_stats');
    
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('✓ Tables already exist');
    } else {
      console.error('Error:', error.message);
      throw error;
    }
  } finally {
    await client.end();
  }
}

setup();
