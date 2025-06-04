package sqlite

import (
	"database/sql"
	"fmt"
	"strings"
	"time"
)

// Notification represents a user notification
type Notification struct {
	ID          int64     `json:"id"`
	ReceiverID  int64     `json:"receiver_id"`
	SenderID    int64     `json:"sender_id"`
	Type        string    `json:"type"`
	Content     string    `json:"content"`
	ReferenceID int64     `json:"reference_id"`
	IsRead      bool      `json:"is_read"`
	CreatedAt   time.Time `json:"created_at"`
}

// EnsureNotificationsTableExists ensures the notifications table exists
func (db *DB) EnsureNotificationsTableExists() error {
	// Check if the table already exists
	var tableName string
	err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='notifications'").Scan(&tableName)

	// If table doesn't exist, create it
	if err != nil {
		if err != sql.ErrNoRows {
			return err
		}

		// Create notifications table if it doesn't exist
		_, err := db.Exec(`
			CREATE TABLE IF NOT EXISTS notifications (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				receiver_id INTEGER NOT NULL,
				sender_id INTEGER,
				type TEXT NOT NULL,
				content TEXT NOT NULL,
				reference_id INTEGER,
				is_read BOOLEAN DEFAULT FALSE,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (receiver_id) REFERENCES users (id) ON DELETE CASCADE,
				FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE SET NULL
			)
		`)
		if err != nil {
			return err
		}
		return nil
	}

	// Check if the table has the correct schema
	var columnCount int
	err = db.QueryRow("SELECT COUNT(*) FROM pragma_table_info('notifications') WHERE name='receiver_id'").Scan(&columnCount)
	if err != nil {
		return err
	}

	// If receiver_id column doesn't exist, drop and recreate the table
	if columnCount == 0 {
		// Begin a transaction to avoid data loss if possible
		tx, err := db.Begin()
		if err != nil {
			return err
		}
		defer tx.Rollback()

		// Drop the existing table
		_, err = tx.Exec("DROP TABLE notifications")
		if err != nil {
			return err
		}

		// Create the table with the correct schema
		_, err = tx.Exec(`
			CREATE TABLE notifications (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				receiver_id INTEGER NOT NULL,
				sender_id INTEGER,
				type TEXT NOT NULL,
				content TEXT NOT NULL,
				reference_id INTEGER,
				is_read BOOLEAN DEFAULT FALSE,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (receiver_id) REFERENCES users (id) ON DELETE CASCADE,
				FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE SET NULL
			)
		`)
		if err != nil {
			return err
		}

		// Commit the transaction
		if err = tx.Commit(); err != nil {
			return err
		}

		fmt.Println("Notifications table was recreated with the correct schema")
	}

	return nil
}

// CreateNotification creates a new notification
func (db *DB) CreateNotification(notification *Notification) (int64, error) {
	// Ensure the table exists
	if err := db.EnsureNotificationsTableExists(); err != nil {
		return 0, err
	}

	query := `INSERT INTO notifications (receiver_id, sender_id, type, content, reference_id, is_read)
	          VALUES (?, ?, ?, ?, ?, ?)`

	result, err := db.Exec(query,
		notification.ReceiverID,
		notification.SenderID,
		notification.Type,
		notification.Content,
		notification.ReferenceID,
		notification.IsRead)

	if err != nil {
		return 0, err
	}

	return result.LastInsertId()
}

// CreateMessageNotification creates a notification for a new message
func (db *DB) CreateMessageNotification(receiverID, senderID, conversationID int64, senderName string) (int64, error) {
	notification := &Notification{
		ReceiverID:  receiverID,
		SenderID:    senderID,
		Type:        "message",
		Content:     senderName + " sent you a message",
		ReferenceID: conversationID,
		IsRead:      false,
	}

	return db.CreateNotification(notification)
}

