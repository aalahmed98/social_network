package main

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/sessions"

	"s-network/backend/pkg/db/sqlite"
	"s-network/backend/pkg/handlers"
	"s-network/backend/pkg/logger"
)

var (
	db         *sqlite.DB
	store      *sessions.CookieStore
	sessionKey = []byte("social-network-secret-key")
)

// CORS middleware function with proper error handling
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get the origin from the request
		origin := r.Header.Get("Origin")

		// Check if the origin is from localhost (any port)
		if strings.HasPrefix(origin, "http://localhost:") ||
			strings.HasPrefix(origin, "https://localhost:") ||
			origin == "http://localhost" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			// Default to the Next.js development server
			w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Max-Age", "86400") // 24 hours cache

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
}

// WriteHeader overrides the original method to always send proper JSON error responses
func (e *ErrorResponseWriter) WriteHeader(statusCode int) {
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

// WebSocketMiddleware skips error handling for WebSocket connections
func webSocketMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip error middleware for WebSocket connections
		if strings.Contains(r.URL.Path, "/ws/") {
			next.ServeHTTP(w, r)
			return
		}
		
		// Apply error middleware for all other requests
		next.ServeHTTP(&ErrorResponseWriter{ResponseWriter: w}, r)
	})
}

// LoggingMiddleware logs requests
func LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// You could add logging here if needed
		next.ServeHTTP(w, r)
	})
}

// AuthMiddleware checks if the user is authenticated
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, err := store.Get(r, handlers.SessionCookieName)
		if err != nil {
			http.Error(w, "Session error", http.StatusUnauthorized)
			return
		}

		// Check if user is authenticated
		auth, ok := session.Values["authenticated"].(bool)
		if !ok || !auth {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Unauthorized",
			})
			return
		}

		// User is authenticated, proceed
		next.ServeHTTP(w, r)
	})
}

func init() {
	startTime := time.Now()
	logger.Println("Starting initialization...")

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
	logger.Printf("Directory setup completed in %v", time.Since(startTime))

	var err error
	dbStartTime := time.Now()
	logger.Println("Connecting to database...")

	// Create the database connection - the database file and tables will be created if they don't exist
	db, err = sqlite.New("./data/social-network.db")
	if err != nil {
		logger.Fatalf("Failed to connect to database: %v", err)
	}
	logger.Printf("Database connection established in %v", time.Since(dbStartTime))

	// Run migrations if needed - checking if any .sql files exist
	migrationStartTime := time.Now()
	wd, err := os.Getwd()
	if err != nil {
		logger.Fatalf("Failed to get working directory: %v", err)
	}

	// Create absolute path and convert to forward slashes for URL
	migrationPath := filepath.Join(wd, "pkg", "db", "migrations", "sqlite")
	migrationPath = filepath.ToSlash(migrationPath)

	// Check if migrations directory exists and has .sql files
	migrationsExist := false
	if _, err := os.Stat(migrationPath); err == nil {
		files, err := os.ReadDir(migrationPath)
		if err == nil {
			for _, file := range files {
				if strings.HasSuffix(file.Name(), ".sql") {
					migrationsExist = true
					break
				}
			}
		}
	}

	// Only run migrations if SQL files exist
	if migrationsExist {
		logger.Printf("Running database migrations from %s", migrationPath)
		if err := db.Migrate(migrationPath); err != nil {
			// Log error but continue - tables may already be created by our initialization
			logger.Printf("Migration warning (not critical): %v", err)
		}
		logger.Printf("Database migrations completed in %v", time.Since(migrationStartTime))
	} else {
		logger.Printf("No migrations found in %s, skipping", migrationPath)
	}

	// Initialize session store
	sessionStartTime := time.Now()
	logger.Println("Setting up session store...")
	store = sessions.NewCookieStore(sessionKey)

	// In development, we don't need SameSite=None and Secure
	isDev := true // Set to false in production

	storeOptions := &sessions.Options{
		Path:     "/",
		MaxAge:   86400 * 7, // 7 days
		HttpOnly: true,
	}

	if !isDev {
		storeOptions.SameSite = http.SameSiteNoneMode
		storeOptions.Secure = true
	}

	store.Options = storeOptions
	logger.Printf("Session store setup completed in %v", time.Since(sessionStartTime))

	// Initialize auth handlers
	handlersStartTime := time.Now()
	logger.Println("Setting up handlers...")
	handlers.SetDependencies(db, store)
	logger.Printf("Handlers setup completed in %v", time.Since(handlersStartTime))

	logger.Printf("Total initialization completed in %v", time.Since(startTime))
}

func main() {
	startTime := time.Now()
	logger.Println("Starting server setup...")

	r := mux.NewRouter()

	// Apply middlewares globally - order matters!
	// CORS middleware first
	r.Use(corsMiddleware)
	// Use custom WebSocket middleware instead of error middleware
	r.Use(webSocketMiddleware)

	// Create auth subrouter and apply middleware
	authRouter := r.PathPrefix("/api/auth").Subrouter()
	authRouter.Use(LoggingMiddleware)
	
	// Register auth routes
	handlers.RegisterAuthRoutes(authRouter)
	
	// Create API subrouter for authenticated endpoints
	apiRouter := r.PathPrefix("/api").Subrouter()
	apiRouter.Use(LoggingMiddleware)
	apiRouter.Use(AuthMiddleware)
	
	// Register other API routes
	handlers.RegisterPostRoutes(apiRouter)
	handlers.RegisterProfileRoutes(apiRouter)
	handlers.RegisterNotificationRoutes(apiRouter)
	
	// Register follow routes
	handlers.RegisterFollowRoutes(apiRouter)
	
	// Register chat routes including WebSocket endpoint
	handlers.RegisterChatRoutes(r)
	
	// Serve uploaded files
	uploadsFS := http.FileServer(http.Dir("./uploads"))
	r.PathPrefix("/uploads/").Handler(http.StripPrefix("/uploads/", uploadsFS))
	
	// Add a health check endpoint
	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]bool{"ok": true})
	})

	port := "8080"
	if envPort := os.Getenv("PORT"); envPort != "" {
		port = envPort
	}
	
	logger.Printf("Server setup completed in %v", time.Since(startTime))
	logger.Printf("Starting server on port %s...", port)
	logger.Fatal(http.ListenAndServe(":"+port, r))
}
