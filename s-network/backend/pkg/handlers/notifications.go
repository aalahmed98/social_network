package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"s-network/backend/pkg/db/sqlite"
	"strconv"

	"github.com/gorilla/mux"
)

// CreateMessageNotification has been moved to the sqlite package

// GetUserNotifications retrieves notifications for a user
func GetUserNotifications(w http.ResponseWriter, r *http.Request) {
	// Get the session directly instead of using getSession helper
	session, err := store.Get(r, SessionCookieName)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Unauthorized: Session error",
		})
		return
	}

	// Check if user is authenticated
	auth, ok := session.Values["authenticated"].(bool)
	if !ok || !auth {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Unauthorized: Not authenticated",
		})
		return
	}

	// Get user ID from session
	userIDValue, ok := session.Values["user_id"]
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Unauthorized: User ID not found in session",
		})
		return
	}
	
	// Convert user ID to the expected type (handle both int and float64)
	var userID int64
	switch v := userIDValue.(type) {
	case float64:
		userID = int64(v)
	case int:
		userID = int64(v)
	case int64:
		userID = v
	default:
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Invalid user ID type in session",
		})
		return
	}

	// Parse pagination parameters
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")
	typeFilter := r.URL.Query().Get("type")

	limit := 20
	if limitStr != "" {
		parsedLimit, err := strconv.Atoi(limitStr)
		if err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	offset := 0
	if offsetStr != "" {
		parsedOffset, err := strconv.Atoi(offsetStr)
		if err == nil && parsedOffset >= 0 {
			offset = parsedOffset
		}
	}

	// Ensure notifications table exists
	if err := db.EnsureNotificationsTableExists(); err != nil {
		fmt.Printf("Error ensuring notifications table exists: %v\n", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": fmt.Sprintf("Failed to check notifications table: %v", err),
		})
		return
	}

	// Get notifications from database
	fmt.Printf("Fetching notifications for user ID: %d\n", userID)
	notifications, err := db.GetUserNotifications(int64(userID), typeFilter, limit, offset)
	if err != nil {
		fmt.Printf("Error getting notifications: %v\n", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": fmt.Sprintf("Failed to get notifications: %v", err),
		})
		return
	}

	fmt.Printf("Found %d notifications for user ID: %d\n", len(notifications), userID)
	
	// Instead of getting follow requests again, since we already get them from GetUserNotifications,
	// we'll just use the notifications we've already retrieved.
	// This prevents duplication of follow requests.
	
	// Track used request IDs to deduplicate follow requests
	usedRequestIDs := make(map[int64]bool)
	for _, notification := range notifications {
		if notification != nil && notification.Type == "follow_request" {
			usedRequestIDs[notification.ReferenceID] = true
		}
	}
	
	// Process notifications to include sender details
	result := make([]map[string]interface{}, 0, len(notifications))
	for i, notification := range notifications {
		// Skip if notification is nil
		if notification == nil {
			continue
		}
		
		// Skip duplicate follow request notifications
		if notification.Type == "follow_request" {
			// Only process the first occurrence of each request ID
			if i > 0 && usedRequestIDs[notification.ReferenceID] {
				// Skip this duplicate
				fmt.Printf("Skipping duplicate follow request notification with ID %d\n", notification.ID)
				continue
			}
			usedRequestIDs[notification.ReferenceID] = true
			
			// Verify that this follow request still exists
			exists, _ := db.CheckFollowRequestExistsById(notification.ReferenceID)
			if !exists {
				fmt.Printf("Skipping follow request %d that no longer exists\n", notification.ReferenceID)
				continue
			}
		}
		
		// Get sender info
		var senderInfo map[string]interface{}
		if notification.SenderID > 0 {
			sender, err := db.GetUserById(int(notification.SenderID))
			if err != nil {
				fmt.Printf("Error getting sender info for notification: %v\n", err)
				// Use default sender info instead of skipping notification
				senderInfo = map[string]interface{}{
					"id":         notification.SenderID,
					"first_name": "Unknown",
					"last_name":  "User",
					"avatar":     nil,
				}
			} else {
				senderInfo = sender
			}
		} else {
			// For system notifications without a sender
			senderInfo = map[string]interface{}{
				"id":         0,
				"first_name": "System",
				"last_name":  "",
				"avatar":     nil,
			}
		}

		notificationData := map[string]interface{}{
			"id":           notification.ID,
			"type":         notification.Type,
			"content":      notification.Content,
			"is_read":      notification.IsRead,
			"created_at":   notification.CreatedAt,
			"reference_id": notification.ReferenceID,
			"sender": map[string]interface{}{
				"id":         notification.SenderID,
				"first_name": senderInfo["first_name"],
				"last_name":  senderInfo["last_name"],
				"avatar":     senderInfo["avatar"],
			},
		}

		// Include additional type-specific fields if needed
		switch notification.Type {
		case "message":
			notificationData["conversation_id"] = notification.ReferenceID
		case "follow":
			notificationData["follower_id"] = notification.SenderID
		case "follow_request":
			// Keep reference_id as is - it contains the request ID
		case "follow_accepted":
			// Keep reference_id as is - it contains the user ID of who accepted
		case "post_like":
		case "post_comment":
			notificationData["post_id"] = notification.ReferenceID
		case "group":
			notificationData["group_id"] = notification.ReferenceID
		}

		result = append(result, notificationData)
	}

	// Update unread notifications to read if requested
	markAsRead := r.URL.Query().Get("mark_as_read") == "true"
	if markAsRead {
		if err := db.MarkNotificationsAsRead(int64(userID)); err != nil {
			fmt.Printf("Error marking notifications as read: %v\n", err)
			// Continue despite error
		}
	}

	// Get count of unread notifications
	unreadCount, err := db.GetUnreadNotificationCount(int64(userID))
	if err != nil {
		fmt.Printf("Error getting unread count: %v\n", err)
		unreadCount = 0 // Default to 0 if error
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"notifications": result,
		"unread_count":  unreadCount,
		"total":         len(result),
		"offset":        offset,
		"limit":         limit,
	})
}

