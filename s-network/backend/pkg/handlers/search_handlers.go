package handlers

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"strings"

	"s-network/backend/pkg/logger"
)

// UserSearchHandler handles search requests for users
func UserSearchHandler(w http.ResponseWriter, r *http.Request) {
	// Handle CORS preflight request
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Always set content type
	w.Header().Set("Content-Type", "application/json")

	// Get query parameter
	query := r.URL.Query().Get("q")
	if query == "" {
		// Return empty but valid result
		json.NewEncoder(w).Encode(map[string]interface{}{
			"users": []map[string]interface{}{},
			"total": 0,
			"success": true,
		})
		return
	}

	// Use SQL's LIKE operator for case-insensitive search
	// Convert to lowercase for case-insensitive search
	searchTerm := "%" + strings.ToLower(query) + "%"

	// Search in users table using LIKE
	sqlQuery := `
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
		LIMIT 20
	`

	// Use the database from the handlers package
	rows, err := db.Query(sqlQuery, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm)
	if err != nil {
		logger.Printf("Search query error: %v", err)
		// Return empty but valid result
		json.NewEncoder(w).Encode(map[string]interface{}{
			"users": []map[string]interface{}{},
			"total": 0,
			"success": true,
		})
		return
	}
	defer rows.Close()

	// Initialize users array to avoid null in JSON
	users := []map[string]interface{}{}

	for rows.Next() {
		var id int
		var email, firstName, lastName string
		var avatar, nickname, aboutMe *string
		var isPublic bool

		err := rows.Scan(&id, &email, &firstName, &lastName, &avatar, &nickname, &aboutMe, &isPublic)
		if err != nil {
			logger.Printf("Error scanning row: %v", err)
			continue
		}

		// Create username from email (before the @ symbol)
		username := email
		if atIndex := strings.Index(email, "@"); atIndex > 0 {
			username = email[:atIndex]
			// Limit username to 26 characters
			if len(username) > 26 {
				username = username[:26]
			}
		}

		// Count followers for this user
		var followerCount int
		err = db.QueryRow("SELECT COUNT(*) FROM followers WHERE following_id = ?", id).Scan(&followerCount)
		if err != nil {
			logger.Printf("Error counting followers: %v", err)
			followerCount = 0
		}

		// Check if the user is verified (has more than 1000 followers)
		verified := followerCount >= 1000

		user := map[string]interface{}{
			"id":        id,
			"user_id":   id,
			"username":  username,
			"firstName": firstName,
			"lastName":  lastName,
			"followers": followerCount,
			"verified":  verified,
			"name":      firstName + " " + lastName,
		}

		// Add optional fields if they exist
		if avatar != nil && *avatar != "" && *avatar != "/uploads/avatars/default.jpg" {
			avatarURL := *avatar
			
			// For GIFs in search results, add a query parameter to prevent animation
			if strings.ToLower(filepath.Ext(avatarURL)) == ".gif" {
				if !strings.Contains(avatarURL, "?") {
					avatarURL = avatarURL + "?static=1"
				} else {
					avatarURL = avatarURL + "&static=1"
				}
			}
			
			user["avatar"] = avatarURL
			user["profile_pic"] = avatarURL
			user["profilePic"] = avatarURL
		} else {
			// Use a consistent path for default avatars
			defaultAvatar := "/uploads/avatars/default.jpg"
			user["avatar"] = defaultAvatar
			user["profile_pic"] = defaultAvatar
			user["profilePic"] = defaultAvatar
		}

		// Handle nickname properly
		if nickname != nil && *nickname != "" {
			// If user has a nickname, use it as displayName
			user["nickname"] = *nickname
			user["displayName"] = *nickname
			// Also include it in the search results explicitly
			user["nickName"] = *nickname // Adding for compatibility with frontend
		} else {
			// If no nickname, use full name as displayName
			user["displayName"] = firstName + " " + lastName
			user["nickname"] = "" // Ensure we always have a nickname field, even if empty
			user["nickName"] = "" // Adding for compatibility with frontend
		}

		if aboutMe != nil {
			user["description"] = *aboutMe
			user["about_me"] = *aboutMe
			user["aboutMe"] = *aboutMe
		}

		// Add to search results
		users = append(users, user)
	}

	// Return results with a valid format
	response := map[string]interface{}{
		"users":   users,
		"total":   len(users),
		"success": true,
	}
	
	// Make sure we encode a valid response
	if err := json.NewEncoder(w).Encode(response); err != nil {
		logger.Printf("Error encoding search results: %v", err)
		// If encoding fails, return a simple valid response
		w.Write([]byte(`{"users":[],"total":0,"success":true}`))
	}
} 