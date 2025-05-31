package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"s-network/backend/pkg/db/sqlite"

	"github.com/gorilla/websocket"
)

// WebSocket connection upgrader
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Allow all origins for development
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// Client represents a connected WebSocket client
type Client struct {
	ID            int64
	UserID        int64
	Conn          *websocket.Conn
	Send          chan []byte
	ConversationID int64
	IsGroup       bool
}

// ChatHub maintains the set of active clients and broadcasts messages
type ChatHub struct {
	// Registered clients
	clients map[*Client]bool

	// Maps conversation ID to a list of clients in that conversation
	conversations map[int64][]*Client

	// Maps user ID to a list of their active clients (connections)
	users map[int64][]*Client

	// Inbound messages from clients
	broadcast chan *ChatMessage

	// Register requests from clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	// Mutex for concurrent access
	mutex sync.Mutex
	
	// Database reference
	db *sqlite.DB
}

// ChatMessage represents a message sent via WebSocket
type ChatMessage struct {
	Type           string          `json:"type"`
	ConversationID int64           `json:"conversation_id"`
	SenderID       int64           `json:"sender_id"`
	Content        string          `json:"content"`
	Timestamp      string          `json:"timestamp"`
	IsGroup        bool            `json:"is_group"`
	Payload        json.RawMessage `json:"payload,omitempty"`
}

// NewChatHub creates a new ChatHub
func NewChatHub() *ChatHub {
	return &ChatHub{
		broadcast:     make(chan *ChatMessage),
		register:      make(chan *Client),
		unregister:    make(chan *Client),
		clients:       make(map[*Client]bool),
		conversations: make(map[int64][]*Client),
		users:         make(map[int64][]*Client),
		db:            db,
	}
}

// Run starts the chat hub
func (h *ChatHub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mutex.Lock()
			h.clients[client] = true
			
			// Add to conversation list
			if client.ConversationID > 0 {
				h.conversations[client.ConversationID] = append(h.conversations[client.ConversationID], client)
			}
			
			// Add to user list
			h.users[client.UserID] = append(h.users[client.UserID], client)
			h.mutex.Unlock()
			
			// Send connection confirmation
			client.Send <- []byte(`{"type":"connected","status":"success"}`)

		case client := <-h.unregister:
			h.mutex.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)
				
				// Remove from conversation list
				if client.ConversationID > 0 {
					h.removeClientFromConversation(client)
				}
				
				// Remove from user list
				h.removeClientFromUser(client)
			}
			h.mutex.Unlock()

		case message := <-h.broadcast:
			// Store the message in database
			messageID, err := h.storeMessage(message)
			if err != nil {
				log.Printf("Error storing message: %v", err)
				continue
			}
			
			// Get sender information
			sender, err := h.db.GetUserById(int(message.SenderID))
			if err != nil {
				log.Printf("Error getting sender info: %v", err)
				continue
			}
			
			// Add message ID and sender info to the message
			messageData, _ := json.Marshal(map[string]interface{}{
				"id":              messageID,
				"type":            message.Type,
				"conversation_id": message.ConversationID,
				"sender_id":       message.SenderID,
				"sender_name":     fmt.Sprintf("%s %s", sender["first_name"], sender["last_name"]),
				"sender_avatar":   sender["avatar"],
				"content":         message.Content,
				"timestamp":       message.Timestamp,
				"is_group":        message.IsGroup,
			})
			
			// Send to all clients in the conversation
			h.mutex.Lock()
			clients := h.conversations[message.ConversationID]
			log.Printf("Broadcasting message to conversation %d: %d clients connected", message.ConversationID, len(clients))
			
			sentCount := 0
			for _, client := range clients {
				select {
				case client.Send <- messageData:
					sentCount++
				default:
					log.Printf("Failed to send message to client %d, removing", client.UserID)
					close(client.Send)
					delete(h.clients, client)
					h.removeClientFromConversation(client)
					h.removeClientFromUser(client)
				}
			}
			log.Printf("Successfully sent message to %d clients", sentCount)
			h.mutex.Unlock()
			
			// Create notifications for offline users if not a group chat
			if !message.IsGroup {
				h.createMessageNotifications(message)
			}
		}
	}
}

