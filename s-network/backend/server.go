package main

import (
	"encoding/json"
	"fmt"
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
	"s-network/backend/pkg/middleware"
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

// Error middleware to ensure all errors are proper JSON responses
func errorMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(&ErrorResponseWriter{ResponseWriter: w}, r)
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
	// Error handling middleware next
	r.Use(errorMiddleware)
	// Apply cookie configuration middleware
	r.Use(middleware.CookieConfigMiddleware)

	// Serve static files from the uploads directory
	fs := http.FileServer(http.Dir("./uploads"))
	r.PathPrefix("/uploads/").Handler(http.StripPrefix("/uploads/", fs))

	// Public routes
	r.HandleFunc("/api/register", handlers.RegisterHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/login", handlers.LoginHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/auth/check", handlers.CheckAuth).Methods("GET", "OPTIONS")
	
	// User search endpoint - available without authentication
	r.HandleFunc("/api/users/search", handlers.UserSearchHandler).Methods("GET", "OPTIONS")
	
	// Private routes (require authentication)
	authRouter := r.PathPrefix("/api").Subrouter()
	authRouter.Use(handlers.AuthMiddleware)
	authRouter.HandleFunc("/profile", handlers.GetProfile).Methods("GET", "OPTIONS")
	authRouter.HandleFunc("/profile/update", handlers.UpdateProfile).Methods("POST", "OPTIONS")
	authRouter.HandleFunc("/logout", handlers.LogoutHandler).Methods("POST", "OPTIONS")
	
	// Posts routes
	authRouter.HandleFunc("/posts", handlers.GetPostsHandler).Methods("GET", "OPTIONS")
	authRouter.HandleFunc("/posts", handlers.CreatePostHandler).Methods("POST", "OPTIONS")
	authRouter.HandleFunc("/posts/{id}", handlers.GetPostHandler).Methods("GET", "OPTIONS")
	authRouter.HandleFunc("/posts/{id}", handlers.DeletePostHandler).Methods("DELETE", "OPTIONS")
	authRouter.HandleFunc("/posts/{id}/comments", handlers.AddCommentHandler).Methods("POST", "OPTIONS")
	authRouter.HandleFunc("/posts/{id}/comments/{commentId}", handlers.DeleteCommentHandler).Methods("DELETE", "OPTIONS")
	authRouter.HandleFunc("/posts/{id}/vote", handlers.VotePostHandler).Methods("POST", "OPTIONS")
	authRouter.HandleFunc("/posts/{id}/comments/{commentId}/vote", handlers.VoteCommentHandler).Methods("POST", "OPTIONS")
	authRouter.HandleFunc("/followers", handlers.GetUserFollowersHandler).Methods("GET", "OPTIONS")
	
	// User data endpoint
	authRouter.HandleFunc("/users/me", handlers.GetCurrentUserHandler).Methods("GET", "OPTIONS")
	// Follow user endpoint
	authRouter.HandleFunc("/follow/{id}", handlers.FollowUserHandler).Methods("POST", "OPTIONS")

	// 404 Handler for undefined routes
	r.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{
			"error":   "Not Found",
			"message": "The requested endpoint does not exist",
		})
	})

	logger.Printf("Server setup completed in %v", time.Since(startTime))
	
	// Start server
	port := 8080
	fmt.Printf("Server running on http://localhost:%d\n", port)
	if err := http.ListenAndServe(fmt.Sprintf(":%d", port), r); err != nil {
		logger.Fatalf("Failed to start server: %v", err)
	}
}