package sqlite

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/sqlite3"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/mattn/go-sqlite3"
)

// DB represents the database connection
type DB struct {
	*sql.DB // Embedding a pointer to sql.DB
}

func (db *DB) GetUserByID(id int) (any, error) {
	panic("unimplemented")
}

// New creates a new database connection
func New(dbPath string) (*DB, error) {
	// Check if the database directory exists, create it if it doesn't
	dbDir := filepath.Dir(dbPath)
	if _, err := os.Stat(dbDir); os.IsNotExist(err) {
		if err := os.MkdirAll(dbDir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create database directory: %w", err)
		}
	}

	// Open the database with SQLite's auto-create mode
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	// Enable foreign key constraints
	_, err = db.Exec("PRAGMA foreign_keys = ON")
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to enable foreign keys: %w", err)
	}

	// Initialize the database struct
	sqliteDB := &DB{db}

	// Ensure all tables exist
	if err := sqliteDB.InitializeTables(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to initialize tables: %w", err)
	}

	return sqliteDB, nil
}

// InitializeTables ensures all necessary tables exist in the database
func (db *DB) InitializeTables() error {
	// Create users table if it doesn't exist
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			email TEXT UNIQUE NOT NULL,
			password TEXT NOT NULL,
			first_name TEXT NOT NULL,
			last_name TEXT NOT NULL,
			date_of_birth TEXT NOT NULL,
			avatar TEXT,
			nickname TEXT,
			about_me TEXT,
			is_public BOOLEAN DEFAULT 1,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return err
	}

	// Create sessions table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id INTEGER NOT NULL,
			data TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			expires_at TIMESTAMP NOT NULL,
			FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
		)
	`)
	if err != nil {
		return err
	}

	// Create auth_tokens table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS auth_tokens (
			id TEXT PRIMARY KEY,
			user_id INTEGER NOT NULL,
			token_type TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			expires_at TIMESTAMP NOT NULL,
			FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
		)
	`)
	if err != nil {
		return err
	}

	// Create posts table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS posts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			title TEXT,
			content TEXT NOT NULL,
			image_url TEXT,
			privacy TEXT DEFAULT 'public',
			upvotes INTEGER DEFAULT 0,
			downvotes INTEGER DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
		)
	`)
	if err != nil {
		return err
	}

	// Create comments table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS comments (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			post_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			content TEXT NOT NULL,
			image_url TEXT,
			vote_count INTEGER DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
			FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
		)
	`)
	if err != nil {
		return err
	}

	// Create votes table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS votes (
			user_id INTEGER NOT NULL,
			content_id INTEGER NOT NULL,
			content_type TEXT NOT NULL,
			vote_type INTEGER NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (user_id, content_id, content_type),
			FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
		)
	`)
	if err != nil {
		return err
	}

	// Create followers table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS followers (
			follower_id INTEGER NOT NULL,
			following_id INTEGER NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (follower_id, following_id),
			FOREIGN KEY (follower_id) REFERENCES users (id) ON DELETE CASCADE,
			FOREIGN KEY (following_id) REFERENCES users (id) ON DELETE CASCADE
		)
	`)
	if err != nil {
		return err
	}

	// Create post_access table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS post_access (
			post_id INTEGER NOT NULL,
			follower_id INTEGER NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (post_id, follower_id),
			FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
			FOREIGN KEY (follower_id) REFERENCES users (id) ON DELETE CASCADE
		)
	`)
	if err != nil {
		return err
	}

	// Create notifications table if it doesn't exist
	_, err = db.Exec(`
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

	// Create group_events table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS group_events (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			group_id INTEGER NOT NULL,
			creator_id INTEGER NOT NULL,
			title TEXT NOT NULL,
			description TEXT,
			event_date DATE NOT NULL,
			event_time TIME NOT NULL, 
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
			FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`)
	if err != nil {
		return err
	}

	// Add missing columns to existing group_events table
	_, err = db.Exec(`ALTER TABLE group_events ADD COLUMN event_time TIME DEFAULT '00:00'`)
	if err != nil && !strings.Contains(err.Error(), "duplicate column name") {
		return err
	}

	_, err = db.Exec(`ALTER TABLE group_events ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`)
	if err != nil && !strings.Contains(err.Error(), "duplicate column name") {
		return err
	}

	// Create group_event_responses table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS group_event_responses (
			event_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			response TEXT NOT NULL CHECK(response IN ('going', 'not_going')),
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (event_id, user_id),
			FOREIGN KEY (event_id) REFERENCES group_events(id) ON DELETE CASCADE,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`)
	if err != nil {
		return err
	}

	// Create groups table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS groups (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			description TEXT,
			creator_id INTEGER NOT NULL,
			avatar TEXT,
			privacy TEXT DEFAULT 'public' CHECK(privacy IN ('public', 'private')),
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`)
	if err != nil {
		return err
	}

	// Create group_members table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS group_members (
			group_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			role TEXT DEFAULT 'member' CHECK(role IN ('admin', 'member')),
			joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (group_id, user_id),
			FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`)
	if err != nil {
		return err
	}

	// Create group_invitations table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS group_invitations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			group_id INTEGER NOT NULL,
			inviter_id INTEGER NOT NULL,
			invitee_id INTEGER NOT NULL,
			status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
			FOREIGN KEY (inviter_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY (invitee_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`)
	if err != nil {
		return err
	}

	// Create group_join_requests table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS group_join_requests (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			group_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			message TEXT,
			status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected')),
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`)
	if err != nil {
		return err
	}

	// Create group_posts table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS group_posts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			group_id INTEGER NOT NULL,
			author_id INTEGER NOT NULL,
			content TEXT NOT NULL,
			image_path TEXT,
			likes_count INTEGER DEFAULT 0,
			comments_count INTEGER DEFAULT 0,
			upvotes INTEGER DEFAULT 0,
			downvotes INTEGER DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
			FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`)
	if err != nil {
		return err
	}

	// Create group_post_likes table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS group_post_likes (
			post_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (post_id, user_id),
			FOREIGN KEY (post_id) REFERENCES group_posts(id) ON DELETE CASCADE,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`)
	if err != nil {
		return err
	}

	// Create group_post_comments table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS group_post_comments (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			post_id INTEGER NOT NULL,
			author_id INTEGER NOT NULL,
			content TEXT NOT NULL,
			image_path TEXT,
			vote_count INTEGER DEFAULT 0,
			upvotes INTEGER DEFAULT 0,
			downvotes INTEGER DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (post_id) REFERENCES group_posts(id) ON DELETE CASCADE,
			FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`)
	if err != nil {
		return err
	}

	// Add image_path column to group_post_comments table if it doesn't exist
	_, err = db.Exec(`ALTER TABLE group_post_comments ADD COLUMN image_path TEXT`)
	if err != nil {
		// Ignore error if column already exists
		if !strings.Contains(err.Error(), "duplicate column name") {
			// If it's not a "duplicate column" error, return the error
			return err
		}
	}

	// Create group_event_responses table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS group_event_responses (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			event_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			response TEXT NOT NULL CHECK(response IN ('going', 'not_going')),
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(event_id, user_id),
			FOREIGN KEY (event_id) REFERENCES group_events(id) ON DELETE CASCADE,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`)
	if err != nil {
		return err
	}

	// Create chat_conversations table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS chat_conversations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT,
			is_group BOOLEAN DEFAULT FALSE,
			group_id INTEGER,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
		)
	`)
	if err != nil {
		return err
	}

	// Create chat_participants table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS chat_participants (
			conversation_id INTEGER NOT NULL,
			user_id INTEGER NOT NULL,
			joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			last_read_message_id INTEGER,
			PRIMARY KEY (conversation_id, user_id),
			FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`)
	if err != nil {
		return err
	}

	// Create chat_messages table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS chat_messages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			conversation_id INTEGER NOT NULL,
			sender_id INTEGER NOT NULL,
			content TEXT NOT NULL,
			is_deleted BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
			FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`)
	if err != nil {
		return err
	}

	// Create group_messages table if it doesn't exist
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS group_messages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			group_id INTEGER NOT NULL,
			sender_id INTEGER NOT NULL,
			content TEXT NOT NULL,
			is_deleted BOOLEAN DEFAULT FALSE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
			FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
		)
	`)
	if err != nil {
		return err
	}

	return nil
}

