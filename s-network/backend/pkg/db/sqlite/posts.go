package sqlite

import (
	"database/sql"
)

// CreatePost adds a new post to the database with title support
func (db *DB) CreatePost(userID int, title string, content string, imageURL string, privacy string, allowedFollowers []int) (int64, error) {
	// Ensure tables exist
	if err := db.ensurePostTablesExist(); err != nil {
		return 0, err
	}

	tx, err := db.Begin()
	if err != nil {
		return 0, err
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	// Insert post with title
	query := `INSERT INTO posts (user_id, title, content, image_url, privacy) 
			  VALUES (?, ?, ?, ?, ?)`
	
	result, err := tx.Exec(query, userID, title, content, imageURL, privacy)
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

// ensurePostTablesExist makes sure all tables needed for posts exist
func (db *DB) ensurePostTablesExist() error {
	// This is just a safety check in case InitializeTables wasn't called
	// Create posts table if it doesn't exist
	_, err := db.Exec(`
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
	
	return err
}

// GetPost retrieves a specific post by ID with title support
func (db *DB) GetPost(postID int64) (map[string]interface{}, error) {
	// Ensure tables exist
	if err := db.ensurePostTablesExist(); err != nil {
		return nil, err
	}

	query := `
		SELECT p.id, p.user_id, p.title, p.content, p.image_url, p.privacy, p.created_at, p.updated_at, 
		       p.upvotes, p.downvotes, u.first_name, u.last_name, u.avatar,
		       (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
		FROM posts p
		JOIN users u ON p.user_id = u.id
		WHERE p.id = ?
	`
	
	row := db.QueryRow(query, postID)
	
	var id, userID int64
	var title, content, privacy, createdAt, updatedAt string
	var imageURL, avatar sql.NullString
	var firstName, lastName string
	var upvotes, downvotes, commentCount int
	
	err := row.Scan(&id, &userID, &title, &content, &imageURL, &privacy, &createdAt, &updatedAt, 
	                &upvotes, &downvotes, &firstName, &lastName, &avatar, &commentCount)
	if err != nil {
		return nil, err
	}

	post := map[string]interface{}{
		"id":         id,
		"user_id":    userID,
		"title":      title,
		"content":    content,
		"privacy":    privacy,
		"created_at": createdAt,
		"updated_at": updatedAt,
		"upvotes":    upvotes,
		"downvotes":  downvotes,
		"comment_count": commentCount,
		"author": map[string]interface{}{
			"id":         userID,
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

	return post, nil
}

// GetPosts retrieves posts for the authenticated user with title support
func (db *DB) GetPosts(userID int, page, limit int) ([]map[string]interface{}, error) {
	// Ensure tables exist
	if err := db.ensurePostTablesExist(); err != nil {
		return nil, err
	}

	offset := (page - 1) * limit

	// Check if tables exist and construct appropriate query
	var query string
	var args []interface{}

	// Check if followers table exists
	var followersExistQuery = "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='followers'"
	var followersCount int
	err := db.QueryRow(followersExistQuery).Scan(&followersCount)
	followersExist := err == nil && followersCount > 0

	// Check if post_access table exists
	var accessExistQuery = "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='post_access'"
	var accessCount int
	err = db.QueryRow(accessExistQuery).Scan(&accessCount)
	accessExist := err == nil && accessCount > 0

	// Build query based on which tables exist
	if !followersExist && !accessExist {
		// Basic query - just public posts and user's own posts
		query = `
			SELECT p.id, p.user_id, p.title, p.content, p.image_url, p.privacy, p.created_at, p.updated_at, 
				p.upvotes, p.downvotes, u.first_name, u.last_name, u.avatar,
				(SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
			FROM posts p
			JOIN users u ON p.user_id = u.id
			WHERE 
				p.privacy = 'public'
				OR p.user_id = ?
			ORDER BY p.created_at DESC
			LIMIT ? OFFSET ?
		`
		args = []interface{}{userID, limit, offset}
	} else if followersExist && !accessExist {
		// Query with followers table
		query = `
			SELECT p.id, p.user_id, p.title, p.content, p.image_url, p.privacy, p.created_at, p.updated_at, 
				p.upvotes, p.downvotes, u.first_name, u.last_name, u.avatar,
				(SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
			FROM posts p
			JOIN users u ON p.user_id = u.id
			WHERE 
				p.privacy = 'public'
				OR p.user_id = ?
				OR (p.privacy = 'almost_private' AND EXISTS (
					SELECT 1 FROM followers f WHERE f.follower_id = ? AND f.following_id = p.user_id
				))
			ORDER BY p.created_at DESC
			LIMIT ? OFFSET ?
		`
		args = []interface{}{userID, userID, limit, offset}
	} else if !followersExist && accessExist {
		// Query with post_access table
		query = `
			SELECT p.id, p.user_id, p.title, p.content, p.image_url, p.privacy, p.created_at, p.updated_at, 
				p.upvotes, p.downvotes, u.first_name, u.last_name, u.avatar,
				(SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
			FROM posts p
			JOIN users u ON p.user_id = u.id
			WHERE 
				p.privacy = 'public'
				OR p.user_id = ?
				OR (p.privacy = 'private' AND EXISTS (
					SELECT 1 FROM post_access pa WHERE pa.post_id = p.id AND pa.follower_id = ?
				))
			ORDER BY p.created_at DESC
			LIMIT ? OFFSET ?
		`
		args = []interface{}{userID, userID, limit, offset}
	} else {
		// Full query with both tables
		query = `
			SELECT p.id, p.user_id, p.title, p.content, p.image_url, p.privacy, p.created_at, p.updated_at, 
				p.upvotes, p.downvotes, u.first_name, u.last_name, u.avatar,
				(SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
			FROM posts p
			JOIN users u ON p.user_id = u.id
			WHERE 
				p.privacy = 'public'
				OR p.user_id = ?
				OR (p.privacy = 'almost_private' AND EXISTS (
					SELECT 1 FROM followers f WHERE f.follower_id = ? AND f.following_id = p.user_id
				))
				OR (p.privacy = 'private' AND EXISTS (
					SELECT 1 FROM post_access pa WHERE pa.post_id = p.id AND pa.follower_id = ?
				))
			ORDER BY p.created_at DESC
			LIMIT ? OFFSET ?
		`
		args = []interface{}{userID, userID, userID, limit, offset}
	}
	
	// Execute the query
	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	posts := []map[string]interface{}{}

	for rows.Next() {
		var id, postUserID int64
		var title, content, privacy, createdAt, updatedAt string
		var imageURL, avatar sql.NullString
		var firstName, lastName string
		var upvotes, downvotes, commentCount int
		
		err := rows.Scan(&id, &postUserID, &title, &content, &imageURL, &privacy, &createdAt, &updatedAt, 
		                 &upvotes, &downvotes, &firstName, &lastName, &avatar, &commentCount)
		if err != nil {
			return nil, err
		}

		post := map[string]interface{}{
			"id":         id,
			"user_id":    postUserID,
			"title":      title,
			"content":    content,
			"privacy":    privacy,
			"created_at": createdAt,
			"updated_at": updatedAt,
			"upvotes":    upvotes,
			"downvotes":  downvotes,
			"comment_count": commentCount,
			"author": map[string]interface{}{
				"id":         postUserID,
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

		// Check user's vote on this post
		userVote, err := db.GetUserVote(userID, id, "post")
		if err == nil {
			post["user_vote"] = userVote
		}

		posts = append(posts, post)
	}

	return posts, nil
} 