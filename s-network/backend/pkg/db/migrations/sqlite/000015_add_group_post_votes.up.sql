-- Add vote columns to group_posts table
ALTER TABLE group_posts ADD COLUMN upvotes INTEGER DEFAULT 0;
ALTER TABLE group_posts ADD COLUMN downvotes INTEGER DEFAULT 0;

-- Drop the old likes system
DROP TABLE IF EXISTS group_post_likes;

-- Remove likes_count column (we'll use upvotes/downvotes instead)
-- SQLite doesn't support DROP COLUMN directly, so we'll migrate data later if needed 