// Migrate runs the database migrations
func (db *DB) Migrate(migrationPath string) error {
	driver, err := sqlite3.WithInstance(db.DB, &sqlite3.Config{})
	if err != nil {
		return fmt.Errorf("could not create migration driver: %w", err)
	}

	// Ensure path format is correct for file:// URL
	sourceURL := fmt.Sprintf("file://%s", migrationPath)
	fmt.Printf("Using migration path: %s\n", sourceURL)

	m, err := migrate.NewWithDatabaseInstance(sourceURL, "sqlite3", driver)
	if err != nil {
		return fmt.Errorf("could not create migration instance: %w", err)
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("could not run migration up: %w", err)
	}

	return nil
}

// CreateUser adds a new user to the database
func (db *DB) CreateUser(email, password, firstName, lastName, dob, avatar, nickname, aboutMe string) (int64, error) {
	query := `INSERT INTO users (email, password, first_name, last_name, date_of_birth, avatar, nickname, about_me, is_public) 
			  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`

	// Set is_public to true (1) by default for all new users
	isPublic := true

	result, err := db.Exec(query, email, password, firstName, lastName, dob, avatar, nickname, aboutMe, isPublic)
	if err != nil {
		return 0, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}

	return id, nil
}

// GetUserByEmail retrieves a user by email
func (db *DB) GetUserByEmail(email string) (map[string]interface{}, error) {
	query := `SELECT id, email, password, first_name, last_name, date_of_birth, avatar, nickname, about_me, is_public 
			  FROM users WHERE email = ?`

	row := db.QueryRow(query, email)

	var id int
	var password, firstName, lastName, dob string
	var avatar, nickname, aboutMe sql.NullString
	var isPublic bool

	err := row.Scan(&id, &email, &password, &firstName, &lastName, &dob, &avatar, &nickname, &aboutMe, &isPublic)
	if err != nil {
		return nil, err
	}

	user := map[string]interface{}{
		"id":            id,
		"email":         email,
		"password":      password,
		"first_name":    firstName,
		"last_name":     lastName,
		"date_of_birth": dob,
		"is_public":     isPublic,
	}

	if avatar.Valid {
		user["avatar"] = avatar.String
	}
	if nickname.Valid {
		user["nickname"] = nickname.String
	}
	if aboutMe.Valid {
		user["about_me"] = aboutMe.String
	}

	return user, nil
}

