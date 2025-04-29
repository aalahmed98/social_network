CREATE TABLE IF NOT EXISTS post_access (
    post_id INTEGER NOT NULL,
    follower_id INTEGER NOT NULL,
    PRIMARY KEY (post_id, follower_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE
); 