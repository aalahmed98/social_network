package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

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
