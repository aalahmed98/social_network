-- Add last_read_message_id to chat_participants table
ALTER TABLE chat_participants ADD COLUMN last_read_message_id INTEGER DEFAULT NULL;

-- Add foreign key constraint (SQLite doesn't support adding foreign keys to existing tables directly)
-- So we'll handle this constraint in the application logic 