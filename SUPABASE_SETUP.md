# Supabase Compatibility & Setup Guide

## TL;DR - Yes, Everything Works Great with Supabase! ✅

This codebase is fully compatible with Supabase. All features leverage standard PostgreSQL features that Supabase fully supports:
- ✅ Primary key constraints (single and composite)
- ✅ Foreign key constraints with CASCADE deletes
- ✅ JSONB fields for complex data
- ✅ Database triggers for auto-updating timestamps
- ✅ Upsert operations with conflict resolution
- ✅ Efficient indexing for queries

## Quick Setup Checklist

### 1. Create Your Supabase Project
- Go to [supabase.com](https://supabase.com) and create a new project
- Copy your project URL and anon key from Settings → API

### 2. Configure Environment
Add to your `.env`:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
```

### 3. Run Database Schema
In your Supabase SQL Editor, run:
- **For new setup:** Copy and run `supabase/schema.sql`
- **For existing tables:** Run migrations in order:
  1. `supabase/migration_add_profile_fields.sql`
  2. `supabase/migration_add_follows_table.sql`

### 4. Test Your Setup
```bash
npm run test:supabase
```

This will verify:
- Connection to Supabase
- User table operations (insert, upsert, JSONB)
- Relationship table operations (composite keys)
- Foreign key constraints
- All data types work correctly

## Supabase-Specific Features Used

### 1. Composite Primary Keys ✅
```sql
PRIMARY KEY (follower_did, following_did)
```
Supabase fully supports composite primary keys. Our relationship table uses this to ensure no duplicate follower→following pairs.

**In code:**
```typescript
await supabase
  .from('bluesky_follows')
  .upsert(follow, { onConflict: 'follower_did,following_did' });
```

### 2. Foreign Key Constraints ✅
```sql
follower_did TEXT NOT NULL REFERENCES bluesky_users(did) ON DELETE CASCADE
```
PostgreSQL foreign keys work perfectly in Supabase. The `ON DELETE CASCADE` ensures cleanup when users are deleted.

**Benefit:** The database enforces data integrity automatically. You can't create a relationship for a user that doesn't exist.

### 3. JSONB Fields ✅
```sql
labels JSONB
associated JSONB
```
Supabase fully supports PostgreSQL's JSONB type for storing complex nested data.

**Benefit:** Store moderation labels and verified link data without creating separate tables.

### 4. Database Triggers ✅
```sql
CREATE TRIGGER update_bluesky_users_updated_at
  BEFORE UPDATE ON bluesky_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```
Supabase supports PostgreSQL triggers. This auto-updates `updated_at` timestamps.

**Benefit:** Never manually track when records were modified.

### 5. Upsert Operations ✅
```typescript
await supabase
  .from('bluesky_users')
  .upsert(user, { onConflict: 'did' });
```
Supabase's JS client supports PostgreSQL's upsert (INSERT ... ON CONFLICT).

**Benefit:** Idempotent operations - running the same collection twice won't create duplicates.

## Potential Issues & Solutions

### Issue 1: Foreign Key Violation
**Error:** `insert or update on table "bluesky_follows" violates foreign key constraint`

**Cause:** Trying to create a relationship before both users exist in the database.

**Solution:** Our code handles this correctly by:
1. Saving users first with `await saveUser()`
2. Then saving relationships with `await saveRelationship()`
3. Catching and logging any relationship errors gracefully

### Issue 2: Composite Key Upsert Syntax
**Concern:** Does `onConflict: 'follower_did,following_did'` work?

**Answer:** Yes! In Supabase JS v2.x, you can pass column names as a comma-separated string for composite keys.

### Issue 3: JSONB Field Insert
**Concern:** Can we store JavaScript objects directly?

**Answer:** Yes! Supabase automatically serializes objects to JSONB:
```typescript
labels: { test: 'value' }  // Works perfectly
```

### Issue 4: Rate Limits
**Concern:** Will Supabase rate limit large crawls?

**Answer:** Supabase free tier has generous limits:
- 2GB database
- 50,000 monthly active users
- 500MB egress
- 2GB file storage

For large crawls (100k+ users), consider:
- Paid tier for higher limits
- Rate limiting in code (we have `rateLimitDelay` option)
- Running crawls during off-peak hours

## Performance Optimization

### 1. Indexes Are Created Automatically ✅
Our schema includes indexes on commonly queried fields:
```sql
CREATE INDEX idx_bluesky_users_handle ON bluesky_users(handle);
CREATE INDEX idx_bluesky_users_followers ON bluesky_users(followers_count DESC);
CREATE INDEX idx_bluesky_follows_follower ON bluesky_follows(follower_did);
```

### 2. Batch Operations
Supabase supports batch inserts, but our upsert approach with individual records works better for:
- Handling partial failures gracefully
- Deduplication tracking
- Progress logging

### 3. Connection Pooling
Supabase automatically handles connection pooling. No configuration needed!

## Testing Your Setup

Run the test suite:
```bash
npm run test:supabase
```

Expected output:
```
Testing Supabase connection and schema...

1. Testing connection...
✅ Connected to Supabase

2. Testing user insert...
✅ User insert successful

3. Testing relationship insert...
✅ Relationship insert successful

4. Testing foreign key constraint...
✅ Foreign key constraint working correctly

5. Testing JSONB fields...
✅ JSONB fields working: {
  "did": "did:plc:test123",
  "labels": { "test": "value" },
  "associated": { "verified": true }
}

6. Cleaning up test data...
✅ Cleanup complete

🎉 All tests passed! Supabase setup is working correctly.
```

## Common Queries

### Get a user's followers
```sql
SELECT u.*
FROM bluesky_follows f
JOIN bluesky_users u ON f.follower_did = u.did
WHERE f.following_did = 'did:plc:...'
ORDER BY u.followers_count DESC;
```

### Get who someone follows
```sql
SELECT u.*
FROM bluesky_follows f
JOIN bluesky_users u ON f.following_did = u.did
WHERE f.follower_did = 'did:plc:...'
ORDER BY u.followers_count DESC;
```

### Find users with JSONB filtering
```sql
SELECT * FROM bluesky_users
WHERE labels ? 'some_label'  -- Check if key exists
OR associated->>'verified' = 'true';  -- Extract and compare
```

## Production Considerations

### 1. Database Backups
Supabase projects include:
- Point-in-time recovery (paid plans)
- Daily backups (all plans)
- Manual backup via SQL dump

### 2. Monitoring
Use Supabase Dashboard to monitor:
- Database size
- API requests
- Active connections
- Query performance

### 3. Scaling
If you collect millions of users:
- Consider partitioning large tables
- Upgrade to paid tier for better performance
- Use Supabase's connection pooler (Supavisor)

## Summary

**Everything works perfectly with Supabase!** The codebase uses standard PostgreSQL features that Supabase fully supports. No compatibility issues, no workarounds needed.

Run `npm run test:supabase` to verify your setup works correctly before starting collection.
