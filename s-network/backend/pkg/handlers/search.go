package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
)

// UserSearchHandler handles search requests for users
func UserSearchHandler(w http.ResponseWriter, r *http.Request) {
	// Allow CORS preflight
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Get the search query from URL parameters
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}

	// Trim whitespace and validate query length
	query = strings.TrimSpace(query)
	if len(query) < 2 {
		// Return empty results for queries less than 2 characters
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"users": []interface{}{},
		})
		return
	}

	// Format the search term for SQL LIKE pattern
	searchTerm := "%" + strings.ToLower(query) + "%"

	// Search for users matching the query
	users, err := db.SearchUsers(searchTerm)
	if err != nil {
		http.Error(w, "Error searching for users: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Return the search results
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"users": users,
	})
}

// GetUsersProfile returns the profile of another user by their ID
func GetUsersProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	vars := mux.Vars(r)
	userIDStr := vars["id"]

	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	user, err := db.GetUserById(userID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	delete(user, "password") // sanitize response

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}
