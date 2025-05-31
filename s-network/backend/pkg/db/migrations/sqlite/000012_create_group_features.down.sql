-- Drop indexes
DROP INDEX IF EXISTS idx_group_event_responses_event_id;
DROP INDEX IF EXISTS idx_group_events_group_id;
DROP INDEX IF EXISTS idx_group_post_comments_post_id;
DROP INDEX IF EXISTS idx_group_posts_group_id;
DROP INDEX IF EXISTS idx_group_join_requests_user_id;
DROP INDEX IF EXISTS idx_group_join_requests_group_id;
DROP INDEX IF EXISTS idx_group_invitations_invitee_id;
DROP INDEX IF EXISTS idx_group_invitations_group_id;
DROP INDEX IF EXISTS idx_group_members_user_id;
DROP INDEX IF EXISTS idx_group_members_group_id;

-- Drop tables
DROP TABLE IF EXISTS group_event_responses;
DROP TABLE IF EXISTS group_events;
DROP TABLE IF EXISTS group_post_likes;
DROP TABLE IF EXISTS group_post_comments;
DROP TABLE IF EXISTS group_posts;
DROP TABLE IF EXISTS group_join_requests;
DROP TABLE IF EXISTS group_invitations; 