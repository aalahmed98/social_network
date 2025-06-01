package sqlite

import (
	"database/sql"
	"log"
)

// DB represents a SQLite database connection
type DB struct {
	*sql.DB
}

// DeleteGroup removes a group from the database
func (db *DB) DeleteGroup(id int64) error {
	// Start a transaction to ensure all deletions happen atomically
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Enable foreign keys for this transaction
	_, err = tx.Exec("PRAGMA foreign_keys = ON")
	if err != nil {
		return err
	}

	// Delete related data in the correct order to avoid foreign key violations
	// Use IGNORE to skip errors if tables don't exist

	// 1. Delete group message attachments
	_, err = tx.Exec("DELETE FROM group_message_attachments WHERE message_id IN (SELECT id FROM group_messages WHERE group_id = ?)", id)
	if err != nil {
		return err
	}

	// 2. Delete group messages
	_, err = tx.Exec("DELETE FROM group_messages WHERE group_id = ?", id)
	if err != nil {
		return err
	}

	// 3. Delete group event responses
	_, err = tx.Exec("DELETE FROM group_event_responses WHERE event_id IN (SELECT id FROM group_events WHERE group_id = ?)", id)
	if err != nil {
		return err
	}

	// 4. Delete group events
	_, err = tx.Exec("DELETE FROM group_events WHERE group_id = ?", id)
	if err != nil {
		return err
	}

	// 5. Delete group post comments
	_, err = tx.Exec("DELETE FROM group_post_comments WHERE post_id IN (SELECT id FROM group_posts WHERE group_id = ?)", id)
	if err != nil {
		return err
	}

	// 6. Delete group post likes (if table exists)
	_, err = tx.Exec("DELETE FROM group_post_likes WHERE post_id IN (SELECT id FROM group_posts WHERE group_id = ?)", id)
	if err != nil {
		// Log the error but continue - the table might not exist
		log.Printf("Warning: Error deleting group post likes: %v", err)
	}

	// 7. Delete group posts
	_, err = tx.Exec("DELETE FROM group_posts WHERE group_id = ?", id)
	if err != nil {
		return err
	}

	// 8. Delete group invitations
	_, err = tx.Exec("DELETE FROM group_invitations WHERE group_id = ?", id)
	if err != nil {
		return err
	}

	// 9. Delete group join requests
	_, err = tx.Exec("DELETE FROM group_join_requests WHERE group_id = ?", id)
	if err != nil {
		return err
	}

	// 10. Delete conversation participants for this group
	_, err = tx.Exec("DELETE FROM chat_participants WHERE conversation_id IN (SELECT id FROM chat_conversations WHERE group_id = ?)", id)
	if err != nil {
		return err
	}

	// 11. Delete messages in group conversations
	_, err = tx.Exec("DELETE FROM chat_messages WHERE conversation_id IN (SELECT id FROM chat_conversations WHERE group_id = ?)", id)
	if err != nil {
		return err
	}

	// 12. Delete group conversations
	_, err = tx.Exec("DELETE FROM chat_conversations WHERE group_id = ?", id)
	if err != nil {
		return err
	}

	// 13. Delete group members
	_, err = tx.Exec("DELETE FROM group_members WHERE group_id = ?", id)
	if err != nil {
		return err
	}

	// 14. Finally delete the group itself
	_, err = tx.Exec("DELETE FROM groups WHERE id = ?", id)
	if err != nil {
		return err
	}

	// Commit the transaction
	return tx.Commit()
}
