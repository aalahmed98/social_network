-- Remove added columns from posts table
PRAGMA foreign_keys=off;
BEGIN TRANSACTION;
CREATE TABLE posts_backup AS SELECT id, user_id, content, image_url, privacy, created_at, updated_at FROM posts;
DROP TABLE posts;
CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    privacy TEXT DEFAULT 'public',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
INSERT INTO posts SELECT * FROM posts_backup;
DROP TABLE posts_backup;
COMMIT;
PRAGMA foreign_keys=on;

-- Remove vote_count column from comments table
PRAGMA foreign_keys=off;
BEGIN TRANSACTION;
CREATE TABLE comments_backup AS SELECT id, post_id, user_id, content, image_url, created_at FROM comments;
DROP TABLE comments;
CREATE TABLE comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
INSERT INTO comments SELECT * FROM comments_backup;
DROP TABLE comments_backup;
COMMIT;
PRAGMA foreign_keys=on;

-- Drop votes table
DROP TABLE IF EXISTS votes;