import pg from 'pg';
import { readFileSync } from 'fs';

const { Client } = pg;

const client = new Client({
  host: '100.69.129.86',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres',
});

async function setup() {
  try {
    await client.connect();
    console.log('✓ Connected to database');

    const sql = readFileSync('./supabase/schema_social_graph.sql', 'utf8');
    
    console.log('Creating tables...');
    await client.query(sql);
    
    console.log('✓ Tables created: bluesky_posts, bluesky_likes, bluesky_reposts');
    
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('✓ Tables already exist');
    } else {
      console.error('Error:', error.message);
    }
  } finally {
    await client.end();
  }
}

setup();
