package middleware

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/sessions"
)

// Session cookie name
const SessionCookieName = "social-network-session"

// Session store
var store *sessions.CookieStore

// SetStore sets the session store for middleware
func SetStore(sessionStore *sessions.CookieStore) {
	store = sessionStore
}

// AuthMiddleware checks if the user is authenticated
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, err := store.Get(r, SessionCookieName)
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

// LoggingMiddleware logs all requests
func LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Log the request if needed
		next.ServeHTTP(w, r)
	})
} 