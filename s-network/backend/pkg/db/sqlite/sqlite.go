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
	*sql.DB // Embedding a pointer to sql.DB
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

// CreatePost adds a new post to the database
func (db *DB) CreatePost(userID int, content string, imageURL string, privacy string, allowedFollowers []int) (int64, error) {
	tx, err := db.Begin()
	if err != nil {
		return 0, err
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	// Insert post
	query := `INSERT INTO posts (user_id, content, image_url, privacy) 
			  VALUES (?, ?, ?, ?)`
	
	result, err := tx.Exec(query, userID, content, imageURL, privacy)
	if err != nil {
		return 0, err
	}

	postID, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}

	// If it's a private post, add allowed followers
	if privacy == "private" && len(allowedFollowers) > 0 {
		// Insert private access records for each allowed follower
		for _, followerID := range allowedFollowers {
			_, err := tx.Exec(
				"INSERT INTO post_access (post_id, follower_id) VALUES (?, ?)",
				postID, followerID,
			)
			if err != nil {
				return 0, err
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	return postID, nil
}

// GetPostByID retrieves a post by ID
func (db *DB) GetPostByID(postID int64) (map[string]interface{}, error) {
	query := `
		SELECT p.id, p.user_id, p.content, p.image_url, p.privacy, p.created_at, p.updated_at,
			   u.first_name, u.last_name, u.avatar
		FROM posts p
		JOIN users u ON p.user_id = u.id
		WHERE p.id = ?
	`
	
	row := db.QueryRow(query, postID)
	
	var (
		id          int64
		userID      int64
		content     string
		imageURL    *string
		privacy     string
		createdAt   string
		updatedAt   string
		firstName   string
		lastName    string
		avatar      *string
	)
	
	err := row.Scan(&id, &userID, &content, &imageURL, &privacy, &createdAt, &updatedAt, &firstName, &lastName, &avatar)
	if err != nil {
		return nil, err
	}

	// Build the post map
	post := map[string]interface{}{
		"id":          id,
		"user_id":     userID,
		"content":     content,
		"privacy":     privacy,
		"created_at":  createdAt,
		"updated_at":  updatedAt,
		"is_author":   false, // This will be set by the handler
		"author": map[string]interface{}{
			"id":         userID,
			"first_name": firstName,
			"last_name":  lastName,
		},
	}

	if imageURL != nil {
		post["image_url"] = *imageURL
	}

	if avatar != nil {
		post["author"].(map[string]interface{})["avatar"] = *avatar
	}

	return post, nil
}

// GetPosts retrieves posts based on the current user and requested filters
func (db *DB) GetPosts(userID int, page, limit int) ([]map[string]interface{}, error) {
	offset := (page - 1) * limit

	// Check if followers table exists
	var tableName string
	err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='followers'").Scan(&tableName)
	if err != nil {
		// If followers table doesn't exist, just get public posts and user's own posts
		query := `
			SELECT p.id, p.user_id, p.content, p.image_url, p.privacy, p.created_at, p.updated_at,
				u.first_name, u.last_name, u.avatar
			FROM posts p
			JOIN users u ON p.user_id = u.id
			WHERE 
				p.privacy = 'public'
				OR p.user_id = ?
			ORDER BY p.created_at DESC
			LIMIT ? OFFSET ?
		`
		
		rows, err := db.Query(query, userID, limit, offset)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		
		var posts []map[string]interface{}
		
		for rows.Next() {
			var id, userID int64
			var content, privacy, createdAt, updatedAt, firstName, lastName string
			var imageURL, avatar sql.NullString
			
			err := rows.Scan(&id, &userID, &content, &imageURL, &privacy, 
				&createdAt, &updatedAt, &firstName, &lastName, &avatar)
			if err != nil {
				return nil, err
			}
			
			post := map[string]interface{}{
				"id":         id,
				"user_id":    userID,
				"content":    content,
				"privacy":    privacy,
				"created_at": createdAt,
				"updated_at": updatedAt,
				"author": map[string]interface{}{
					"first_name": firstName,
					"last_name":  lastName,
				},
			}
			
			if imageURL.Valid {
				post["image_url"] = imageURL.String
			}
			
			if avatar.Valid {
				post["author"].(map[string]interface{})["avatar"] = avatar.String
			}
			
			posts = append(posts, post)
		}
		
		return posts, nil
	}

	// If followers table exists, use complex query
	query := `
		SELECT p.id, p.user_id, p.content, p.image_url, p.privacy, p.created_at, p.updated_at,
			   u.first_name, u.last_name, u.avatar
		FROM posts p
		JOIN users u ON p.user_id = u.id
		WHERE 
			p.privacy = 'public'
			OR (p.privacy = 'almost_private' AND p.user_id IN (
				SELECT following_id FROM followers WHERE follower_id = ?
			))
			OR (p.privacy = 'private' AND p.id IN (
				SELECT post_id FROM post_access WHERE follower_id = ?
			))
			OR p.user_id = ?
		ORDER BY p.created_at DESC
		LIMIT ? OFFSET ?
	`
	
	rows, err := db.Query(query, userID, userID, userID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var posts []map[string]interface{}
	
	for rows.Next() {
		var id, userID int64
		var content, privacy, createdAt, updatedAt, firstName, lastName string
		var imageURL, avatar sql.NullString
		
		err := rows.Scan(&id, &userID, &content, &imageURL, &privacy, 
			&createdAt, &updatedAt, &firstName, &lastName, &avatar)
		if err != nil {
			return nil, err
		}
		
		post := map[string]interface{}{
			"id":         id,
			"user_id":    userID,
			"content":    content,
			"privacy":    privacy,
			"created_at": createdAt,
			"updated_at": updatedAt,
			"author": map[string]interface{}{
				"first_name": firstName,
				"last_name":  lastName,
			},
		}
		
		if imageURL.Valid {
			post["image_url"] = imageURL.String
		}
		
		if avatar.Valid {
			post["author"].(map[string]interface{})["avatar"] = avatar.String
		}
		
		posts = append(posts, post)
	}
	
	return posts, nil
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
			c.id, c.post_id, c.user_id, c.content, c.image_url, c.created_at,
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
			firstName string
			lastName  string
			avatar    *string
		)
		
		err := rows.Scan(&id, &postID, &userID, &content, &imageURL, &createdAt, &firstName, &lastName, &avatar)
		if err != nil {
			return nil, err
		}
		
		comment := map[string]interface{}{
			"id":         id,
			"post_id":    postID,
			"user_id":    userID,
			"content":    content,
			"created_at": createdAt,
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
			c.id, c.post_id, c.user_id, c.content, c.image_url, c.created_at,
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
		firstName string
		lastName  string
		avatar    *string
	)

	err := row.Scan(&id, &postID, &userID, &content, &imageURL, &createdAt, &firstName, &lastName, &avatar)
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
		"user": map[string]interface{}{
			"id":         userID,
			"first_name": firstName,
			"last_name":  lastName,
		},
	}

	if imageURL != nil {
		comment["image_url"] = *imageURL
	}

	if avatar != nil {
		comment["user"].(map[string]interface{})["avatar"] = *avatar
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