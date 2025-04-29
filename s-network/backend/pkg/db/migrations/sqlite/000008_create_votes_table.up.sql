CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content_id INTEGER NOT NULL,
    content_type TEXT NOT NULL, -- 'post' or 'comment'
    vote_type INTEGER NOT NULL, -- 1 for upvote, -1 for downvote
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, content_id, content_type) -- Ensure a user can only vote once on a post or comment
);

-- Add vote count columns to posts table
ALTER TABLE posts ADD COLUMN upvotes INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN downvotes INTEGER DEFAULT 0;

-- Add vote count column to comments table
ALTER TABLE comments ADD COLUMN vote_count INTEGER DEFAULT 0;