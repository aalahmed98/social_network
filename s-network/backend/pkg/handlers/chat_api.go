package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"s-network/backend/pkg/db/sqlite"

	"github.com/gorilla/mux"
)

// Global chat hub
var chatHub *ChatHub

// Use the sqlite ChatConversation type directly to avoid redefining it
type ChatConversation = sqlite.ChatConversation

// getUserIDFromSession extracts user ID from the session
func getUserIDFromSession(r *http.Request) (int, error) {
	session, err := store.Get(r, SessionCookieName)
	if err != nil {
		return 0, err
	}

	// Check if user is authenticated
	auth, ok := session.Values["authenticated"].(bool)
	if !ok || !auth {
		return 0, fmt.Errorf("not authenticated")
	}

	// Get user ID
	userID, ok := session.Values["user_id"].(int)
	if !ok {
		return 0, fmt.Errorf("invalid user ID in session")
	}

	return userID, nil
}

// InitChatHub initializes the chat hub and starts it
func InitChatHub() {
	chatHub = NewChatHub()
	go chatHub.Run()
}

// GetConversations returns a list of conversations for the user
func GetConversations(w http.ResponseWriter, r *http.Request) {
	// Get session information from request
	userID, err := getUserIDFromSession(r)
	if err != nil {
		log.Printf("❌ GetConversations: Session error for request: %v", err)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}



	conversations, err := db.GetUserConversations(int64(userID))
	if err != nil {
		log.Printf("❌ GetConversations: Error getting conversations: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}




	// Enhance conversations with additional data
	result := make([]map[string]interface{}, 0)
	for _, conv := range conversations {
		log.Printf("🔄 Processing conversation %d (IsGroup: %t)", conv.ID, conv.IsGroup)

		// Get participants
		participants, err := db.GetConversationParticipants(conv.ID)
		if err != nil {
			log.Printf("❌ Error getting participants for conversation %d: %v", conv.ID, err)
			continue
		}
		log.Printf("  Found %d participants", len(participants))

		// Get last message
		var lastMessage map[string]interface{}
		if conv.IsGroup && conv.GroupID != nil {
			// Get latest group message
			groupMessage, err := db.GetLatestGroupMessage(*conv.GroupID)
			if err != nil {
				log.Printf("❌ Error getting latest group message for group %d: %v", *conv.GroupID, err)
			} else if groupMessage != nil {
				// Get sender info
				sender, err := db.GetUserById(int(groupMessage.SenderID))
				if err != nil {
					log.Printf("❌ Error getting sender for group message %d: %v", groupMessage.ID, err)
				} else {
					lastMessage = map[string]interface{}{
						"id":        groupMessage.ID,
						"content":   groupMessage.Content,
						"timestamp": groupMessage.CreatedAt,
						"sender": map[string]interface{}{
							"id":         groupMessage.SenderID,
							"first_name": sender["first_name"],
							"last_name":  sender["last_name"],
							"avatar":     sender["avatar"],
						},
					}
				}
			}
		} else {
			// Get latest direct message
			messages, err := db.GetConversationMessages(conv.ID, 1, 0)
			if err != nil {
				log.Printf("❌ Error getting messages for conversation %d: %v", conv.ID, err)
			} else if len(messages) > 0 {
				// Get sender info
				sender, err := db.GetUserById(int(messages[0].SenderID))
				if err != nil {
					log.Printf("❌ Error getting sender for message %d: %v", messages[0].ID, err)
				} else {
					lastMessage = map[string]interface{}{
						"id":        messages[0].ID,
						"content":   messages[0].Content,
						"timestamp": messages[0].CreatedAt,
						"sender": map[string]interface{}{
							"id":         messages[0].SenderID,
							"first_name": sender["first_name"],
							"last_name":  sender["last_name"],
							"avatar":     sender["avatar"],
						},
					}
				}
			}
		}

		// Get participant user info
		participantDetails := make([]map[string]interface{}, 0)

		if conv.IsGroup && conv.GroupID != nil {
			// For group conversations, get members with pending status
			groupMembers, err := db.GetGroupMembersWithPending(*conv.GroupID)
			if err != nil {
				log.Printf("❌ Error getting group members with pending for group %d: %v", *conv.GroupID, err)
			} else {
				for _, member := range groupMembers {
					participantDetails = append(participantDetails, map[string]interface{}{
						"id":         member.UserID,
						"first_name": member.FirstName,
						"last_name":  member.LastName,
						"avatar":     member.Avatar,
						"joined_at":  member.JoinedAt,
						"status":     member.Status, // "member" or "pending"
					})
				}
			}
		} else {
			// For direct conversations, use regular participants
			for _, p := range participants {
				user, err := db.GetUserById(int(p.UserID))
				if err != nil {
					continue
				}

				participantDetails = append(participantDetails, map[string]interface{}{
					"id":         p.UserID,
					"first_name": user["first_name"],
					"last_name":  user["last_name"],
					"avatar":     user["avatar"],
					"joined_at":  p.JoinedAt,
					"status":     "member", // Direct chat participants are always confirmed
				})
			}
		}

		// Get unread count
		unreadCount, err := db.GetUnreadMessageCount(conv.ID, int64(userID))
		if err != nil {
			log.Printf("❌ Error getting unread count for conversation %d: %v", conv.ID, err)
			unreadCount = 0
		}

		// Get conversation name and avatar
		var name string
		var avatar string
		if conv.IsGroup {
			// For groups, use the conversation name directly
			name = conv.Name
			if conv.GroupID != nil {
				// Get group info
				group, err := db.GetGroup(*conv.GroupID)
				if err == nil && group != nil {
					avatar = group.Avatar
				}
			}
	
		} else {
			// For direct conversations, use the other participant's name
			for _, p := range participants {
				if p.UserID != int64(userID) {
					otherUser, err := db.GetUserById(int(p.UserID))
					if err == nil {
						name = otherUser["first_name"].(string) + " " + otherUser["last_name"].(string)
						avatar = otherUser["avatar"].(string)
					}
					break
				}
			}

		}

		// Build conversation data
		conversationData := map[string]interface{}{
			"id":           conv.ID,
			"name":         name,
			"avatar":       avatar,
			"is_group":     conv.IsGroup,
			"group_id":     conv.GroupID,
			"last_message": lastMessage,
			"unread_count": unreadCount,
			"participants": participantDetails,
			"updated_at":   conv.UpdatedAt,
			"created_at":   conv.CreatedAt,
		}



		result = append(result, conversationData)
	}



	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"conversations": result,
	})


}