// GetUserById retrieves a user by ID
func (db *DB) GetUserById(id int) (map[string]interface{}, error) {
	query := `SELECT id, email, password, first_name, last_name, date_of_birth, avatar, nickname, about_me, is_public 
			  FROM users WHERE id = ?`

	row := db.QueryRow(query, id)

	var email, password, firstName, lastName, dob string
	var avatar, nickname, aboutMe sql.NullString
	var isPublic bool

	err := row.Scan(&id, &email, &password, &firstName, &lastName, &dob, &avatar, &nickname, &aboutMe, &isPublic)
	if err != nil {
		return nil, err
	}

	user := map[string]interface{}{
		"id":            id,
		"email":         email,
		"password":      password,
		"first_name":    firstName,
		"last_name":     lastName,
		"date_of_birth": dob,
		"is_public":     isPublic,
	}

	if avatar.Valid {
		user["avatar"] = avatar.String
	}
	if nickname.Valid {
		user["nickname"] = nickname.String
	}
	if aboutMe.Valid {
		user["about_me"] = aboutMe.String
	}

	return user, nil
}

// SaveSession creates a new session for a user
func (db *DB) SaveSession(sessionID string, userID int, data string, expiresAt string) error {
	query := `INSERT INTO sessions (id, user_id, data, expires_at) 
			  VALUES (?, ?, ?, ?)`

	_, err := db.Exec(query, sessionID, userID, data, expiresAt)
	return err
}

// GetSession retrieves a session by ID
func (db *DB) GetSession(sessionID string) (map[string]interface{}, error) {
	query := `SELECT id, user_id, data, created_at, expires_at 
			  FROM sessions WHERE id = ? AND expires_at > datetime('now')`

	row := db.QueryRow(query, sessionID)

	var id string
	var userID int
	var data, createdAt, expiresAt string

	err := row.Scan(&id, &userID, &data, &createdAt, &expiresAt)
	if err != nil {
		return nil, err
	}

	session := map[string]interface{}{
		"id":         id,
		"user_id":    userID,
		"data":       data,
		"created_at": createdAt,
		"expires_at": expiresAt,
	}

	return session, nil
}

// DeleteSession removes a session
func (db *DB) DeleteSession(sessionID string) error {
	query := `DELETE FROM sessions WHERE id = ?`

	_, err := db.Exec(query, sessionID)
	return err
}

// DeleteSessionsByUserID removes all sessions for a specific user
func (db *DB) DeleteSessionsByUserID(userID int) error {
	query := `DELETE FROM sessions WHERE user_id = ?`

	_, err := db.Exec(query, userID)
	return err
}

// CleanupExpiredSessions removes all expired sessions and auth tokens
func (db *DB) CleanupExpiredSessions() error {
	// Delete expired sessions
	sessionQuery := `DELETE FROM sessions WHERE expires_at <= datetime('now')`
	_, err := db.Exec(sessionQuery)
	if err != nil {
		return fmt.Errorf("failed to cleanup expired sessions: %v", err)
	}

	// Delete expired auth tokens
	tokenQuery := `DELETE FROM auth_tokens WHERE expires_at <= datetime('now')`
	_, err = db.Exec(tokenQuery)
	if err != nil {
		return fmt.Errorf("failed to cleanup expired auth tokens: %v", err)
	}

	return nil
}

// CreateAuthToken creates a token for password reset or email verification
func (db *DB) CreateAuthToken(tokenID string, userID int, tokenType string, expiresAt string) error {
	query := `INSERT INTO auth_tokens (id, user_id, token_type, expires_at) 
			  VALUES (?, ?, ?, ?)`

	_, err := db.Exec(query, tokenID, userID, tokenType, expiresAt)
	return err
}

// GetAuthToken retrieves a token by ID
func (db *DB) GetAuthToken(tokenID string) (map[string]interface{}, error) {
	query := `SELECT id, user_id, token_type, created_at, expires_at 
			  FROM auth_tokens WHERE id = ? AND expires_at > datetime('now')`

	row := db.QueryRow(query, tokenID)

	var id, tokenType, createdAt, expiresAt string
	var userID int

	err := row.Scan(&id, &userID, &tokenType, &createdAt, &expiresAt)
	if err != nil {
		return nil, err
	}

	token := map[string]interface{}{
		"id":         id,
		"user_id":    userID,
		"token_type": tokenType,
		"created_at": createdAt,
		"expires_at": expiresAt,
	}

	return token, nil
}

// DeleteAuthToken removes a token
func (db *DB) DeleteAuthToken(tokenID string) error {
	query := `DELETE FROM auth_tokens WHERE id = ?`

	_, err := db.Exec(query, tokenID)
	return err
}

// DeleteAuthTokensByUserID removes all auth tokens for a specific user
func (db *DB) DeleteAuthTokensByUserID(userID int) error {
	query := `DELETE FROM auth_tokens WHERE user_id = ?`

	_, err := db.Exec(query, userID)
	return err
}

// UpdateUser updates user information in the database
func (db *DB) UpdateUser(userID int, data map[string]interface{}) error {
	// Start building query
	query := "UPDATE users SET "

	// Prepare query parts and arguments
	var parts []string
	var args []interface{}

	// Add each field to be updated
	if firstName, ok := data["first_name"]; ok {
		parts = append(parts, "first_name = ?")
		args = append(args, firstName)
	}

	if lastName, ok := data["last_name"]; ok {
		parts = append(parts, "last_name = ?")
		args = append(args, lastName)
	}

	if nickname, ok := data["nickname"]; ok {
		parts = append(parts, "nickname = ?")
		args = append(args, nickname)
	}

	if aboutMe, ok := data["about_me"]; ok {
		parts = append(parts, "about_me = ?")
		args = append(args, aboutMe)
	}

	if avatar, ok := data["avatar"]; ok {
		parts = append(parts, "avatar = ?")
		args = append(args, avatar)
	}

	if isPublic, ok := data["is_public"]; ok {
		parts = append(parts, "is_public = ?")
		args = append(args, isPublic)
	}

	// If no fields to update, return
	if len(parts) == 0 {
		return nil
	}

	// Complete the query
	query += fmt.Sprintf("%s WHERE id = ?", strings.Join(parts, ", "))
	args = append(args, userID)

	// Execute the query
	_, err := db.Exec(query, args...)
	return err
}

