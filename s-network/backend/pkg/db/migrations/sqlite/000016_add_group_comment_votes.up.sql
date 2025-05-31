-- Add vote columns to group_post_comments table
ALTER TABLE group_post_comments ADD COLUMN vote_count INTEGER DEFAULT 0;
ALTER TABLE group_post_comments ADD COLUMN upvotes INTEGER DEFAULT 0;
ALTER TABLE group_post_comments ADD COLUMN downvotes INTEGER DEFAULT 0; 