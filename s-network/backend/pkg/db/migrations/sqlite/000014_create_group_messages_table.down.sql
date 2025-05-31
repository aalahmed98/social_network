-- Drop indexes first
DROP INDEX IF EXISTS idx_group_message_attachments_message_id;
DROP INDEX IF EXISTS idx_group_messages_created_at;
DROP INDEX IF EXISTS idx_group_messages_sender_id;
DROP INDEX IF EXISTS idx_group_messages_group_id;

-- Drop tables
DROP TABLE IF EXISTS group_message_attachments;
DROP TABLE IF EXISTS group_messages; 