// removeClientFromConversation removes a client from a conversation
func (h *ChatHub) removeClientFromConversation(client *Client) {
	conversationClients := h.conversations[client.ConversationID]
	for i, c := range conversationClients {
		if c == client {
			// Remove without preserving order
			conversationClients[i] = conversationClients[len(conversationClients)-1]
			h.conversations[client.ConversationID] = conversationClients[:len(conversationClients)-1]
			break
		}
	}
}

// removeClientFromUser removes a client from a user's client list
func (h *ChatHub) removeClientFromUser(client *Client) {
	userClients := h.users[client.UserID]
	for i, c := range userClients {
		if c == client {
			// Remove without preserving order
			userClients[i] = userClients[len(userClients)-1]
			h.users[client.UserID] = userClients[:len(userClients)-1]
			break
		}
	}
}

// storeMessage stores a message in the database
func (h *ChatHub) storeMessage(message *ChatMessage) (int64, error) {
	// Get conversation info to determine if it's a group
	conversation, err := h.db.GetConversation(message.ConversationID)
	if err != nil {
		return 0, err
	}
	
	if conversation != nil && conversation.IsGroup && conversation.GroupID != nil {
		// Save as group message
		groupMessage := &sqlite.GroupMessage{
			GroupID:   *conversation.GroupID,
			SenderID:  message.SenderID,
			Content:   message.Content,
			IsDeleted: false,
		}
		return h.db.CreateGroupMessage(groupMessage)
	} else {
		// Save as direct message
		chatMessage := &sqlite.ChatMessage{
			ConversationID: message.ConversationID,
			SenderID:       message.SenderID,
			Content:        message.Content,
		}
		return h.db.CreateMessage(chatMessage)
	}
}

// createMessageNotifications creates notifications for offline users
func (h *ChatHub) createMessageNotifications(message *ChatMessage) {
	// Get conversation participants
	participants, err := h.db.GetConversationParticipants(message.ConversationID)
	if err != nil {
		log.Printf("Error getting conversation participants: %v", err)
		return
	}
	
	// Get sender info
	sender, err := h.db.GetUserById(int(message.SenderID))
	if err != nil {
		log.Printf("Error getting sender info: %v", err)
		return
	}
	
	senderName := fmt.Sprintf("%s %s", sender["first_name"], sender["last_name"])
	
	for _, participant := range participants {
		// Skip the sender
		if participant.UserID == message.SenderID {
			continue
		}
		
		// Check if user is online in this conversation
		userIsOnline := false
		h.mutex.Lock()
		userClients := h.users[participant.UserID]
		for _, client := range userClients {
			if client.ConversationID == message.ConversationID {
				userIsOnline = true
				break
			}
		}
		h.mutex.Unlock()
		
		// Create notification for offline users
		if !userIsOnline {
			h.db.CreateMessageNotification(participant.UserID, message.SenderID, message.ConversationID, senderName)
		}
	}
}

// ServeWs handles websocket requests from the peer.
func ServeWs(hub *ChatHub, w http.ResponseWriter, r *http.Request) {
	// First check session authentication
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get conversationID from query params if provided
	var conversationID int64 = 0
	convIDStr := r.URL.Query().Get("conversation_id")
	if convIDStr != "" {
		parsedID, err := strconv.ParseInt(convIDStr, 10, 64)
		if err == nil {
			// Verify user has access to this conversation
			hasAccess, err := canAccessConversation(int64(userID), parsedID)
			if err != nil || !hasAccess {
				http.Error(w, "Access denied to conversation", http.StatusForbidden)
				return
			}
			conversationID = parsedID
		}
	}

	// Create a new WebSocket connection
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Error upgrading connection: %v", err)
		return
	}

	// Create a new client
	client := &Client{
		UserID:        int64(userID),
		Conn:          conn,
		Send:          make(chan []byte, 256),
		ConversationID: conversationID,
	}

	// Register the client with the hub
	hub.register <- client

	// Allow collection of memory referenced by the caller by doing all work in
	// new goroutines.
	go client.writePump()
	go client.readPump(hub)
}

