# Supabase Setup

## Database Schema

Run `schema.sql` in your Supabase SQL Editor to create the `bluesky_users` table.

### Table Structure

#### Core Profile Fields
- `did` (PRIMARY KEY): Decentralized identifier for the user - **ensures no duplicates**
- `handle`: Bluesky handle (e.g., user.bsky.social)
- `display_name`: User's display name
- `description`: User bio/description
- `avatar`: Avatar URL
- `banner`: Banner image URL

#### Statistics
- `followers_count`: Number of followers
- `following_count`: Number of accounts following
- `posts_count`: Number of posts

#### Metadata
- `labels` (JSONB): Moderation labels applied to the account
- `associated` (JSONB): Verified associated data (e.g., verified domain links)
- `created_at`: When the user account was created

#### Viewer Relationships
These fields represent the relationship between your authenticated account and the collected user:
- `viewer_muted`: You've muted this user
- `viewer_blocked_by`: This user has blocked you
- `viewer_blocking`: You're blocking this user
- `viewer_following`: You're following this user
- `viewer_followed_by`: This user is following you

#### System Fields
- `indexed_at`: When we first indexed this user
- `updated_at`: Last time we updated this user's data

## Social Graph Relationships

In addition to user profiles, the system captures follower/following relationships in the `bluesky_follows` table:

- `follower_did` - The DID of the user who is following
- `following_did` - The DID of the user being followed
- `created_at` - When this relationship was first recorded
- `updated_at` - Last time this relationship was updated

The combination of `(follower_did, following_did)` is the PRIMARY KEY, ensuring no duplicate relationships.

### Example Queries

```sql
-- Get all users that @alice.bsky.social follows
SELECT u.* 
FROM bluesky_follows f
JOIN bluesky_users u ON f.following_did = u.did
WHERE f.follower_did = 'did:plc:alice123';

-- Get all followers of @bob.bsky.social
SELECT u.*
FROM bluesky_follows f
JOIN bluesky_users u ON f.follower_did = u.did
WHERE f.following_did = 'did:plc:bob456';

-- Find mutual follows (users who follow each other)
SELECT u1.handle as user1, u2.handle as user2
FROM bluesky_follows f1
JOIN bluesky_follows f2 
  ON f1.follower_did = f2.following_did 
  AND f1.following_did = f2.follower_did
JOIN bluesky_users u1 ON f1.follower_did = u1.did
JOIN bluesky_users u2 ON f1.following_did = u2.did;
```

## Setup Steps

### Initial Setup

1. Create a Supabase project at https://supabase.com
2. Copy your project URL and anon key
3. Add them to `.env`:
   ```
   SUPABASE_URL=your-project-url
   SUPABASE_KEY=your-anon-key
   ```
4. Run the SQL in `schema.sql` in your Supabase SQL Editor

### Migration for Existing Databases

If you already have the `bluesky_users` table:

1. Run `migration_add_profile_fields.sql` to add the new profile fields (banner, labels, etc.)
2. Run `migration_add_follows_table.sql` to create the `bluesky_follows` table for relationship tracking

## Duplicate Prevention

Duplicates are prevented in three ways:

1. **Database PRIMARY KEY constraint** on `did` - PostgreSQL enforces uniqueness at the database level
2. **Supabase upsert operation** - Code uses `.upsert()` with `onConflict: 'did'` to update existing records instead of creating duplicates
3. **In-memory deduplication** - Each collection strategy tracks processed DIDs in a Set to avoid redundant API calls and database operations

This triple-layer approach ensures:
- No duplicate users in your database
- Efficient updates to existing user data
- Minimal redundant API calls to Bluesky

## Complete Data Capture

The system captures **all available profile data** from Bluesky's AT Protocol:

### User Profiles
- All core profile fields (handle, name, bio, avatar, banner)
- All statistics (followers, following, posts)
- Moderation labels
- Verified associated data
- Complete viewer relationship status
- Account creation timestamps

### Social Graph Relationships
- Follower → Following relationships (who follows whom)
- Bidirectional tracking for network analysis
- Automatic deduplication of relationships
- Timestamps for relationship discovery

When a user is collected multiple times, their data is automatically updated with the latest information from Bluesky. Relationships are stored separately and preserved even if profiles are updated