// GetNotification retrieves a notification by its ID
func (db *DB) GetNotification(id int64) (*Notification, error) {
	query := `SELECT id, receiver_id, sender_id, type, content, reference_id, is_read, created_at
	          FROM notifications WHERE id = ?`

	var notification Notification
	err := db.QueryRow(query, id).Scan(
		&notification.ID,
		&notification.ReceiverID,
		&notification.SenderID,
		&notification.Type,
		&notification.Content,
		&notification.ReferenceID,
		&notification.IsRead,
		&notification.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &notification, nil
}

// GetUserNotifications retrieves notifications for a user with filtering and pagination
func (db *DB) GetUserNotifications(userID int64, notificationType string, limit, offset int) ([]*Notification, error) {
	// Ensure the table exists with correct schema
	if err := db.EnsureNotificationsTableExists(); err != nil {
		fmt.Printf("Error ensuring notifications table exists: %v\n", err)
		return nil, fmt.Errorf("failed to ensure notifications table: %w", err)
	}

	fmt.Printf("Fetching notifications for user ID: %d (type: %s, limit: %d, offset: %d)\n",
		userID, notificationType, limit, offset)

	var notifications []*Notification

	// Try to get notifications from the database
	var query string
	var args []interface{}

	if notificationType != "" {
		query = `SELECT id, receiver_id, sender_id, type, content, reference_id, is_read, created_at
		         FROM notifications 
		         WHERE receiver_id = ? AND type = ?
		         ORDER BY created_at DESC
		         LIMIT ? OFFSET ?`
		args = []interface{}{userID, notificationType, limit, offset}
	} else {
		query = `SELECT id, receiver_id, sender_id, type, content, reference_id, is_read, created_at
		         FROM notifications 
		         WHERE receiver_id = ?
		         ORDER BY created_at DESC
		         LIMIT ? OFFSET ?`
		args = []interface{}{userID, limit, offset}
	}

	// Debug the query being executed
	fmt.Printf("Executing query: %s with args: %v\n", query, args)

	rows, err := db.Query(query, args...)
	if err != nil {
		// Log the specific error
		fmt.Printf("Database error querying notifications: %v\n", err)

		// If there's an error but it's not because the table doesn't exist,
		// return the error
		if !strings.Contains(err.Error(), "no such table") {
			return nil, err
		}
		// If the table doesn't exist, we'll continue with empty notifications
		// and try to get follow requests later
	} else {
		defer rows.Close()

		for rows.Next() {
			var notification Notification
			if err := rows.Scan(
				&notification.ID,
				&notification.ReceiverID,
				&notification.SenderID,
				&notification.Type,
				&notification.Content,
				&notification.ReferenceID,
				&notification.IsRead,
				&notification.CreatedAt,
			); err != nil {
				fmt.Printf("Error scanning notification row: %v\n", err)
				return nil, err
			}
			notifications = append(notifications, &notification)
		}

		if err := rows.Err(); err != nil {
			fmt.Printf("Error after notification rows iteration: %v\n", err)
			return nil, err
		}
	}

	fmt.Printf("Found %d notifications in the database\n", len(notifications))

	// Try to get follow requests as notifications, even if we already have some notifications
	fmt.Println("Attempting to get follow requests...")
	followRequests, err := db.GetUserFollowRequests(userID)
	if err != nil {
		fmt.Printf("Error getting follow requests: %v\n", err)
		// Continue with any notifications we have
	} else {
		fmt.Printf("Found %d follow requests\n", len(followRequests))
		if len(followRequests) > 0 {
			for _, request := range followRequests {
				// Get follower user info for the notification content
				follower, err := db.GetUserById(int(request.FollowerID))
				if err != nil {
					fmt.Printf("Error getting follower info for request from user %d: %v\n", request.FollowerID, err)
					continue
				}

				followerName := follower["first_name"].(string) + " " + follower["last_name"].(string)

				notification := &Notification{
					ID:          request.ID,
					ReceiverID:  userID,
					SenderID:    request.FollowerID,
					Type:        "follow_request",
					Content:     followerName + " wants to follow you",
					ReferenceID: request.ID,
					IsRead:      false,
					CreatedAt:   request.CreatedAt,
				}

				notifications = append(notifications, notification)
			}
		}
	}

	// Even if we get no notifications or follow requests, return an empty slice rather than an error
	if notifications == nil {
		notifications = []*Notification{}
	}

	fmt.Printf("Returning total of %d notifications and follow requests\n", len(notifications))
	return notifications, nil
}

// MarkNotificationAsRead marks a specific notification as read
func (db *DB) MarkNotificationAsRead(id int64) error {
	query := `UPDATE notifications SET is_read = TRUE WHERE id = ?`
	_, err := db.Exec(query, id)
	return err
}

// MarkNotificationsAsRead marks all notifications of a user as read
func (db *DB) MarkNotificationsAsRead(userID int64) error {
	query := `UPDATE notifications SET is_read = TRUE WHERE receiver_id = ? AND is_read = FALSE`
	_, err := db.Exec(query, userID)
	return err
}

// GetUnreadNotificationCount returns the number of unread notifications for a user
func (db *DB) GetUnreadNotificationCount(userID int64) (int, error) {
	// Ensure the table exists with correct schema
	if err := db.EnsureNotificationsTableExists(); err != nil {
		fmt.Printf("Error ensuring notifications table exists in GetUnreadNotificationCount: %v\n", err)
		return 0, err
	}

	query := `SELECT COUNT(*) FROM notifications WHERE receiver_id = ? AND is_read = FALSE`

	var count int
	err := db.QueryRow(query, userID).Scan(&count)
	if err != nil {
		// If there's an error but it's not because the table doesn't exist,
		// return the error
		if !strings.Contains(err.Error(), "no such table") {
			fmt.Printf("Error getting unread count: %v\n", err)
			return 0, err
		}
		// If the table doesn't exist, return 0
		return 0, nil
	}

	// Also add pending follow requests to count
	var requestCount int
	requestCountQuery := `SELECT COUNT(*) FROM follow_requests WHERE following_id = ?`
	err = db.QueryRow(requestCountQuery, userID).Scan(&requestCount)
	if err != nil {
		// If there's an error but it's not because the table doesn't exist,
		// log the error but continue with the count we have
		if !strings.Contains(err.Error(), "no such table") {
			fmt.Printf("Error getting follow request count: %v\n", err)
		}
	} else {
		// Add follow request count to total
		count += requestCount
	}

	return count, nil
}

// DeleteNotification deletes a notification
func (db *DB) DeleteNotification(id int64) error {
	query := `DELETE FROM notifications WHERE id = ?`
	_, err := db.Exec(query, id)
	return err
}

// DeleteUserNotifications deletes all notifications for a user
func (db *DB) DeleteUserNotifications(userID int64) error {
	query := `DELETE FROM notifications WHERE receiver_id = ?`
	_, err := db.Exec(query, userID)
	return err
}

// CreateSystemNotification is a helper method to create a system notification
func (db *DB) CreateSystemNotification(userID int64, content string) (int64, error) {
	notification := &Notification{
		ReceiverID: userID,
		Type:       "system",
		Content:    content,
		IsRead:     false,
	}

	return db.CreateNotification(notification)
}

// CreateGroupInviteNotification is a helper method to create a group invite notification
func (db *DB) CreateGroupInviteNotification(userID, senderID, groupID int64, groupName, senderName string) (int64, error) {
	notification := &Notification{
		ReceiverID:  userID,
		Type:        "group_invitation",
		Content:     senderName + " invited you to join " + groupName,
		ReferenceID: groupID,
		IsRead:      false,
	}

	return db.CreateNotification(notification)
}

// CreatePostLikeNotification is a helper method to create a post like notification
func (db *DB) CreatePostLikeNotification(userID, senderID, postID int64, senderName string) (int64, error) {
	notification := &Notification{
		ReceiverID:  userID,
		Type:        "post_like",
		Content:     senderName + " liked your post",
		ReferenceID: postID,
		IsRead:      false,
	}

	return db.CreateNotification(notification)
}

// CreatePostCommentNotification is a helper method to create a post comment notification
func (db *DB) CreatePostCommentNotification(userID, senderID, postID int64, senderName string) (int64, error) {
	notification := &Notification{
		ReceiverID:  userID,
		Type:        "post_comment",
		Content:     senderName + " commented on your post",
		ReferenceID: postID,
		IsRead:      false,
	}

	return db.CreateNotification(notification)
}
