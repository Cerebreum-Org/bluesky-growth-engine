import { pgTable, text, integer, boolean, jsonb, timestamp, primaryKey, index } from 'drizzle-orm/pg-core';

export const blueskyUsers = pgTable('bluesky_users', {
  did: text('did').primaryKey(),
  handle: text('handle').notNull(),
  displayName: text('display_name'),
  description: text('description'),
  avatar: text('avatar'),
  banner: text('banner'),
  followersCount: integer('followers_count'),
  followingCount: integer('following_count'),
  postsCount: integer('posts_count'),
  labels: jsonb('labels'),
  associated: jsonb('associated'),
  viewerMuted: boolean('viewer_muted'),
  viewerBlockedBy: boolean('viewer_blocked_by'),
  viewerBlocking: boolean('viewer_blocking'),
  viewerFollowing: boolean('viewer_following'),
  viewerFollowedBy: boolean('viewer_followed_by'),
  createdAt: timestamp('created_at', { withTimezone: true }),
  indexedAt: timestamp('indexed_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  generation: integer('generation').default(0)
}, (table) => ({
  handleIdx: index('idx_bluesky_users_handle').on(table.handle),
  followersIdx: index('idx_bluesky_users_followers').on(table.followersCount),
  generationIdx: index('idx_bluesky_users_generation').on(table.generation)
}));

export const blueskyFollows = pgTable('bluesky_follows', {
  followerDid: text('follower_did').notNull().references(() => blueskyUsers.did, { onDelete: 'cascade' }),
  followingDid: text('following_did').notNull().references(() => blueskyUsers.did, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  pk: primaryKey({ columns: [table.followerDid, table.followingDid] }),
  followerIdx: index('idx_bluesky_follows_follower').on(table.followerDid),
  followingIdx: index('idx_bluesky_follows_following').on(table.followingDid)
}));

export const blueskyPosts = pgTable('bluesky_posts', {
  uri: text('uri').primaryKey(),
  cid: text('cid').notNull(),
  authorDid: text('author_did').notNull().references(() => blueskyUsers.did, { onDelete: 'cascade' }),
  text: text('text'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  likeCount: integer('like_count').default(0),
  repostCount: integer('repost_count').default(0),
  replyCount: integer('reply_count').default(0),
  quoteCount: integer('quote_count').default(0),
  indexedAt: timestamp('indexed_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  authorIdx: index('idx_posts_author').on(table.authorDid),
  createdAtIdx: index('idx_posts_created_at').on(table.createdAt)
}));
