package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"s-network/backend/pkg/db/sqlite"
)

// User represents the user profile data.
type User struct {
	ID        int    `json:"id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

// SearchUsers handles the search endpoint.
// Modified the parameter type to *sqlite.DB to match your initialization
func SearchUsers(db *sqlite.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Handle preflight OPTIONS requests
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		// Retrieve the search query.
		query := r.URL.Query().Get("q")
		if strings.TrimSpace(query) == "" {
			http.Error(w, "Search query cannot be empty", http.StatusBadRequest)
			return
		}

		// Create wildcard search strings.
		searchTerm := "%" + query + "%"

		// SQL query that searches both first and last name fields.
		sqlQuery := `
			SELECT id, first_name, last_name 
			FROM users 
			WHERE first_name LIKE ? OR last_name LIKE ? 
			ORDER BY first_name ASC, last_name ASC
		`

		// Execute the query. It is assumed that sqlite.DB provides a Query method.
		rows, err := db.Query(sqlQuery, searchTerm, searchTerm)
		if err != nil {
			log.Printf("Error querying database: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		// Iterate over the results.
		var users []User
		for rows.Next() {
			var user User
			if err := rows.Scan(&user.ID, &user.FirstName, &user.LastName); err != nil {
				log.Printf("Error scanning row: %v", err)
				http.Error(w, "Internal server error", http.StatusInternalServerError)
				return
			}
			users = append(users, user)
		}

		// Return the results as JSON.
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(users); err != nil {
			log.Printf("Error encoding JSON: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}
}