// GetConversation returns details of a specific conversation
func GetConversation(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	conversationIDStr := vars["id"]
	conversationID, err := strconv.ParseInt(conversationIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid conversation ID", http.StatusBadRequest)
		return
	}

	// Check if user has access to this conversation
	hasAccess, err := canAccessConversation(int64(userID), conversationID)
	if err != nil || !hasAccess {
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}

	// Get conversation details
	conversation, err := db.GetConversation(conversationID)
	if err != nil || conversation == nil {
		http.Error(w, "Conversation not found", http.StatusNotFound)
		return
	}

	// Get participants
	participants, err := db.GetConversationParticipants(conversationID)
	if err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	// Get participant user info
	participantDetails := make([]map[string]interface{}, 0)
	for _, p := range participants {
		user, err := db.GetUserById(int(p.UserID))
		if err != nil {
			continue
		}

		participantDetails = append(participantDetails, map[string]interface{}{
			"id":         p.UserID,
			"first_name": user["first_name"],
			"last_name":  user["last_name"],
			"avatar":     user["avatar"],
			"joined_at":  p.JoinedAt,
		})
	}

	// Construct result
	result := map[string]interface{}{
		"id":           conversation.ID,
		"name":         conversation.Name,
		"is_group":     conversation.IsGroup,
		"group_id":     conversation.GroupID,
		"participants": participantDetails,
		"created_at":   conversation.CreatedAt,
		"updated_at":   conversation.UpdatedAt,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// GetMessages returns messages for a conversation
func GetMessages(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	conversationIDStr := vars["id"]
	conversationID, err := strconv.ParseInt(conversationIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid conversation ID", http.StatusBadRequest)
		return
	}

	// Check if user has access to this conversation
	hasAccess, err := canAccessConversation(int64(userID), conversationID)
	if err != nil || !hasAccess {
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}

	// Get conversation info to determine if it's a group
	conversation, err := db.GetConversation(conversationID)
	if err != nil || conversation == nil {
		http.Error(w, "Conversation not found", http.StatusNotFound)
		return
	}

	// Parse pagination parameters
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
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

	// Process messages based on conversation type
	result := make([]map[string]interface{}, 0)

	if conversation.IsGroup && conversation.GroupID != nil {
		// Handle group messages
		groupMessages, err := db.GetGroupMessages(*conversation.GroupID, limit, offset)
		if err != nil {
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		for _, msg := range groupMessages {
			// Get sender info
			sender, err := db.GetUserById(int(msg.SenderID))
			if err != nil {
				log.Printf("Error getting sender: %v", err)
				continue
			}

			// Format message
			messageData := map[string]interface{}{
				"id":              msg.ID,
				"conversation_id": conversationID,
				"content":         msg.Content,
				"is_deleted":      msg.IsDeleted,
				"created_at":      msg.CreatedAt,
				"timestamp":       msg.CreatedAt,
				"sender": map[string]interface{}{
					"id":         msg.SenderID,
					"first_name": sender["first_name"],
					"last_name":  sender["last_name"],
					"avatar":     sender["avatar"],
				},
			}

			// Add attachments if any
			if len(msg.Attachments) > 0 {
				attachments := make([]map[string]interface{}, 0)
				for _, att := range msg.Attachments {
					attachments = append(attachments, map[string]interface{}{
						"id":        att.ID,
						"file_url":  att.FileURL,
						"file_type": att.FileType,
						"file_name": att.FileName,
						"file_size": att.FileSize,
					})
				}
				messageData["attachments"] = attachments
			}

			result = append(result, messageData)
		}
	} else {
		// Handle direct messages
		messages, err := db.GetConversationMessages(conversationID, limit, offset)
		if err != nil {
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		for _, msg := range messages {
			// Get sender info
			sender, err := db.GetUserById(int(msg.SenderID))
			if err != nil {
				log.Printf("Error getting sender: %v", err)
				continue
			}

			// Format message
			messageData := map[string]interface{}{
				"id":              msg.ID,
				"conversation_id": msg.ConversationID,
				"content":         msg.Content,
				"is_deleted":      msg.IsDeleted,
				"created_at":      msg.CreatedAt,
				"timestamp":       msg.CreatedAt,
				"sender": map[string]interface{}{
					"id":         msg.SenderID,
					"first_name": sender["first_name"],
					"last_name":  sender["last_name"],
					"avatar":     sender["avatar"],
				},
			}

			// Add attachments if any
			if len(msg.Attachments) > 0 {
				attachments := make([]map[string]interface{}, 0)
				for _, att := range msg.Attachments {
					attachments = append(attachments, map[string]interface{}{
						"id":        att.ID,
						"file_url":  att.FileURL,
						"file_type": att.FileType,
						"file_name": att.FileName,
						"file_size": att.FileSize,
					})
				}
				messageData["attachments"] = attachments
			}

			result = append(result, messageData)
		}

		// Update last read message for direct conversations
		if len(result) > 0 {
			lastMsgID := result[len(result)-1]["id"].(int64)
			db.UpdateLastReadMessage(conversationID, int64(userID), lastMsgID)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"messages": result,
		"count":    len(result),
		"offset":   offset,
		"limit":    limit,
	})
}

// CreateConversation creates a new conversation
func CreateConversation(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse request body
	var requestData struct {
		Name         string  `json:"name"`
		IsGroup      bool    `json:"is_group"`
		GroupID      *int64  `json:"group_id"`
		Participants []int64 `json:"participants"`
	}

	if err := json.NewDecoder(r.Body).Decode(&requestData); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if requestData.IsGroup && requestData.GroupID == nil {
		http.Error(w, "Group ID is required for group conversations", http.StatusBadRequest)
		return
	}

	if !requestData.IsGroup && len(requestData.Participants) != 1 {
		http.Error(w, "Direct conversations require exactly one participant", http.StatusBadRequest)
		return
	}

	// For direct conversations, check if user can message the other user
	if !requestData.IsGroup {
		otherUserID := requestData.Participants[0]
		canMessage, err := canMessageUser(int64(userID), otherUserID)
		if err != nil || !canMessage {
			http.Error(w, "You cannot message this user", http.StatusForbidden)
			return
		}

		// Check if conversation already exists
		existingConvID, err := db.GetOrCreateDirectConversation(int64(userID), otherUserID)
		if err != nil {
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		if existingConvID > 0 {
			// Conversation already exists, return it
			conversation, err := db.GetConversation(existingConvID)
			if err != nil || conversation == nil {
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"id":         conversation.ID,
				"name":       conversation.Name,
				"is_group":   conversation.IsGroup,
				"group_id":   conversation.GroupID,
				"created_at": conversation.CreatedAt,
				"updated_at": conversation.UpdatedAt,
				"message":    "Conversation already exists",
			})
			return
		}
	}

	// Create new conversation
	conversation := &ChatConversation{
		Name:    requestData.Name,
		IsGroup: requestData.IsGroup,
		GroupID: requestData.GroupID,
	}

	conversationID, err := db.CreateConversation(conversation)
	if err != nil {
		http.Error(w, "Failed to create conversation", http.StatusInternalServerError)
		return
	}

	// Add participants
	db.AddParticipant(conversationID, int64(userID)) // Add current user

	for _, participantID := range requestData.Participants {
		db.AddParticipant(conversationID, participantID)
	}

	// Get created conversation
	createdConversation, err := db.GetConversation(conversationID)
	if err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":         createdConversation.ID,
		"name":       createdConversation.Name,
		"is_group":   createdConversation.IsGroup,
		"group_id":   createdConversation.GroupID,
		"created_at": createdConversation.CreatedAt,
		"updated_at": createdConversation.UpdatedAt,
		"message":    "Conversation created successfully",
	})
}

// canMessageUser checks if a user can message another user
func canMessageUser(senderID, recipientID int64) (bool, error) {
	// Get recipient's profile
	recipient, err := db.GetUserById(int(recipientID))
	if err != nil {
		return false, err
	}

	// If recipient has a public profile, anyone can message them
	isPublic, ok := recipient["is_public"].(bool)
	if ok && isPublic {
		return true, nil
	}

	// Check if sender follows recipient
	isFollowing, err := db.IsFollowing(int(senderID), int(recipientID))
	if err != nil {
		return false, err
	}

	if isFollowing {
		return true, nil
	}

	// Check if recipient follows sender
	isFollowedBy, err := db.IsFollowing(int(recipientID), int(senderID))
	if err != nil {
		return false, err
	}

	return isFollowedBy, nil
}

// WebSocketHandler handles WebSocket connections
func WebSocketHandler(w http.ResponseWriter, r *http.Request) {
	ServeWs(chatHub, w, r)
}

// RegisterChatRoutes registers the chat API routes that require authentication
func RegisterChatRoutes(router *mux.Router) {
	// Initialize chat hub
	InitChatHub()

	// API routes (these will have authentication middleware applied)
	router.HandleFunc("/conversations", GetConversations).Methods("GET", "OPTIONS")
	router.HandleFunc("/conversations", CreateConversation).Methods("POST", "OPTIONS")
	router.HandleFunc("/conversations/{id}", GetConversation).Methods("GET", "OPTIONS")
	router.HandleFunc("/conversations/{id}/messages", GetMessages).Methods("GET", "OPTIONS")
	// Add POST handler for sending messages
	router.HandleFunc("/conversations/{id}/messages", SendMessage).Methods("POST", "OPTIONS")
}

// RegisterChatWebSocketRoutes registers WebSocket routes on the main router
func RegisterChatWebSocketRoutes(router *mux.Router) {
	// WebSocket endpoint (no authentication middleware needed, authentication handled in websocket handler)
	router.HandleFunc("/ws/chat", WebSocketHandler)
}

// SendMessage handles sending a message to a conversation
func SendMessage(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	conversationIDStr := vars["id"]
	conversationID, err := strconv.ParseInt(conversationIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid conversation ID", http.StatusBadRequest)
		return
	}

	// Check if user has access to this conversation
	hasAccess, err := canAccessConversation(int64(userID), conversationID)
	if err != nil || !hasAccess {
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}

	// Get conversation info to determine if it's a group
	conversation, err := db.GetConversation(conversationID)
	if err != nil || conversation == nil {
		http.Error(w, "Conversation not found", http.StatusNotFound)
		return
	}

	// Parse request body
	var req struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.Content == "" {
		http.Error(w, "Message content cannot be empty", http.StatusBadRequest)
		return
	}

	// Save the message based on conversation type
	if conversation.IsGroup && conversation.GroupID != nil {
		// Save as group message
		groupMsg := &sqlite.GroupMessage{
			GroupID:   *conversation.GroupID,
			SenderID:  int64(userID),
			Content:   req.Content,
			IsDeleted: false,
			CreatedAt: time.Now(),
		}
		_, err = db.CreateGroupMessage(groupMsg)
		if err != nil {
			http.Error(w, "Failed to save group message", http.StatusInternalServerError)
			return
		}
	} else {
		// Save as direct message
		msg := &sqlite.ChatMessage{
			ConversationID: conversationID,
			SenderID:       int64(userID),
			Content:        req.Content,
			IsDeleted:      false,
			CreatedAt:      time.Now(),
		}
		_, err = db.CreateMessage(msg)
		if err != nil {
			http.Error(w, "Failed to save message", http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
