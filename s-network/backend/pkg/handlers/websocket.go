package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var (
	// Configure the upgrader
	upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		// Allow all origins for testing purposes
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	// Track all active connections with user information
	clients = make(map[*websocket.Conn]*Client)
	// Mutex to protect clients map from concurrent access
	clientsMutex = sync.RWMutex{}
	// For broadcasting messages to all clients
	broadcast = make(chan BroadcastMessage, 100) // Buffered channel to prevent blocking
	// Flag to indicate if broadcaster is running
	broadcasterRunning = false
	// Mutex to protect broadcaster state
	broadcasterMutex = sync.Mutex{}
)

// Client represents a connected user
type Client struct {
	Conn     *websocket.Conn
	Username string
	UserID   int        // Optional, can be used if users are authenticated
	mu       sync.Mutex // For locking writes to this client
}

// Message struct for encoding/decoding WebSocket messages
type Message struct {
	ID        string      `json:"id,omitempty"`
	Type      string      `json:"type"`
	Message   string      `json:"message,omitempty"`
	Data      interface{} `json:"data,omitempty"`
	Sender    string      `json:"sender,omitempty"`
	Timestamp time.Time   `json:"time"`
}

// BroadcastMessage wraps a message with its intended recipients
type BroadcastMessage struct {
	Message  *Message
	SkipUser string // Username to skip (usually the sender)
}

// Initialize the message broadcaster
func init() {
	startBroadcaster()
}

// startBroadcaster safely starts the broadcaster goroutine if it's not already running
func startBroadcaster() {
	broadcasterMutex.Lock()
	defer broadcasterMutex.Unlock()

	if !broadcasterRunning {
		broadcasterRunning = true
		go broadcaster()
	}
}

// broadcaster runs in a goroutine and broadcasts messages to all clients
func broadcaster() {
	defer func() {
		// Recover from any panics
		if r := recover(); r != nil {
			log.Printf("Recovered from panic in broadcaster: %v", r)

			// Mark broadcaster as not running so it can be restarted
			broadcasterMutex.Lock()
			broadcasterRunning = false
			broadcasterMutex.Unlock()

			// Restart the broadcaster
			startBroadcaster()
		}
	}()

	for {
		// Wait for a message to broadcast
		broadcastMsg, ok := <-broadcast
		if !ok {
			// Channel was closed
			log.Println("Broadcast channel closed, exiting broadcaster")
			return
		}

		msg := broadcastMsg.Message
		skipUser := broadcastMsg.SkipUser

		// Get a snapshot of current clients to avoid holding lock during writes
		clientsCopy := make(map[*websocket.Conn]*Client)
		clientsMutex.RLock()
		for conn, client := range clients {
			clientsCopy[conn] = client
		}
		clientsMutex.RUnlock()

		// Send message to each client
		for conn, client := range clientsCopy {
			// Skip the specified user (usually the sender)
			if skipUser != "" && client.Username == skipUser {
				continue
			}

			// Skip disconnected clients
			if conn == nil || conn.WriteJSON == nil {
				continue
			}

			// Lock the client while writing
			client.mu.Lock()
			err := conn.WriteJSON(msg)
			client.mu.Unlock()

			if err != nil {
				log.Printf("Error broadcasting to client %s: %v", client.Username, err)
				// Don't close the connection here - let the connection's own goroutine handle that
				// Just mark it for removal
				removeClient(conn)
			}
		}
	}
}

// removeClient safely removes a client from the clients map
func removeClient(conn *websocket.Conn) {
	clientsMutex.Lock()
	defer clientsMutex.Unlock()
	delete(clients, conn)
}

