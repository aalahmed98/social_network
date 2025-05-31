package sqlite

import (
	"database/sql"
	"time"
)

// User represents a user in the system
type User struct {
	ID        int64     `json:"id"`
	Email     string    `json:"email"`
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	Avatar    string    `json:"avatar"`
	CreatedAt time.Time `json:"created_at"`
}

type ChatConversation struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	IsGroup   bool      `json:"is_group"`
	GroupID   *int64    `json:"group_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ChatParticipant struct {
	ConversationID    int64      `json:"conversation_id"`
	UserID            int64      `json:"user_id"`
	JoinedAt          time.Time  `json:"joined_at"`
	LastReadMessageID *int64     `json:"last_read_message_id"`
}

type ChatMessage struct {
	ID             int64     `json:"id"`
	ConversationID int64     `json:"conversation_id"`
	SenderID       int64     `json:"sender_id"`
	Content        string    `json:"content"`
	IsDeleted      bool      `json:"is_deleted"`
	CreatedAt      time.Time `json:"created_at"`
	// Nested structs for related data
	Sender      *User              `json:"sender,omitempty"`
	Attachments []*ChatAttachment  `json:"attachments,omitempty"`
}

// GroupMessage represents a message in a group chat
type GroupMessage struct {
	ID          int64     `json:"id"`
	GroupID     int64     `json:"group_id"`
	SenderID    int64     `json:"sender_id"`
	Content     string    `json:"content"`
	IsDeleted   bool      `json:"is_deleted"`
	CreatedAt   time.Time `json:"created_at"`
	// Nested structs for related data
	Sender      *User                   `json:"sender,omitempty"`
	Attachments []*GroupMessageAttachment `json:"attachments,omitempty"`
}

type ChatAttachment struct {
	ID        int64     `json:"id"`
	MessageID int64     `json:"message_id"`
	FileURL   string    `json:"file_url"`
	FileType  string    `json:"file_type"`
	FileName  string    `json:"file_name"`
	FileSize  int64     `json:"file_size"`
	CreatedAt time.Time `json:"created_at"`
}

// GroupMessageAttachment represents an attachment to a group message
type GroupMessageAttachment struct {
	ID        int64     `json:"id"`
	MessageID int64     `json:"message_id"`
	FileURL   string    `json:"file_url"`
	FileType  string    `json:"file_type"`
	FileName  string    `json:"file_name"`
	FileSize  int64     `json:"file_size"`
	CreatedAt time.Time `json:"created_at"`
}

// CreateConversation creates a new chat conversation
func (db *DB) CreateConversation(conversation *ChatConversation) (int64, error) {
	query := `INSERT INTO chat_conversations (name, is_group, group_id) 
	          VALUES (?, ?, ?)`
	
	result, err := db.Exec(query, conversation.Name, conversation.IsGroup, conversation.GroupID)
	if err != nil {
		return 0, err
	}
	
	return result.LastInsertId()
}

// GetConversation retrieves a conversation by its ID
func (db *DB) GetConversation(id int64) (*ChatConversation, error) {
	query := `SELECT id, name, is_group, group_id, created_at, updated_at 
	          FROM chat_conversations WHERE id = ?`
	
	var conversation ChatConversation
	var groupID sql.NullInt64
	var name sql.NullString
	
	err := db.QueryRow(query, id).Scan(
		&conversation.ID,
		&name,
		&conversation.IsGroup,
		&groupID,
		&conversation.CreatedAt,
		&conversation.UpdatedAt,
	)
	
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	
	if groupID.Valid {
		conversation.GroupID = &groupID.Int64
	}
	if name.Valid {
		conversation.Name = name.String
	} else {
		conversation.Name = ""
	}
	
	return &conversation, nil
}

// AddParticipant adds a user to a conversation
func (db *DB) AddParticipant(conversationID, userID int64) error {
	query := `INSERT INTO chat_participants (conversation_id, user_id) 
	          VALUES (?, ?)`
	
	_, err := db.Exec(query, conversationID, userID)
	return err
}

// RemoveParticipant removes a user from a conversation
func (db *DB) RemoveParticipant(conversationID, userID int64) error {
	query := `DELETE FROM chat_participants 
	          WHERE conversation_id = ? AND user_id = ?`
	
	_, err := db.Exec(query, conversationID, userID)
	return err
}

// GetConversationParticipants retrieves all participants in a conversation
func (db *DB) GetConversationParticipants(conversationID int64) ([]*ChatParticipant, error) {
	query := `SELECT conversation_id, user_id, joined_at, last_read_message_id 
	          FROM chat_participants 
	          WHERE conversation_id = ?`
	
	rows, err := db.Query(query, conversationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var participants []*ChatParticipant
	for rows.Next() {
		var participant ChatParticipant
		var lastReadID sql.NullInt64
		
		if err := rows.Scan(
			&participant.ConversationID,
			&participant.UserID,
			&participant.JoinedAt,
			&lastReadID,
		); err != nil {
			return nil, err
		}
		
		if lastReadID.Valid {
			participant.LastReadMessageID = &lastReadID.Int64
		}
		
		participants = append(participants, &participant)
	}
	
	if err := rows.Err(); err != nil {
		return nil, err
	}
	
	return participants, nil
}

// GetUserConversations retrieves all conversations a user is participating in
func (db *DB) GetUserConversations(userID int64) ([]*ChatConversation, error) {
	query := `SELECT c.id, c.name, c.is_group, c.group_id, c.created_at, c.updated_at 
	          FROM chat_conversations c
	          JOIN chat_participants p ON c.id = p.conversation_id
	          WHERE p.user_id = ?
	          ORDER BY c.updated_at DESC`
	
	rows, err := db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var conversations []*ChatConversation
	for rows.Next() {
		var conversation ChatConversation
		var groupID sql.NullInt64
		var name sql.NullString
		
		if err := rows.Scan(
			&conversation.ID,
			&name,
			&conversation.IsGroup,
			&groupID,
			&conversation.CreatedAt,
			&conversation.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if groupID.Valid {
			conversation.GroupID = &groupID.Int64
		}
		if name.Valid {
			conversation.Name = name.String
		} else {
			conversation.Name = ""
		}
		conversations = append(conversations, &conversation)
	}
	
	if err := rows.Err(); err != nil {
		return nil, err
	}
	
	return conversations, nil
}

// CreateMessage adds a new message to a conversation
func (db *DB) CreateMessage(message *ChatMessage) (int64, error) {
	query := `INSERT INTO chat_messages (conversation_id, sender_id, content) 
	          VALUES (?, ?, ?)`
	
	result, err := db.Exec(query, message.ConversationID, message.SenderID, message.Content)
	if err != nil {
		return 0, err
	}
	
	id, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}
	
	// Update conversation's updated_at timestamp
	updateQuery := `UPDATE chat_conversations 
	                SET updated_at = CURRENT_TIMESTAMP 
	                WHERE id = ?`
	
	_, err = db.Exec(updateQuery, message.ConversationID)
	if err != nil {
		return id, err
	}
	
	return id, nil
}

// GetMessage retrieves a message by its ID
func (db *DB) GetMessage(id int64) (*ChatMessage, error) {
	query := `SELECT id, conversation_id, sender_id, content, is_deleted, created_at 
	          FROM chat_messages WHERE id = ?`
	
	var message ChatMessage
	err := db.QueryRow(query, id).Scan(
		&message.ID,
		&message.ConversationID,
		&message.SenderID,
		&message.Content,
		&message.IsDeleted,
		&message.CreatedAt,
	)
	
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	
	return &message, nil
}

// GetConversationMessages retrieves messages from a conversation with pagination
func (db *DB) GetConversationMessages(conversationID int64, limit, offset int) ([]*ChatMessage, error) {
	query := `SELECT id, conversation_id, sender_id, content, is_deleted, created_at 
	          FROM chat_messages 
	          WHERE conversation_id = ? 
	          ORDER BY created_at ASC 
	          LIMIT ? OFFSET ?`
	
	rows, err := db.Query(query, conversationID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var messages []*ChatMessage
	for rows.Next() {
		var message ChatMessage
		if err := rows.Scan(
			&message.ID,
			&message.ConversationID,
			&message.SenderID,
			&message.Content,
			&message.IsDeleted,
			&message.CreatedAt,
		); err != nil {
			return nil, err
		}
		
		// Fetch message attachments
		attachments, err := db.GetMessageAttachments(message.ID)
		if err != nil {
			return nil, err
		}
		message.Attachments = attachments
		
		messages = append(messages, &message)
	}
	
	if err := rows.Err(); err != nil {
		return nil, err
	}
	
	return messages, nil
}

// MarkMessageAsDeleted marks a message as deleted
func (db *DB) MarkMessageAsDeleted(id int64) error {
	query := `UPDATE chat_messages 
	          SET is_deleted = TRUE 
	          WHERE id = ?`
	
	_, err := db.Exec(query, id)
	return err
}

// UpdateLastReadMessage updates the last read message for a participant
func (db *DB) UpdateLastReadMessage(conversationID, userID, messageID int64) error {
	query := `UPDATE chat_participants 
	          SET last_read_message_id = ? 
	          WHERE conversation_id = ? AND user_id = ?`
	
	_, err := db.Exec(query, messageID, conversationID, userID)
	return err
}

// AddAttachment adds an attachment to a message
func (db *DB) AddAttachment(attachment *ChatAttachment) (int64, error) {
	query := `INSERT INTO chat_attachments (message_id, file_url, file_type, file_name, file_size) 
	          VALUES (?, ?, ?, ?, ?)`
	
	result, err := db.Exec(
		query, 
		attachment.MessageID, 
		attachment.FileURL, 
		attachment.FileType, 
		attachment.FileName, 
		attachment.FileSize,
	)
	if err != nil {
		return 0, err
	}
	
	return result.LastInsertId()
}

// GetMessageAttachments retrieves all attachments for a message
func (db *DB) GetMessageAttachments(messageID int64) ([]*ChatAttachment, error) {
	query := `SELECT id, message_id, file_url, file_type, file_name, file_size, created_at 
	          FROM chat_attachments 
	          WHERE message_id = ?`
	
	rows, err := db.Query(query, messageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var attachments []*ChatAttachment
	for rows.Next() {
		var attachment ChatAttachment
		if err := rows.Scan(
			&attachment.ID,
			&attachment.MessageID,
			&attachment.FileURL,
			&attachment.FileType,
			&attachment.FileName,
			&attachment.FileSize,
			&attachment.CreatedAt,
		); err != nil {
			return nil, err
		}
		attachments = append(attachments, &attachment)
	}
	
	if err := rows.Err(); err != nil {
		return nil, err
	}
	
	return attachments, nil
}

// GetUnreadMessageCount returns the number of unread messages in a conversation for a user
func (db *DB) GetUnreadMessageCount(conversationID, userID int64) (int, error) {
	query := `SELECT COUNT(*) FROM chat_messages m
	          JOIN chat_participants p ON m.conversation_id = p.conversation_id
	          WHERE m.conversation_id = ? 
	          AND p.user_id = ?
	          AND (p.last_read_message_id IS NULL OR m.id > p.last_read_message_id)`
	
	var count int
	err := db.QueryRow(query, conversationID, userID).Scan(&count)
	if err != nil {
		return 0, err
	}
	
	return count, nil
}

// GetOrCreateDirectConversation gets an existing direct conversation between two users or creates a new one
func (db *DB) GetOrCreateDirectConversation(user1ID, user2ID int64) (int64, error) {
	// First, check if a direct conversation already exists between the users
	query := `SELECT c.id FROM chat_conversations c
	          JOIN chat_participants p1 ON c.id = p1.conversation_id
	          JOIN chat_participants p2 ON c.id = p2.conversation_id
	          WHERE c.is_group = 0
	          AND p1.user_id = ?
	          AND p2.user_id = ?
	          AND (SELECT COUNT(*) FROM chat_participants WHERE conversation_id = c.id) = 2`
	
	var conversationID int64
	err := db.QueryRow(query, user1ID, user2ID).Scan(&conversationID)
	
	if err == nil {
		// Conversation already exists
		return conversationID, nil
	}
	
	if err != sql.ErrNoRows {
		// Unexpected error
		return 0, err
	}
	
	// Conversation doesn't exist, create a new one
	tx, err := db.Begin()
	if err != nil {
		return 0, err
	}
	
	// Create the conversation
	createQuery := `INSERT INTO chat_conversations (is_group) VALUES (0)`
	result, err := tx.Exec(createQuery)
	if err != nil {
		tx.Rollback()
		return 0, err
	}
	
	newConversationID, err := result.LastInsertId()
	if err != nil {
		tx.Rollback()
		return 0, err
	}
	
	// Add first participant
	_, err = tx.Exec(`INSERT INTO chat_participants (conversation_id, user_id) VALUES (?, ?)`, 
		newConversationID, user1ID)
	if err != nil {
		tx.Rollback()
		return 0, err
	}
	
	// Add second participant
	_, err = tx.Exec(`INSERT INTO chat_participants (conversation_id, user_id) VALUES (?, ?)`, 
		newConversationID, user2ID)
	if err != nil {
		tx.Rollback()
		return 0, err
	}
	
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	
	return newConversationID, nil
}

// ============== GROUP MESSAGE FUNCTIONS ==============

// CreateGroupMessage adds a new message to a group chat
func (db *DB) CreateGroupMessage(message *GroupMessage) (int64, error) {
	query := `INSERT INTO group_messages (group_id, sender_id, content) 
	          VALUES (?, ?, ?)`
	
	result, err := db.Exec(query, message.GroupID, message.SenderID, message.Content)
	if err != nil {
		return 0, err
	}
	
	return result.LastInsertId()
}

// GetGroupMessage retrieves a group message by its ID
func (db *DB) GetGroupMessage(id int64) (*GroupMessage, error) {
	query := `SELECT id, group_id, sender_id, content, is_deleted, created_at 
	          FROM group_messages WHERE id = ?`
	
	var message GroupMessage
	err := db.QueryRow(query, id).Scan(
		&message.ID,
		&message.GroupID,
		&message.SenderID,
		&message.Content,
		&message.IsDeleted,
		&message.CreatedAt,
	)
	
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	
	return &message, nil
}

// GetGroupMessages retrieves messages from a group with pagination
func (db *DB) GetGroupMessages(groupID int64, limit, offset int) ([]*GroupMessage, error) {
	query := `SELECT id, group_id, sender_id, content, is_deleted, created_at 
	          FROM group_messages 
	          WHERE group_id = ? AND is_deleted = FALSE
	          ORDER BY created_at ASC 
	          LIMIT ? OFFSET ?`
	
	rows, err := db.Query(query, groupID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var messages []*GroupMessage
	for rows.Next() {
		var message GroupMessage
		if err := rows.Scan(
			&message.ID,
			&message.GroupID,
			&message.SenderID,
			&message.Content,
			&message.IsDeleted,
			&message.CreatedAt,
		); err != nil {
			return nil, err
		}
		
		// Fetch message attachments
		attachments, err := db.GetGroupMessageAttachments(message.ID)
		if err != nil {
			return nil, err
		}
		message.Attachments = attachments
		
		messages = append(messages, &message)
	}
	
	if err := rows.Err(); err != nil {
		return nil, err
	}
	
	return messages, nil
}

// MarkGroupMessageAsDeleted marks a group message as deleted
func (db *DB) MarkGroupMessageAsDeleted(id int64) error {
	query := `UPDATE group_messages 
	          SET is_deleted = TRUE 
	          WHERE id = ?`
	
	_, err := db.Exec(query, id)
	return err
}

// AddGroupMessageAttachment adds an attachment to a group message
func (db *DB) AddGroupMessageAttachment(attachment *GroupMessageAttachment) (int64, error) {
	query := `INSERT INTO group_message_attachments (message_id, file_url, file_type, file_name, file_size) 
	          VALUES (?, ?, ?, ?, ?)`
	
	result, err := db.Exec(
		query, 
		attachment.MessageID, 
		attachment.FileURL, 
		attachment.FileType, 
		attachment.FileName, 
		attachment.FileSize,
	)
	if err != nil {
		return 0, err
	}
	
	return result.LastInsertId()
}

// GetGroupMessageAttachments retrieves all attachments for a group message
func (db *DB) GetGroupMessageAttachments(messageID int64) ([]*GroupMessageAttachment, error) {
	query := `SELECT id, message_id, file_url, file_type, file_name, file_size, created_at 
	          FROM group_message_attachments 
	          WHERE message_id = ?`
	
	rows, err := db.Query(query, messageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var attachments []*GroupMessageAttachment
	for rows.Next() {
		var attachment GroupMessageAttachment
		if err := rows.Scan(
			&attachment.ID,
			&attachment.MessageID,
			&attachment.FileURL,
			&attachment.FileType,
			&attachment.FileName,
			&attachment.FileSize,
			&attachment.CreatedAt,
		); err != nil {
			return nil, err
		}
		attachments = append(attachments, &attachment)
	}
	
	if err := rows.Err(); err != nil {
		return nil, err
	}
	
	return attachments, nil
}

// GetLatestGroupMessage gets the most recent message from a group
func (db *DB) GetLatestGroupMessage(groupID int64) (*GroupMessage, error) {
	query := `SELECT id, group_id, sender_id, content, is_deleted, created_at 
	          FROM group_messages 
	          WHERE group_id = ? AND is_deleted = FALSE
	          ORDER BY created_at DESC 
	          LIMIT 1`
	
	var message GroupMessage
	err := db.QueryRow(query, groupID).Scan(
		&message.ID,
		&message.GroupID,
		&message.SenderID,
		&message.Content,
		&message.IsDeleted,
		&message.CreatedAt,
	)
	
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	
	return &message, nil
} 