// GetFollowRequestsAsNotifications retrieves follow requests as notifications
func GetFollowRequestsAsNotifications(userID int64) ([]*sqlite.Notification, error) {
	// Get follow requests for the user
	followRequests, err := db.GetUserFollowRequests(userID)
	if err != nil {
		return nil, err
	}

	notifications := make([]*sqlite.Notification, 0, len(followRequests))

	for _, request := range followRequests {
		// Get follower user info for the notification content
		follower, err := db.GetUserById(int(request.FollowerID))
		if err != nil {
			continue
		}

		followerName := follower["first_name"].(string) + " " + follower["last_name"].(string)
		
		// Create notification object
		notification := &sqlite.Notification{
			ID:          request.ID,  // Use request ID as notification ID
			ReceiverID:  userID,
			SenderID:    request.FollowerID,
			Type:        "follow_request",
			Content:     followerName + " wants to follow you",
			ReferenceID: request.ID,
			IsRead:      false,
			CreatedAt:   request.CreatedAt,
		}

		notifications = append(notifications, notification)
	}

	return notifications, nil
}

// MarkNotificationAsRead marks a specific notification as read
func MarkNotificationAsRead(w http.ResponseWriter, r *http.Request) {
	// Get the session directly instead of using getSession helper
	session, err := store.Get(r, SessionCookieName)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Unauthorized: Session error",
		})
		return
	}

	// Check if user is authenticated
	auth, ok := session.Values["authenticated"].(bool)
	if !ok || !auth {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Unauthorized: Not authenticated",
		})
		return
	}

	// Get user ID from session
	userIDValue, ok := session.Values["user_id"]
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Unauthorized: User ID not found in session",
		})
		return
	}
	
	// Convert user ID to the expected type (handle both int and float64)
	var userID int64
	switch v := userIDValue.(type) {
	case float64:
		userID = int64(v)
	case int:
		userID = int64(v)
	case int64:
		userID = v
	default:
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Invalid user ID type in session",
		})
		return
	}

	vars := mux.Vars(r)
	notificationIDStr := vars["id"]
	notificationID, err := strconv.ParseInt(notificationIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid notification ID", http.StatusBadRequest)
		return
	}

	// Check if notification belongs to user
	notification, err := db.GetNotification(notificationID)
	if err != nil || notification == nil || notification.ReceiverID != userID {
		http.Error(w, "Notification not found", http.StatusNotFound)
		return
	}

	// Mark notification as read
	err = db.MarkNotificationAsRead(notificationID)
	if err != nil {
		http.Error(w, "Failed to mark notification as read", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}

// GetUnreadNotificationCount returns the count of unread notifications
func GetUnreadNotificationCount(w http.ResponseWriter, r *http.Request) {
	// Get the session directly instead of using getSession helper
	session, err := store.Get(r, SessionCookieName)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Unauthorized: Session error",
		})
		return
	}

	// Check if user is authenticated
	auth, ok := session.Values["authenticated"].(bool)
	if !ok || !auth {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Unauthorized: Not authenticated",
		})
		return
	}

	// Get user ID from session
	userIDValue, ok := session.Values["user_id"]
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Unauthorized: User ID not found in session",
		})
		return
	}
	
	// Convert user ID to the expected type (handle both int and float64)
	var userID int64
	switch v := userIDValue.(type) {
	case float64:
		userID = int64(v)
	case int:
		userID = int64(v)
	case int64:
		userID = v
	default:
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Invalid user ID type in session",
		})
		return
	}

	// Get count of unread notifications
	unreadCount, err := db.GetUnreadNotificationCount(userID)
	if err != nil {
		http.Error(w, "Failed to get unread count", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"unread_count": unreadCount,
	})
}

// MarkAllNotificationsAsRead marks all notifications as read for the current user
func MarkAllNotificationsAsRead(w http.ResponseWriter, r *http.Request) {
	// Get the session directly instead of using getSession helper
	session, err := store.Get(r, SessionCookieName)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Unauthorized: Session error",
		})
		return
	}

	// Check if user is authenticated
	auth, ok := session.Values["authenticated"].(bool)
	if !ok || !auth {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Unauthorized: Not authenticated",
		})
		return
	}

	// Get user ID from session
	userIDValue, ok := session.Values["user_id"]
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Unauthorized: User ID not found in session",
		})
		return
	}
	
	// Convert user ID to the expected type (handle both int and float64)
	var userID int64
	switch v := userIDValue.(type) {
	case float64:
		userID = int64(v)
	case int:
		userID = int64(v)
	case int64:
		userID = v
	default:
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Invalid user ID type in session",
		})
		return
	}

	// Mark all notifications as read
	err = db.MarkNotificationsAsRead(userID)
	if err != nil {
		http.Error(w, "Failed to mark notifications as read", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}

// RegisterNotificationRoutes registers notification-related routes
func RegisterNotificationRoutes(router *mux.Router) {
	router.HandleFunc("/notifications", GetUserNotifications).Methods("GET", "OPTIONS")
	router.HandleFunc("/notifications/{id}/read", MarkNotificationAsRead).Methods("POST", "OPTIONS")
	router.HandleFunc("/notifications/unread", GetUnreadNotificationCount).Methods("GET", "OPTIONS")
	router.HandleFunc("/notifications/read-all", MarkAllNotificationsAsRead).Methods("POST", "OPTIONS")
} 