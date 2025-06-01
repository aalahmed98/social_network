package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"s-network/backend/pkg/db/sqlite"

	"github.com/gorilla/mux"
)

var db *sqlite.DB

// DeleteGroup deletes a group (creator only)
func DeleteGroup(w http.ResponseWriter, r *http.Request) {
	log.Printf("=== DeleteGroup Handler Called ===")
	log.Printf("Request URL: %s", r.URL.String())
	log.Printf("Request Method: %s", r.Method)
	log.Printf("Request Headers: %v", r.Header)

	userID, err := getUserIDFromSession(r)
	if err != nil {
		log.Printf("DeleteGroup: Authentication failed: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Unauthorized - Please log in to delete groups",
		})
		return
	}
	log.Printf("DeleteGroup: User ID from session: %d", userID)

	vars := mux.Vars(r)
	groupIDStr := vars["id"]
	log.Printf("DeleteGroup: Group ID from URL: %s", groupIDStr)

	groupID, err := strconv.ParseInt(groupIDStr, 10, 64)
	if err != nil {
		log.Printf("DeleteGroup: Invalid group ID format: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Invalid group ID format",
		})
		return
	}
	log.Printf("DeleteGroup: Parsed group ID: %d", groupID)

	// Check if the group exists
	group, err := db.GetGroup(groupID)
	if err != nil {
		log.Printf("DeleteGroup: Database error while fetching group: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Database error while fetching group",
		})
		return
	}

	if group == nil {
		log.Printf("DeleteGroup: Group %d not found", groupID)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		response := map[string]string{
			"error": "Group not found or has already been deleted",
		}
		responseBytes, _ := json.Marshal(response)
		log.Printf("DeleteGroup: Sending 404 response: %s", string(responseBytes))
		json.NewEncoder(w).Encode(response)
		return
	}
	log.Printf("DeleteGroup: Found group '%s' (ID: %d, Creator: %d)", group.Name, group.ID, group.CreatorID)

	// Check if the user is the creator
	if group.CreatorID != int64(userID) {
		log.Printf("DeleteGroup: User %d is not the creator of group %d (creator is %d)", userID, groupID, group.CreatorID)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Only the group creator can delete this group",
		})
		return
	}

	// Delete the group
	log.Printf("DeleteGroup: Attempting to delete group %d", groupID)
	err = db.DeleteGroup(groupID)
	if err != nil {
		log.Printf("DeleteGroup: Database error while deleting group: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)

		// Provide more detailed error message based on the error type
		errorMsg := "Failed to delete group"
		if strings.Contains(err.Error(), "foreign key constraint") {
			errorMsg = "Failed to delete group: Some related data could not be deleted. Please try again."
		} else if strings.Contains(err.Error(), "no rows affected") {
			errorMsg = "Failed to delete group: Group may have already been deleted."
		}

		json.NewEncoder(w).Encode(map[string]string{
			"error":   errorMsg,
			"details": err.Error(),
		})
		return
	}

	log.Printf("DeleteGroup: Successfully deleted group %d", groupID)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Group deleted successfully",
	})
}
