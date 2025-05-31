package handlers

import (
	"github.com/gorilla/mux"
)

// RegisterAuthRoutes registers all authentication-related routes
func RegisterAuthRoutes(router *mux.Router) {
	router.HandleFunc("/register", Register).Methods("POST", "OPTIONS")
	router.HandleFunc("/login", Login).Methods("POST", "OPTIONS")
	router.HandleFunc("/check", CheckAuth).Methods("GET", "OPTIONS")
	router.HandleFunc("/logout", Logout).Methods("POST", "OPTIONS")
	router.HandleFunc("/me", GetCurrentUser).Methods("GET", "OPTIONS")
}

// RegisterPostRoutes registers all post-related routes
func RegisterPostRoutes(router *mux.Router) {
	// Posts routes
	router.HandleFunc("/posts", GetPostsHandler).Methods("GET", "OPTIONS")
	router.HandleFunc("/posts", CreatePostHandler).Methods("POST", "OPTIONS")
	router.HandleFunc("/posts/{id}", GetPostHandler).Methods("GET", "OPTIONS")
	router.HandleFunc("/posts/{id}", DeletePostHandler).Methods("DELETE", "OPTIONS")
	router.HandleFunc("/posts/{id}/comments", AddCommentHandler).Methods("POST", "OPTIONS")
	router.HandleFunc("/posts/{id}/comments/{commentId}", DeleteCommentHandler).Methods("DELETE", "OPTIONS")
	router.HandleFunc("/posts/{id}/vote", VotePostHandler).Methods("POST", "OPTIONS")
	router.HandleFunc("/posts/{id}/comments/{commentId}/vote", VoteCommentHandler).Methods("POST", "OPTIONS")
}

// RegisterProfileRoutes registers all profile-related routes
func RegisterProfileRoutes(router *mux.Router) {
	// User profile routes
	router.HandleFunc("/profile", GetProfile).Methods("GET", "OPTIONS")
	router.HandleFunc("/profile/update", UpdateProfile).Methods("POST", "OPTIONS")
	
	// User data endpoints
	router.HandleFunc("/users/me", GetCurrentUser).Methods("GET", "OPTIONS")
	router.HandleFunc("/users/search", UserSearchHandler).Methods("GET", "OPTIONS")
	router.HandleFunc("/users/{id}", GetUsersProfile).Methods("GET", "OPTIONS")
	router.HandleFunc("/users/{id}/following", GetUserFollowingByIDHandler).Methods("GET", "OPTIONS")
	
	// Follow-related routes
	router.HandleFunc("/followers", GetUserFollowersHandler).Methods("GET", "OPTIONS")
	router.HandleFunc("/following", GetUserFollowingHandler).Methods("GET", "OPTIONS")
} 