// canAccessConversation checks if a user can access a conversation
func canAccessConversation(userID, conversationID int64) (bool, error) {
	// Get conversation participants
	participants, err := db.GetConversationParticipants(conversationID)
	if err != nil {
		return false, err
	}
	
	// Check if user is a participant
	for _, participant := range participants {
		if participant.UserID == userID {
			return true, nil
		}
	}
	
	return false, nil
}

// readPump pumps messages from the WebSocket connection to the hub
func (c *Client) readPump(hub *ChatHub) {
	defer func() {
		hub.unregister <- c
		c.Conn.Close()
	}()
	
	c.Conn.SetReadLimit(1024 * 1024) // 1MB max message size
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error { 
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil 
	})
	
	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}
		
		var chatMessage ChatMessage
		if err := json.Unmarshal(message, &chatMessage); err != nil {
			log.Printf("Error unmarshaling message: %v", err)
			continue
		}
		
		// Handle different message types
		switch chatMessage.Type {
		case "register":
			// Update client's conversation ID
			if chatMessage.ConversationID > 0 {
				// Verify user has access to this conversation
				hasAccess, err := canAccessConversation(c.UserID, chatMessage.ConversationID)
				if err != nil || !hasAccess {
					log.Printf("Access denied to conversation %d for user %d", chatMessage.ConversationID, c.UserID)
					continue
				}
				
				log.Printf("User %d registering for conversation %d", c.UserID, chatMessage.ConversationID)
				
				// Remove from old conversation if any
				if c.ConversationID > 0 {
					hub.mutex.Lock()
					hub.removeClientFromConversation(c)
					log.Printf("Removed user %d from old conversation %d", c.UserID, c.ConversationID)
					hub.mutex.Unlock()
				}
				
				// Set new conversation
				c.ConversationID = chatMessage.ConversationID
				
				// Add to new conversation
				hub.mutex.Lock()
				hub.conversations[c.ConversationID] = append(hub.conversations[c.ConversationID], c)
				clientCount := len(hub.conversations[c.ConversationID])
				log.Printf("Added user %d to conversation %d (total clients: %d)", c.UserID, c.ConversationID, clientCount)
				hub.mutex.Unlock()
				
				// Send registration confirmation
				response := map[string]interface{}{
					"type": "registered",
					"conversation_id": c.ConversationID,
					"status": "success",
				}
				responseData, _ := json.Marshal(response)
				c.Send <- responseData
			}
			
		case "chat_message":
			// Ensure sender ID matches the authenticated user
			chatMessage.SenderID = c.UserID
			
			// Set timestamp if not provided
			if chatMessage.Timestamp == "" {
				chatMessage.Timestamp = time.Now().Format(time.RFC3339)
			}
			
			// Use conversation ID from client if not provided in message
			if chatMessage.ConversationID == 0 {
				chatMessage.ConversationID = c.ConversationID
			}
			
			log.Printf("Received chat message from user %d for conversation %d: %s", c.UserID, chatMessage.ConversationID, chatMessage.Content)
			
			// Verify access to conversation
			if chatMessage.ConversationID > 0 {
				hasAccess, err := canAccessConversation(c.UserID, chatMessage.ConversationID)
				if err != nil || !hasAccess {
					log.Printf("Access denied to conversation %d for user %d", chatMessage.ConversationID, c.UserID)
					continue
				}
			}
			
			// Determine if this is a group conversation
			conversation, err := hub.db.GetConversation(chatMessage.ConversationID)
			if err != nil {
				log.Printf("Error getting conversation info: %v", err)
				continue
			}
			
			// Set group flag based on conversation type
			chatMessage.IsGroup = conversation != nil && conversation.IsGroup
			
			// Send to hub for broadcasting
			log.Printf("Sending message to hub for broadcasting: user %d, conversation %d, isGroup: %t", c.UserID, chatMessage.ConversationID, chatMessage.IsGroup)
			hub.broadcast <- &chatMessage
		}
	}
}

// writePump pumps messages from the hub to the WebSocket connection
func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()
	
	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				// The hub closed the channel
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			
			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			
			w.Write(message)
			
			// Add queued messages to the current WebSocket message
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}
			
			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
} 