// HandleWebSocket upgrades the HTTP connection to a WebSocket connection
func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Upgrade HTTP connection to WebSocket with more permissive settings
	upgrader.CheckOrigin = func(r *http.Request) bool {
		return true // Allow all origins for testing
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Error upgrading to WebSocket: %v", err)
		return
	}

	// Set up more permissive read/write deadlines to prevent timeouts
	conn.SetReadDeadline(time.Time{})  // No read deadline (infinite)
	conn.SetWriteDeadline(time.Time{}) // No write deadline (infinite)

	// Set up ping handler to respond to ping with pong
	conn.SetPingHandler(func(appData string) error {
		err := conn.WriteControl(websocket.PongMessage, []byte{}, time.Now().Add(10*time.Second))
		if err != nil {
			log.Printf("Error sending pong: %v", err)
		}
		return nil
	})

	// Enable write buffer compression
	conn.EnableWriteCompression(true)

	// Create a client with default username (will be updated when join message is received)
	client := &Client{
		Conn:     conn,
		Username: "User",
	}

	// Register new client
	clientsMutex.Lock()
	clients[conn] = client
	clientsMutex.Unlock()

	// Ensure broadcaster is running
	startBroadcaster()

	// Cleanup on disconnect
	defer func() {
		// Send leave message if the user had joined with a username
		if client.Username != "User" {
			leaveMsg := &Message{
				ID:        uuid.New().String(),
				Type:      "leave",
				Message:   client.Username + " has left the chat",
				Timestamp: time.Now(),
			}
			// Broadcast the leave message
			broadcast <- BroadcastMessage{
				Message:  leaveMsg,
				SkipUser: "", // Send to all users
			}
		}

		// Close connection and remove client
		conn.Close()
		removeClient(conn)
		log.Printf("Client disconnected. Total active clients: %d", len(clients))
	}()

	log.Printf("New WebSocket client connected. Total active clients: %d", len(clients))

	// Send welcome message
	welcomeMsg := Message{
		ID:        uuid.New().String(),
		Type:      "welcome",
		Message:   "Welcome to the S-Network chat server!",
		Timestamp: time.Now(),
	}

	client.mu.Lock()
	err = conn.WriteJSON(welcomeMsg)
	client.mu.Unlock()

	if err != nil {
		log.Printf("Error sending welcome message: %v", err)
		return
	}

	// Set up a ping timer to keep the connection alive from server side
	pingTicker := time.NewTicker(45 * time.Second)
	defer pingTicker.Stop()

	// Create a done channel to signal when the connection is closed
	done := make(chan struct{})

	// Start a goroutine to send periodic pings
	go func() {
		for {
			select {
			case <-done:
				return
			case <-pingTicker.C:
				// Send a ping message to keep the connection alive
				if err := conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(10*time.Second)); err != nil {
					log.Printf("Error sending ping: %v", err)
					return
				}
			}
		}
	}()

	// Handle incoming messages
	for {
		messageType, p, err := conn.ReadMessage()
		if err != nil {
			// Check if it's a normal close or abnormal
			if websocket.IsUnexpectedCloseError(err,
				websocket.CloseGoingAway,
				websocket.CloseNormalClosure,
				websocket.CloseNoStatusReceived) {
				log.Printf("Unexpected close error: %v", err)
			} else {
				log.Printf("Connection closed: %v", err)
			}
			close(done) // Signal the ping goroutine to stop
			break
		}

		// Parse message
		var msg Message
		if err := json.Unmarshal(p, &msg); err != nil {
			// If it's not valid JSON, just echo it back
			msg = Message{
				ID:        uuid.New().String(),
				Type:      "echo",
				Message:   string(p),
				Timestamp: time.Now(),
			}
		} else {
			// Add ID and ensure timestamp
			if msg.ID == "" {
				msg.ID = uuid.New().String()
			}
			msg.Timestamp = time.Now()
		}

		// Log message (but not heartbeats to reduce noise)
		if msg.Type != "heartbeat" {
			log.Printf("Received message: %s from %s", msg.Message, msg.Sender)
		}

		// Handle different message types
		switch msg.Type {
		case "join":
			// Update client username
			clientsMutex.Lock()
			client.Username = msg.Sender
			clientsMutex.Unlock()

			// Broadcast join message to all clients
			broadcast <- BroadcastMessage{
				Message:  &msg,
				SkipUser: "", // Send to all users
			}

			// Send acknowledgement back to the client
			response := Message{
				ID:        uuid.New().String(),
				Type:      "join_ack",
				Message:   "You've joined as " + msg.Sender,
				Timestamp: time.Now(),
			}

			client.mu.Lock()
			err := conn.WriteJSON(response)
			client.mu.Unlock()

			if err != nil {
				log.Printf("Error sending join acknowledgement: %v", err)
				close(done)
				return
			}

		case "message":
			// Validate the message has required fields
			if msg.Message == "" || msg.Sender == "" {
				continue
			}

			// Echo back to sender first with their own ID
			client.mu.Lock()
			err := conn.WriteJSON(msg)
			client.mu.Unlock()

			if err != nil {
				log.Printf("Error echoing message to sender: %v", err)
				close(done)
				return
			}

			// Then broadcast to other clients
			broadcast <- BroadcastMessage{
				Message:  &msg,
				SkipUser: msg.Sender, // Don't send back to sender
			}

		case "ping":
			msg.Type = "pong"
			msg.Message = "Server received: " + msg.Message

			client.mu.Lock()
			err := conn.WriteJSON(msg)
			client.mu.Unlock()

			if err != nil {
				log.Printf("Error responding to ping: %v", err)
				close(done)
				return
			}

		case "heartbeat":
			// Respond to heartbeat to confirm connection is still alive
			heartbeatResponse := Message{
				ID:        uuid.New().String(),
				Type:      "heartbeat",
				Message:   "Connection alive",
				Timestamp: time.Now(),
			}

			client.mu.Lock()
			err := conn.WriteJSON(heartbeatResponse)
			client.mu.Unlock()

			if err != nil {
				log.Printf("Error responding to heartbeat: %v", err)
				close(done)
				return
			}
			// Don't log heartbeats to reduce noise
			continue

		default:
			// For any other message type, echo it back
			client.mu.Lock()
			err := conn.WriteJSON(msg)
			client.mu.Unlock()

			if err != nil {
				log.Printf("Error writing response: %v", err)
				close(done)
				break
			}
		}

		// For non-WebSocket text messages, echo them back as-is
		if messageType == websocket.TextMessage && msg.Type == "echo" {
			client.mu.Lock()
			err := conn.WriteMessage(websocket.TextMessage, p)
			client.mu.Unlock()

			if err != nil {
				log.Printf("Error echoing message: %v", err)
				close(done)
				break
			}
		}
	}
}