// AddComment adds a comment to a post
func (db *DB) AddComment(postID, userID int64, content string, imageURL string) (int64, error) {
	query := `INSERT INTO comments (post_id, user_id, content, image_url) 
			  VALUES (?, ?, ?, ?)`

	result, err := db.Exec(query, postID, userID, content, imageURL)
	if err != nil {
		return 0, err
	}

	commentID, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}

	return commentID, nil
}

// GetCommentsByPostID retrieves comments for a specific post
func (db *DB) GetCommentsByPostID(postID int64) ([]map[string]interface{}, error) {
	query := `
		SELECT 
			c.id, c.post_id, c.user_id, c.content, c.image_url, c.created_at, c.vote_count,
			u.first_name, u.last_name, u.avatar
		FROM comments c
		JOIN users u ON c.user_id = u.id
		WHERE c.post_id = ?
		ORDER BY c.created_at DESC
	`

	rows, err := db.Query(query, postID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	comments := []map[string]interface{}{}

	for rows.Next() {
		var (
			id        int64
			postID    int64
			userID    int64
			content   string
			imageURL  *string
			createdAt string
			voteCount int
			firstName string
			lastName  string
			avatar    *string
		)

		err := rows.Scan(&id, &postID, &userID, &content, &imageURL, &createdAt, &voteCount, &firstName, &lastName, &avatar)
		if err != nil {
			return nil, err
		}

		comment := map[string]interface{}{
			"id":         id,
			"post_id":    postID,
			"user_id":    userID,
			"content":    content,
			"created_at": createdAt,
			"vote_count": voteCount,
			"author": map[string]interface{}{
				"id":         userID,
				"first_name": firstName,
				"last_name":  lastName,
			},
		}

		if imageURL != nil {
			comment["image_url"] = *imageURL
		}

		if avatar != nil {
			comment["author"].(map[string]interface{})["avatar"] = *avatar
		}

		comments = append(comments, comment)
	}

	return comments, nil
}

// GetUserFollowers returns the list of followers for a user
func (db *DB) GetUserFollowers(userID int) ([]map[string]interface{}, error) {
	// Check if followers table exists
	var tableName string
	err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='followers'").Scan(&tableName)
	if err != nil {
		// If followers table doesn't exist, return empty array instead of error
		return []map[string]interface{}{}, nil
	}

	query := `
		SELECT u.id, u.first_name, u.last_name, u.avatar
		FROM followers f
		JOIN users u ON f.follower_id = u.id
		WHERE f.following_id = ?
	`

	rows, err := db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var followers []map[string]interface{}

	for rows.Next() {
		var id int
		var firstName, lastName string
		var avatar sql.NullString

		err := rows.Scan(&id, &firstName, &lastName, &avatar)
		if err != nil {
			return nil, err
		}

		follower := map[string]interface{}{
			"id":         id,
			"first_name": firstName,
			"last_name":  lastName,
		}

		if avatar.Valid {
			follower["avatar"] = avatar.String
		}

		followers = append(followers, follower)
	}

	return followers, nil
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////

// GetUserFollowers returns the list of followers for a user
func (db *DB) GetUserFollowing(userID int) ([]map[string]interface{}, error) {
	// Check if followers table exists
	var tableName string
	err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='followers'").Scan(&tableName) //name=followers is for the table name
	if err != nil {
		// If followers table doesn't exist, return empty array instead of error
		return []map[string]interface{}{}, nil
	}

	query := `
		SELECT u.id, u.first_name, u.last_name, u.avatar
		FROM followers f
		JOIN users u ON f.following_id = u.id
		WHERE f.follower_id = ?
	`

	rows, err := db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var following []map[string]interface{}

	for rows.Next() {
		var id int
		var firstName, lastName string
		var avatar sql.NullString

		err := rows.Scan(&id, &firstName, &lastName, &avatar)
		if err != nil {
			return nil, err
		}

		follower := map[string]interface{}{
			"id":         id,
			"first_name": firstName,
			"last_name":  lastName,
		}

		if avatar.Valid {
			follower["avatar"] = avatar.String
		}

		following = append(following, follower) //appended follower even though its following (maybe wrong)
	}

	return following, nil
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// FollowUser adds a follower relationship between two users
func (db *DB) FollowUser(followerID, followingID int) error {
	// Check if the following user exists
	query := `SELECT id FROM users WHERE id = ?`
	row := db.QueryRow(query, followingID)
	var id int
	err := row.Scan(&id)
	if err != nil {
		return fmt.Errorf("user to follow not found")
	}

	// Check if followers table exists
	var tableName string
	err = db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='followers'").Scan(&tableName)
	if err != nil {
		// Create followers table if it doesn't exist
		_, err = db.Exec(`
			CREATE TABLE IF NOT EXISTS followers (
				follower_id INTEGER NOT NULL,
				following_id INTEGER NOT NULL,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (follower_id, following_id),
				FOREIGN KEY (follower_id) REFERENCES users (id) ON DELETE CASCADE,
				FOREIGN KEY (following_id) REFERENCES users (id) ON DELETE CASCADE
			)
		`)
		if err != nil {
			return fmt.Errorf("failed to create followers table: %w", err)
		}
	}

	// Check if already following
	query = `SELECT follower_id FROM followers WHERE follower_id = ? AND following_id = ?`
	row = db.QueryRow(query, followerID, followingID)
	err = row.Scan(&id)
	if err == nil {
		return fmt.Errorf("already following this user")
	}

	// Create the follow relationship
	query = `INSERT INTO followers (follower_id, following_id) VALUES (?, ?)`
	_, err = db.Exec(query, followerID, followingID)
	if err != nil {
		return err
	}

	return nil
}

// IsFollowing checks if a user is following another user
func (db *DB) IsFollowing(followerID, followingID int) (bool, error) {
	// Check if followers table exists
	var tableName string
	err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='followers'").Scan(&tableName)
	if err != nil {
		// If table doesn't exist, user can't be following anyone
		return false, nil
	}

	// Check if following relationship exists
	query := `SELECT 1 FROM followers WHERE follower_id = ? AND following_id = ?`
	row := db.QueryRow(query, followerID, followingID)
	var exists int
	err = row.Scan(&exists)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, err
	}

	return true, nil
}

// UnfollowUser removes a follower relationship between two users
func (db *DB) UnfollowUser(followerID, followingID int) error {
	// Check if followers table exists
	var tableName string
	err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='followers'").Scan(&tableName)
	if err != nil {
		return fmt.Errorf("not following this user")
	}

	// Delete the follow relationship
	query := `DELETE FROM followers WHERE follower_id = ? AND following_id = ?`
	result, err := db.Exec(query, followerID, followingID)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return fmt.Errorf("not following this user")
	}

	return nil
}

// FollowRequest represents a follow request
type FollowRequest struct {
	ID          int64
	FollowerID  int64
	FollowingID int64
	CreatedAt   time.Time
}

// CreateFollowRequest creates a new follow request
func (db *DB) CreateFollowRequest(followerID, followingID int64) (int64, error) {
	// Check if follow_requests table exists
	var tableName string
	err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='follow_requests'").Scan(&tableName)
	if err != nil {
		// Create follow_requests table if it doesn't exist - using correct column names
		_, err = db.Exec(`
			CREATE TABLE IF NOT EXISTS follow_requests (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				requester_id INTEGER NOT NULL,
				requested_id INTEGER NOT NULL,
				status TEXT NOT NULL DEFAULT 'pending',
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				UNIQUE(requester_id, requested_id),
				FOREIGN KEY (requester_id) REFERENCES users (id) ON DELETE CASCADE,
				FOREIGN KEY (requested_id) REFERENCES users (id) ON DELETE CASCADE
			)
		`)
		if err != nil {
			return 0, fmt.Errorf("failed to create follow_requests table: %w", err)
		}
	}

	// Insert the follow request - using correct column names
	query := `INSERT INTO follow_requests (requester_id, requested_id) VALUES (?, ?)`
	result, err := db.Exec(query, followerID, followingID)
	if err != nil {
		return 0, err
	}

	return result.LastInsertId()
}

// CheckFollowRequestExists checks if a follow request already exists
func (db *DB) CheckFollowRequestExists(followerID, followingID int64) (bool, error) {
	// Check if follow_requests table exists
	var tableName string
	err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='follow_requests'").Scan(&tableName)
	if err != nil {
		// If table doesn't exist, no request can exist
		return false, nil
	}

	// Check if request exists - using correct column names
	query := `SELECT 1 FROM follow_requests WHERE requester_id = ? AND requested_id = ?`
	row := db.QueryRow(query, followerID, followingID)
	var exists int
	err = row.Scan(&exists)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, err
	}

	return true, nil
}

