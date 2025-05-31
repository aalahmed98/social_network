-- Remove last_read_message_id from chat_participants table
-- SQLite doesn't support DROP COLUMN directly, so we need to recreate the table

-- Create temporary table without the column
CREATE TABLE chat_participants_temp (
    conversation_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (conversation_id, user_id),
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Copy data from original table
INSERT INTO chat_participants_temp (conversation_id, user_id, joined_at)
SELECT conversation_id, user_id, joined_at FROM chat_participants;

-- Drop original table
DROP TABLE chat_participants;

-- Rename temp table to original name
ALTER TABLE chat_participants_temp RENAME TO chat_participants; 