CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('message', 'friend_request', 'group_invite', 'post_like', 'post_comment', 'group_post', 'mention', 'system')),
    content TEXT NOT NULL,
    reference_id INTEGER,
    reference_type TEXT CHECK (reference_type IN ('post', 'comment', 'message', 'user', 'group')),
    sender_id INTEGER,
    is_read BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL
); 