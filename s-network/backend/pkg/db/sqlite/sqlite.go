package sqlite

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/sqlite3"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/mattn/go-sqlite3"
)

// DB represents the database connection
type DB struct {
	*sql.DB
}

// New creates a new database connection
func New(dbPath string) (*DB, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	return &DB{db}, nil
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
	query := `INSERT INTO users (email, password, first_name, last_name, date_of_birth, avatar, nickname, about_me) 
			  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	
	result, err := db.Exec(query, email, password, firstName, lastName, dob, avatar, nickname, aboutMe)
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
		"id":          id,
		"email":       email,
		"password":    password,
		"first_name":  firstName,
		"last_name":   lastName,
		"date_of_birth": dob,
		"is_public":   isPublic,
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
		"id":          id,
		"email":       email,
		"password":    password,
		"first_name":  firstName,
		"last_name":   lastName,
		"date_of_birth": dob,
		"is_public":   isPublic,
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