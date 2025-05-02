package middleware

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"

	"s-network/backend/pkg/logger"
)

// Protected paths that require authentication
var protectedPaths = []string{
	"/dashboard",
	"/profile",
	"/posts",
	"/groups",
	"/chats",
}

// RouteProtectionMiddleware is a middleware that checks if a request should be authenticated
// before reaching protected routes. This follows the frontend middleware pattern but implemented
// in Go for the backend server.
func RouteProtectionMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// Check if the path is protected
		isProtectedPath := false
		for _, protectedPath := range protectedPaths {
			if path == protectedPath || strings.HasPrefix(path, protectedPath+"/") {
				isProtectedPath = true
				break
			}
		}

		// If not a protected path, continue to the next handler
		if !isProtectedPath {
			next.ServeHTTP(w, r)
			return
		}

		// Get the session cookie
		cookie, err := r.Cookie("session")
		if err != nil || cookie.Value == "" {
			logger.Printf("No session cookie found for path %s, redirecting to login", path)
			redirectToLogin(w, r)
			return
		}

		// Create a request to the auth check endpoint
		client := &http.Client{}
		
		// Get backend URL from environment variable or use default
		backendURL := os.Getenv("BACKEND_URL")
		if backendURL == "" {
			backendURL = "http://localhost:8080" // Default backend URL
		}
		
		req, err := http.NewRequest("GET", backendURL+"/api/auth/check", nil)
		if err != nil {
			logger.Printf("Error creating auth check request: %v", err)
			redirectToLogin(w, r)
			return
		}

		// Copy the session cookie to the request
		req.Header.Add("Cookie", "session="+cookie.Value)

		// Send the request
		resp, err := client.Do(req)
		if err != nil {
			logger.Printf("Error checking authentication: %v", err)
			redirectToLogin(w, r)
			return
		}
		defer resp.Body.Close()

		// Check the response status
		if resp.StatusCode != http.StatusOK {
			logger.Printf("Auth check failed with status %d for path %s", resp.StatusCode, path)
			redirectToLogin(w, r)
			return
		}

		// If we got here, the authentication passed
		next.ServeHTTP(w, r)
	})
}

// redirectToLogin redirects the user to the login page
func redirectToLogin(w http.ResponseWriter, r *http.Request) {
	redirectURL := "/login"
	
	// Add the original path as a redirect parameter
	if r.URL.Path != "/" && r.URL.Path != "/login" {
		redirectURL += "?redirect=" + r.URL.Path
	}
	
	// Set content type for JSON response, as we're mimicking API behavior
	w.Header().Set("Content-Type", "application/json")
	
	// Send JSON response for API calls
	if strings.HasPrefix(r.URL.Path, "/api/") {
		w.WriteHeader(http.StatusUnauthorized)
		err := json.NewEncoder(w).Encode(map[string]string{
			"error": "Unauthorized",
		})
		if err != nil {
			logger.Printf("Error encoding JSON response: %v", err)
		}
		return
	}
	
	// For web pages, redirect to login
	http.Redirect(w, r, redirectURL, http.StatusFound)
} 