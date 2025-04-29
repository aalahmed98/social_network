package middleware

import (
	"net/http"
)

// CookieConfigMiddleware ensures proper cookie headers are set
func CookieConfigMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set SameSite policy to None to allow cross-site requests
		w.Header().Set("Set-Cookie", "SameSite=None; Secure")
		
		// Continue with the request
		next.ServeHTTP(w, r)
	})
} 