// GetFollowRequest retrieves a follow request by ID
func (db *DB) GetFollowRequest(requestID int64) (*FollowRequest, error) {
	// Check if follow_requests table exists
	var tableName string
	err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='follow_requests'").Scan(&tableName)
	if err != nil {
		return nil, fmt.Errorf("follow request not found")
	}

	// Get the follow request - using correct column names
	query := `SELECT id, requester_id, requested_id, created_at FROM follow_requests WHERE id = ?`
	row := db.QueryRow(query, requestID)

	var request FollowRequest
	err = row.Scan(&request.ID, &request.FollowerID, &request.FollowingID, &request.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("follow request not found")
		}
		return nil, err
	}

	return &request, nil
}

// GetUserFollowRequests gets all follow requests for a user
func (db *DB) GetUserFollowRequests(userID int64) ([]*FollowRequest, error) {
	// Check if follow_requests table exists
	var tableName string
	err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='follow_requests'").Scan(&tableName)
	if err != nil {
		// If table doesn't exist, return empty list
		return []*FollowRequest{}, nil
	}

	// Get all follow requests for the user - using correct column names
	query := `SELECT id, requester_id, requested_id, created_at FROM follow_requests WHERE requested_id = ?`
	rows, err := db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var requests []*FollowRequest
	for rows.Next() {
		var request FollowRequest
		err = rows.Scan(&request.ID, &request.FollowerID, &request.FollowingID, &request.CreatedAt)
		if err != nil {
			return nil, err
		}
		requests = append(requests, &request)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return requests, nil
}

// AcceptFollowRequest accepts a follow request and creates a follow relationship
func (db *DB) AcceptFollowRequest(requestID int64) error {
	// Start a transaction
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Get the follow request - using correct column names
	query := `SELECT requester_id, requested_id FROM follow_requests WHERE id = ?`
	row := tx.QueryRow(query, requestID)

	var followerID, followingID int64
	err = row.Scan(&followerID, &followingID)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("follow request not found")
		}
		return err
	}

	// Create the follow relationship
	query = `INSERT INTO followers (follower_id, following_id) VALUES (?, ?)`
	_, err = tx.Exec(query, followerID, followingID)
	if err != nil {
		return err
	}

	// Delete the follow request
	query = `DELETE FROM follow_requests WHERE id = ?`
	_, err = tx.Exec(query, requestID)
	if err != nil {
		return err
	}

	// Commit the transaction
	if err = tx.Commit(); err != nil {
		return err
	}

	return nil
}

