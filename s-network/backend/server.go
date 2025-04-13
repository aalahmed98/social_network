package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gorilla/mux"
	"github.com/gorilla/sessions"

	"s-network/backend/pkg/db/sqlite"
	"s-network/backend/pkg/handlers"
	"s-network/backend/pkg/middleware"
)

var (
	db         *sqlite.DB
	store      *sessions.CookieStore
	sessionKey = []byte("social-network-secret-key")
)

// WebSocketSupportMiddleware is a special middleware that ensures websocket connections
// are not interfered with by other middlewares
func webSocketSupportMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if it's a WebSocket upgrade request
		if isWebSocketRequest(r) {
			log.Printf("WebSocket connection attempt to: %s", r.URL.Path)
			// For WebSocket requests, add appropriate headers
			w.Header().Set("Connection", "Upgrade")
			w.Header().Set("Upgrade", "websocket")
			w.Header().Set("Sec-WebSocket-Version", "13")

			// Allow WebSocket connections from any origin for testing
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}

		// Call the next handler
		next.ServeHTTP(w, r)
	})
}

// isWebSocketRequest checks if the request is a WebSocket upgrade request
func isWebSocketRequest(r *http.Request) bool {
	return strings.ToLower(r.Header.Get("Upgrade")) == "websocket" &&
		strings.Contains(strings.ToLower(r.Header.Get("Connection")), "upgrade")
}

// CORS middleware function with proper error handling and WebSocket support
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Don't modify headers for WebSocket connections to avoid conflicts
		if isWebSocketRequest(r) {
			next.ServeHTTP(w, r)
			return
		}

		// For regular requests, set CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Connection, Upgrade, Sec-WebSocket-Key, Sec-WebSocket-Version")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		// Handle preflight OPTIONS requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// Call the next handler
		next.ServeHTTP(w, r)
	})
}

// ErrorResponseWriter wraps a http.ResponseWriter to ensure it always sends proper JSON errors
type ErrorResponseWriter struct {
	http.ResponseWriter
	errorSent bool
	path      string // Store the request path
}

// WriteHeader overrides the original method to always send proper JSON error responses
func (e *ErrorResponseWriter) WriteHeader(statusCode int) {
	// Don't modify WebSocket responses
	if strings.HasPrefix(e.path, "/ws/") {
		e.ResponseWriter.WriteHeader(statusCode)
		return
	}

	if statusCode >= 400 && !e.errorSent {
		e.errorSent = true
		e.ResponseWriter.Header().Set("Content-Type", "application/json")
		e.ResponseWriter.WriteHeader(statusCode)
		errorMsg := "Internal Server Error"
		if statusCode == http.StatusBadRequest {
			errorMsg = "Bad Request"
		} else if statusCode == http.StatusUnauthorized {
			errorMsg = "Unauthorized"
		} else if statusCode == http.StatusNotFound {
			errorMsg = "Not Found"
		}
		json.NewEncoder(e.ResponseWriter).Encode(map[string]string{
			"error": errorMsg,
		})
	} else {
		e.ResponseWriter.WriteHeader(statusCode)
	}
}

// Error middleware to ensure all errors are proper JSON responses
func errorMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip JSON error handling for WebSocket endpoints
		if strings.HasPrefix(r.URL.Path, "/ws/") {
			next.ServeHTTP(w, r)
			return
		}

		next.ServeHTTP(&ErrorResponseWriter{ResponseWriter: w, path: r.URL.Path}, r)
	})
}

func init() {
	// Create database directory if it doesn't exist
	dbDir := "./data"
	if _, err := os.Stat(dbDir); os.IsNotExist(err) {
		os.MkdirAll(dbDir, 0755)
	}

	// Create uploads directory if it doesn't exist
	uploadsDir := "./uploads"
	if _, err := os.Stat(uploadsDir); os.IsNotExist(err) {
		os.MkdirAll(uploadsDir, 0755)
	}

	var err error
	db, err = sqlite.New("./data/social-network.db")
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Run migrations with absolute path
	// Get the current working directory
	wd, err := os.Getwd()
	if err != nil {
		log.Fatalf("Failed to get working directory: %v", err)
	}

	// Create absolute path and convert to forward slashes for URL
	migrationPath := filepath.Join(wd, "pkg", "db", "migrations", "sqlite")
	migrationPath = filepath.ToSlash(migrationPath)

	if err := db.Migrate(migrationPath); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Initialize session store
	store = sessions.NewCookieStore(sessionKey)
	store.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   86400 * 7, // 7 days
		HttpOnly: true,
	}

	// Initialize auth handlers
	handlers.SetDependencies(db, store)
}

func main() {
	r := mux.NewRouter()

	// Apply middlewares globally - order matters!

	// WebSocket support middleware must be first to properly handle upgrade requests
	r.Use(webSocketSupportMiddleware)

	// CORS middleware next
	r.Use(corsMiddleware)

	// Error handling middleware
	r.Use(errorMiddleware)

	// Apply route protection middleware for frontend routes
	r.Use(middleware.RouteProtectionMiddleware)

	// Serve static files from the uploads directory
	fs := http.FileServer(http.Dir("./uploads"))
	r.PathPrefix("/uploads/").Handler(http.StripPrefix("/uploads/", fs))

	// Public routes
	r.HandleFunc("/api/register", handlers.RegisterHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/login", handlers.LoginHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/auth/check", handlers.CheckAuth).Methods("GET", "OPTIONS")

	// WebSocket routes - no method restrictions and exempt from error handling
	// Create a special WebSocket subrouter
	wsRouter := r.PathPrefix("/ws").Subrouter()
	wsRouter.HandleFunc("/chat", handlers.HandleWebSocket)
	log.Println("WebSocket endpoint registered at /ws/chat")

	// Private routes (require authentication)
	authRouter := r.PathPrefix("/api").Subrouter()
	authRouter.Use(handlers.AuthMiddleware)
	authRouter.HandleFunc("/profile", handlers.GetProfile).Methods("GET", "OPTIONS")
	authRouter.HandleFunc("/profile/update", handlers.UpdateProfile).Methods("POST", "OPTIONS")
	authRouter.HandleFunc("/logout", handlers.LogoutHandler).Methods("POST", "OPTIONS")

	// NEW: Routes for retrieving follower and following counts.
	// We pass the db instance so that the handler can use it.
	authRouter.HandleFunc("/followers/count", sqlite.SendFollowerCount(db)).Methods("GET", "OPTIONS")
	authRouter.HandleFunc("/following/count", sqlite.SendFollowingCount(db)).Methods("GET", "OPTIONS")

	// 404 Handler for undefined routes
	r.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip JSON errors for WebSocket requests
		if isWebSocketRequest(r) {
			w.WriteHeader(http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{
			"error":   "Not Found",
			"message": "The requested endpoint does not exist",
		})
	})

	// Start server
	port := 8080
	fmt.Printf("Server running on http://localhost:%d\n", port)
	fmt.Printf("WebSocket endpoint available at ws://localhost:%d/ws/chat\n", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%d", port), r); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