// RejectFollowRequest rejects and deletes a follow request
func (db *DB) RejectFollowRequest(requestID int64) error {
	// Delete the follow request
	query := `DELETE FROM follow_requests WHERE id = ?`
	result, err := db.Exec(query, requestID)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return fmt.Errorf("follow request not found")
	}

	return nil
}

// AutoApproveFollowRequests automatically approves all pending follow requests for a user
// This is used when a user changes their account from private to public
func (db *DB) AutoApproveFollowRequests(userID int64) error {
	// Check if follow_requests table exists first
	var tableName string
	err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='follow_requests'").Scan(&tableName)
	if err != nil {
		// If follow_requests table doesn't exist, no requests to process
		return nil
	}

	// Get all pending follow requests for this user
	followRequests, err := db.GetUserFollowRequests(userID)
	if err != nil {
		return fmt.Errorf("failed to get follow requests: %w", err)
	}

	// If no pending requests, nothing to do
	if len(followRequests) == 0 {
		return nil
	}

	// Start a transaction to ensure all requests are processed atomically
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Process each follow request
	for _, request := range followRequests {
		// Check if follow relationship already exists to avoid duplicates
		var existingCount int
		err = tx.QueryRow(`SELECT COUNT(*) FROM followers WHERE follower_id = ? AND following_id = ?`,
			request.FollowerID, request.FollowingID).Scan(&existingCount)
		if err != nil {
			return fmt.Errorf("failed to check existing follow relationship: %w", err)
		}

		// Only create the follow relationship if it doesn't already exist
		if existingCount == 0 {
			_, err = tx.Exec(`INSERT INTO followers (follower_id, following_id) VALUES (?, ?)`,
				request.FollowerID, request.FollowingID)
			if err != nil {
				return fmt.Errorf("failed to create follow relationship: %w", err)
			}
		}

		// Delete the follow request
		_, err = tx.Exec(`DELETE FROM follow_requests WHERE id = ?`, request.ID)
		if err != nil {
			return fmt.Errorf("failed to delete follow request: %w", err)
		}

		// Create a notification for the requester
		// Get the user's name for the notification
		var firstName, lastName string
		err = tx.QueryRow(`SELECT first_name, last_name FROM users WHERE id = ?`, userID).Scan(&firstName, &lastName)
		if err != nil {
			// Log warning but continue processing other requests
			fmt.Printf("Warning: Failed to get user name for notification (user %d): %v\n", userID, err)
			continue
		}

		notificationContent := fmt.Sprintf("%s %s accepted your follow request", firstName, lastName)

		// Insert notification
		_, err = tx.Exec(`
			INSERT INTO notifications (user_id, sender_id, type, content, reference_id, created_at) 
			VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
			request.FollowerID, userID, "follow_accepted", notificationContent, request.ID)
		if err != nil {
			// Log warning but continue processing other requests
			fmt.Printf("Warning: Failed to create notification for user %d: %v\n", request.FollowerID, err)
		}
	}

	// Commit the transaction
	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	fmt.Printf("Auto-approved %d follow requests for user %d\n", len(followRequests), userID)
	return nil
}

// DeletePost removes a post and its associated comments from the database
func (db *DB) DeletePost(postID int64) error {
	// Start a transaction to ensure data consistency
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// First delete all comments associated with the post
	_, err = tx.Exec("DELETE FROM comments WHERE post_id = ?", postID)
	if err != nil {
		return err
	}

	// Then delete the post itself
	result, err := tx.Exec("DELETE FROM posts WHERE id = ?", postID)
	if err != nil {
		return err
	}

	// Check if any row was affected
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return fmt.Errorf("post with ID %d not found", postID)
	}

	// Commit the transaction
	return tx.Commit()
}

// GetCommentByID retrieves a comment by its ID
func (db *DB) GetCommentByID(commentID int64) (map[string]interface{}, error) {
	row := db.QueryRow(`
		SELECT 
			c.id, c.post_id, c.user_id, c.content, c.image_url, c.created_at, c.vote_count,
			u.first_name, u.last_name, u.avatar
		FROM comments c
		JOIN users u ON c.user_id = u.id
		WHERE c.id = ?
	`, commentID)

	var (
		id        int64
		postID    int64
		userID    int64
		content   string
		imageURL  *string
		createdAt string
		voteCount int
		firstName string
		lastName  string
		avatar    *string
	)

	err := row.Scan(&id, &postID, &userID, &content, &imageURL, &createdAt, &voteCount, &firstName, &lastName, &avatar)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("comment with ID %d not found", commentID)
		}
		return nil, err
	}

	// Convert to map
	comment := map[string]interface{}{
		"id":         id,
		"post_id":    postID,
		"user_id":    userID,
		"content":    content,
		"created_at": createdAt,
		"vote_count": voteCount,
		"author": map[string]interface{}{
			"id":         userID,
			"first_name": firstName,
			"last_name":  lastName,
		},
	}

	if imageURL != nil {
		comment["image_url"] = *imageURL
	}

	if avatar != nil {
		comment["author"].(map[string]interface{})["avatar"] = *avatar
	}

	return comment, nil
}

// DeleteComment removes a comment from the database
func (db *DB) DeleteComment(commentID int64) error {
	result, err := db.Exec("DELETE FROM comments WHERE id = ?", commentID)
	if err != nil {
		return err
	}

	// Check if any row was affected
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return fmt.Errorf("comment with ID %d not found", commentID)
	}

	return nil
}

// Vote adds or updates a user's vote on a post or comment
func (db *DB) Vote(userID int, contentID int64, contentType string, voteType int) error {
	// Start a transaction
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Check if user has already voted
	var existingVoteType int
	var voteExists bool
	existingVoteQuery := `SELECT vote_type FROM votes WHERE user_id = ? AND content_id = ? AND content_type = ?`
	err = tx.QueryRow(existingVoteQuery, userID, contentID, contentType).Scan(&existingVoteType)
	if err == nil {
		voteExists = true
	} else if err != sql.ErrNoRows {
		return err
	}

	if voteExists {
		// If vote type is the same, remove the vote (toggle off)
		if existingVoteType == voteType {
			_, err = tx.Exec(`DELETE FROM votes WHERE user_id = ? AND content_id = ? AND content_type = ?`,
				userID, contentID, contentType)
			if err != nil {
				return err
			}

			// Update vote counts based on content type
			switch contentType {
			case "post":
				if voteType == 1 {
					_, err = tx.Exec(`UPDATE posts SET upvotes = upvotes - 1 WHERE id = ?`, contentID)
				} else {
					_, err = tx.Exec(`UPDATE posts SET downvotes = downvotes - 1 WHERE id = ?`, contentID)
				}
			case "group_post":
				if voteType == 1 {
					_, err = tx.Exec(`UPDATE group_posts SET upvotes = upvotes - 1 WHERE id = ?`, contentID)
				} else {
					_, err = tx.Exec(`UPDATE group_posts SET downvotes = downvotes - 1 WHERE id = ?`, contentID)
				}
			case "group_post_comment":
				if voteType == 1 {
					_, err = tx.Exec(`UPDATE group_post_comments SET upvotes = upvotes - 1, vote_count = vote_count - 1 WHERE id = ?`, contentID)
				} else {
					_, err = tx.Exec(`UPDATE group_post_comments SET downvotes = downvotes - 1, vote_count = vote_count + 1 WHERE id = ?`, contentID)
				}
			case "comment":
				_, err = tx.Exec(`UPDATE comments SET vote_count = vote_count - ? WHERE id = ?`, voteType, contentID)
			}
			if err != nil {
				return err
			}
		} else {
			// Change vote type
			_, err = tx.Exec(`UPDATE votes SET vote_type = ? WHERE user_id = ? AND content_id = ? AND content_type = ?`,
				voteType, userID, contentID, contentType)
			if err != nil {
				return err
			}

			// Update vote counts based on content type
			switch contentType {
			case "post":
				if voteType == 1 {
					_, err = tx.Exec(`UPDATE posts SET upvotes = upvotes + 1, downvotes = downvotes - 1 WHERE id = ?`, contentID)
				} else {
					_, err = tx.Exec(`UPDATE posts SET upvotes = upvotes - 1, downvotes = downvotes + 1 WHERE id = ?`, contentID)
				}
			case "group_post":
				if voteType == 1 {
					_, err = tx.Exec(`UPDATE group_posts SET upvotes = upvotes + 1, downvotes = downvotes - 1 WHERE id = ?`, contentID)
				} else {
					_, err = tx.Exec(`UPDATE group_posts SET upvotes = upvotes - 1, downvotes = downvotes + 1 WHERE id = ?`, contentID)
				}
			case "group_post_comment":
				if voteType == 1 {
					_, err = tx.Exec(`UPDATE group_post_comments SET upvotes = upvotes + 1, downvotes = downvotes - 1, vote_count = vote_count + 2 WHERE id = ?`, contentID)
				} else {
					_, err = tx.Exec(`UPDATE group_post_comments SET upvotes = upvotes - 1, downvotes = downvotes + 1, vote_count = vote_count - 2 WHERE id = ?`, contentID)
				}
			case "comment":
				_, err = tx.Exec(`UPDATE comments SET vote_count = vote_count + ? WHERE id = ?`, voteType*2, contentID)
			}
			if err != nil {
				return err
			}
		}
	} else {
		// Create new vote
		_, err = tx.Exec(`INSERT INTO votes (user_id, content_id, content_type, vote_type) VALUES (?, ?, ?, ?)`,
			userID, contentID, contentType, voteType)
		if err != nil {
			return err
		}

		// Update vote counts based on content type
		switch contentType {
		case "post":
			if voteType == 1 {
				_, err = tx.Exec(`UPDATE posts SET upvotes = upvotes + 1 WHERE id = ?`, contentID)
			} else {
				_, err = tx.Exec(`UPDATE posts SET downvotes = downvotes + 1 WHERE id = ?`, contentID)
			}
		case "group_post":
			if voteType == 1 {
				_, err = tx.Exec(`UPDATE group_posts SET upvotes = upvotes + 1 WHERE id = ?`, contentID)
			} else {
				_, err = tx.Exec(`UPDATE group_posts SET downvotes = downvotes + 1 WHERE id = ?`, contentID)
			}
		case "group_post_comment":
			if voteType == 1 {
				_, err = tx.Exec(`UPDATE group_post_comments SET upvotes = upvotes + 1, vote_count = vote_count + 1 WHERE id = ?`, contentID)
			} else {
				_, err = tx.Exec(`UPDATE group_post_comments SET downvotes = downvotes + 1, vote_count = vote_count - 1 WHERE id = ?`, contentID)
			}
		case "comment":
			_, err = tx.Exec(`UPDATE comments SET vote_count = vote_count + ? WHERE id = ?`, voteType, contentID)
		}
		if err != nil {
			return err
		}
	}

	// Commit transaction
	return tx.Commit()
}

// GetUserVote returns a user's vote for content (post or comment)
func (db *DB) GetUserVote(userID int, contentID int64, contentType string) (int, error) {
	query := `SELECT vote_type FROM votes WHERE user_id = ? AND content_id = ? AND content_type = ?`
	var voteType int
	err := db.QueryRow(query, userID, contentID, contentType).Scan(&voteType)
	if err == sql.ErrNoRows {
		return 0, nil // User hasn't voted
	}
	if err != nil {
		return 0, err
	}
	return voteType, nil
}

// For backward compatibility - uses the generalized Vote function
func (db *DB) VotePost(userID int, postID int64, voteType int) error {
	return db.Vote(userID, postID, "post", voteType)
}

// GetCommentsByPostIDWithUserVotes retrieves comments for a specific post with user votes
func (db *DB) GetCommentsByPostIDWithUserVotes(postID int64, userID int) ([]map[string]interface{}, error) {
	// First get all comments
	comments, err := db.GetCommentsByPostID(postID)
	if err != nil {
		return nil, err
	}

	// Then get user votes for each comment
	for i, comment := range comments {
		commentID, ok := comment["id"].(int64)
		if !ok {
			continue
		}

		// Get user's vote on this comment
		userVote, err := db.GetUserVote(userID, commentID, "comment")
		if err == nil {
			comments[i]["user_vote"] = userVote
		}
	}

	return comments, nil
}

// SearchUsers searches for users based on the provided search term
func (db *DB) SearchUsers(searchTerm string) ([]map[string]interface{}, error) {
	query := `
		SELECT 
			id, email, first_name, last_name, avatar, nickname, about_me, is_public 
		FROM 
			users 
		WHERE 
			LOWER(first_name) LIKE ? OR 
			LOWER(last_name) LIKE ? OR 
			LOWER(first_name || ' ' || last_name) LIKE ? OR
			LOWER(nickname) LIKE ? OR
			LOWER(email) LIKE ?
		ORDER BY
			CASE 
				WHEN LOWER(first_name) = LOWER(?) THEN 1
				WHEN LOWER(last_name) = LOWER(?) THEN 2
				WHEN LOWER(nickname) = LOWER(?) THEN 3
				ELSE 4
			END,
			first_name ASC,
			last_name ASC
		LIMIT 20
	`

	// Remove '%' from searchTerm for exact match in ORDER BY clause
	exactTerm := strings.TrimPrefix(strings.TrimSuffix(searchTerm, "%"), "%")

	rows, err := db.Query(
		query,
		searchTerm,
		searchTerm,
		searchTerm,
		searchTerm,
		searchTerm,
		exactTerm,
		exactTerm,
		exactTerm,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []map[string]interface{}

	for rows.Next() {
		var id int
		var email, firstName, lastName string
		var avatar, nickname, aboutMe sql.NullString
		var isPublic bool

		err := rows.Scan(&id, &email, &firstName, &lastName, &avatar, &nickname, &aboutMe, &isPublic)
		if err != nil {
			return nil, err
		}

		user := map[string]interface{}{
			"id":         id,
			"email":      email,
			"first_name": firstName,
			"last_name":  lastName,
			"is_public":  isPublic,
		}

		if avatar.Valid {
			user["avatar"] = avatar.String
		} else {
			user["avatar"] = "" // Provide default empty string for consistency
		}
		if nickname.Valid {
			user["nickname"] = nickname.String
		}
		if aboutMe.Valid {
			user["about_me"] = aboutMe.String
		}

		// Include all users in search results, regardless of privacy setting
		users = append(users, user)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return users, nil
}

// CancelFollowRequest cancels a follow request created by the follower
func (db *DB) CancelFollowRequest(followerID, followingID int64) error {
	// Check if follow_requests table exists
	var tableName string
	err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='follow_requests'").Scan(&tableName)
	if err != nil {
		return fmt.Errorf("follow request not found")
	}

	// Delete the follow request - using correct column names
	query := `DELETE FROM follow_requests WHERE requester_id = ? AND requested_id = ?`
	result, err := db.Exec(query, followerID, followingID)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return fmt.Errorf("follow request not found")
	}

	return nil
}

// CheckFollowRequestExistsById checks if a follow request exists by its ID
func (db *DB) CheckFollowRequestExistsById(requestID int64) (bool, error) {
	// Check if follow_requests table exists
	var tableName string
	err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='follow_requests'").Scan(&tableName)
	if err != nil {
		// If table doesn't exist, no request can exist
		return false, nil
	}

	// Check if request exists by ID
	query := `SELECT 1 FROM follow_requests WHERE id = ?`
	row := db.QueryRow(query, requestID)
	var exists int
	err = row.Scan(&exists)
	if err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, err
	}

	return true, nil
}
