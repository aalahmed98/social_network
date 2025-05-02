package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// CreatePostRequest represents the JSON structure for creating a post
type CreatePostRequest struct {
	Title            string `json:"title"`
	Content          string `json:"content"`
	Privacy          string `json:"privacy"`
	AllowedFollowers []int  `json:"allowedFollowers,omitempty"`
}

// CreatePostHandler creates a new post
func CreatePostHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from session
	session, err := store.Get(r, "session")
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	userID, ok := session.Values["user_id"].(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse multipart form for file uploads
	err = r.ParseMultipartForm(10 << 20) // 10 MB max
	if err != nil {
		http.Error(w, "Unable to parse form", http.StatusBadRequest)
		return
	}

	// Get form values
	title := r.FormValue("title")
	
	// Content is now optional, no validation needed
	content := r.FormValue("content")
	
	privacy := r.FormValue("privacy")
	if privacy == "" {
		privacy = "public" // Default to public
	}

	if privacy != "public" && privacy != "almost_private" && privacy != "private" {
		http.Error(w, "Invalid privacy setting", http.StatusBadRequest)
		return
	}

	// Parse allowed followers if privacy is private
	var allowedFollowers []int
	if privacy == "private" {
		allowedFollowersStr := r.FormValue("allowedFollowers")
		if allowedFollowersStr != "" {
			var followerIDs []int
			err = json.Unmarshal([]byte(allowedFollowersStr), &followerIDs)
			if err != nil {
				http.Error(w, "Invalid allowed followers format", http.StatusBadRequest)
				return
			}
			allowedFollowers = followerIDs
		}
	}

	// Handle file upload
	var imageURL string
	file, handler, err := r.FormFile("image")
	if err == nil {
		defer file.Close()

		// Create uploads directory if it doesn't exist
		uploadsDir := "./uploads/posts"
		os.MkdirAll(uploadsDir, 0755)

		// Generate a unique filename
		ext := filepath.Ext(handler.Filename)
		filename := uuid.New().String() + ext
		imageURL = "/uploads/posts/" + filename
		
		// Create the file
		dst, err := os.Create(filepath.Join(uploadsDir, filename))
		if err != nil {
			http.Error(w, "Failed to save image", http.StatusInternalServerError)
			return
		}
		defer dst.Close()

		// Copy the file content
		if _, err = io.Copy(dst, file); err != nil {
			http.Error(w, "Failed to save image", http.StatusInternalServerError)
			return
		}
	}

	// Create post in the database
	postID, err := db.CreatePost(userID, title, content, imageURL, privacy, allowedFollowers)
	if err != nil {
		http.Error(w, "Failed to create post: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Get the newly created post
	post, err := db.GetPost(postID)
	if err != nil {
		http.Error(w, "Failed to retrieve created post", http.StatusInternalServerError)
		return
	}

	// Return post data
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(post)
}

// GetPostsHandler retrieves posts for the authenticated user
func GetPostsHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from session
	session, err := store.Get(r, "session")
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	userID, ok := session.Values["user_id"].(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse pagination parameters
	page := 1
	limit := 10

	pageStr := r.URL.Query().Get("page")
	if pageStr != "" {
		pageNum, err := strconv.Atoi(pageStr)
		if err == nil && pageNum > 0 {
			page = pageNum
		}
	}

	limitStr := r.URL.Query().Get("limit")
	if limitStr != "" {
		limitNum, err := strconv.Atoi(limitStr)
		if err == nil && limitNum > 0 && limitNum <= 50 {
			limit = limitNum
		}
	}

	// Get posts from the database
	posts, err := db.GetPosts(userID, page, limit)
	if err != nil {
		http.Error(w, "Failed to retrieve posts: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Set is_author flag for each post
	for i := range posts {
		postUserID, ok := posts[i]["user_id"].(int64)
		if ok && int64(userID) == postUserID {
			posts[i]["is_author"] = true
		} else {
			posts[i]["is_author"] = false
		}
	}

	// Return post data
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"posts": posts,
		"page":  page,
		"limit": limit,
	})
}

// GetPostHandler retrieves a specific post by ID
func GetPostHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from session
	session, err := store.Get(r, "session")
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	userID, ok := session.Values["user_id"].(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get post ID from URL
	vars := mux.Vars(r)
	postIDStr, ok := vars["id"]
	if !ok {
		http.Error(w, "Post ID is required", http.StatusBadRequest)
		return
	}

	postID, err := strconv.ParseInt(postIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	// Get post data
	post, err := db.GetPost(postID)
	if err != nil {
		if err.Error() == "sql: no rows in result set" {
			http.Error(w, "Post not found", http.StatusNotFound)
		} else {
			http.Error(w, "Failed to retrieve post: "+err.Error(), http.StatusInternalServerError)
		}
		return
	}

	// Check if the user is the post owner
	postUserID, ok := post["user_id"].(int64)
	if ok && int64(userID) == postUserID {
		post["is_author"] = true
	} else {
		post["is_author"] = false
	}

	// Get user's vote on this post
	userVote, err := db.GetUserVote(userID, postID, "post")
	if err == nil {
		post["user_vote"] = userVote
	}

	// Get comments for this post
	comments, err := db.GetCommentsByPostIDWithUserVotes(postID, userID)
	if err == nil {
		// Set is_author flag for each comment
		for i := range comments {
			commentUserID, ok := comments[i]["user_id"].(int64)
			if ok && int64(userID) == commentUserID {
				comments[i]["is_author"] = true
			} else {
				comments[i]["is_author"] = false
			}

			// Also set is_post_author flag if the user is the post author
			if int64(userID) == postUserID {
				comments[i]["is_post_author"] = true
			} else {
				comments[i]["is_post_author"] = false
			}
		}
		
		post["comments"] = comments
	}

	// Return post data as JSON
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(post)
}

// AddCommentHandler adds a comment to a post
func AddCommentHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from session
	session, err := store.Get(r, "session")
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	userID, ok := session.Values["user_id"].(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get post ID from URL
	vars := mux.Vars(r)
	postIDStr, ok := vars["id"]
	if !ok {
		http.Error(w, "Post ID is required", http.StatusBadRequest)
		return
	}

	postID, err := strconv.ParseInt(postIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	// Get post to check ownership
	post, err := db.GetPost(postID)
	if err != nil {
		http.Error(w, "Post not found", http.StatusNotFound)
		return
	}
	
	// Get post user ID
	postUserID, ok := post["user_id"].(int64)
	if !ok {
		http.Error(w, "Failed to determine post ownership", http.StatusInternalServerError)
		return
	}

	// Parse multipart form for file uploads
	err = r.ParseMultipartForm(10 << 20) // 10 MB max
	if err != nil {
		http.Error(w, "Unable to parse form", http.StatusBadRequest)
		return
	}

	// Get form values
	content := r.FormValue("content")
	if content == "" {
		http.Error(w, "Content is required", http.StatusBadRequest)
		return
	}

	// Handle file upload
	var imageURL string
	file, handler, err := r.FormFile("image")
	if err == nil {
		defer file.Close()

		// Create uploads directory if it doesn't exist
		uploadsDir := "./uploads/comments"
		os.MkdirAll(uploadsDir, 0755)

		// Generate a unique filename
		ext := filepath.Ext(handler.Filename)
		filename := uuid.New().String() + ext
		imageURL = "/uploads/comments/" + filename
		
		// Create the file
		dst, err := os.Create(filepath.Join(uploadsDir, filename))
		if err != nil {
			http.Error(w, "Failed to save image", http.StatusInternalServerError)
			return
		}
		defer dst.Close()

		// Copy the file content
		if _, err = io.Copy(dst, file); err != nil {
			http.Error(w, "Failed to save image", http.StatusInternalServerError)
			return
		}
	}

	// Add comment to the database
	commentID, err := db.AddComment(postID, int64(userID), content, imageURL)
	if err != nil {
		http.Error(w, "Failed to add comment: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Get all comments for the post
	comments, err := db.GetCommentsByPostID(postID)
	if err != nil {
		http.Error(w, "Failed to retrieve comments: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Set is_author flag for each comment
	for i := range comments {
		commentUserID, ok := comments[i]["user_id"].(int64)
		if ok && int64(userID) == commentUserID {
			comments[i]["is_author"] = true
		} else {
			comments[i]["is_author"] = false
		}
		
		// Also set is_post_author flag if the user is the post author
		if int64(userID) == postUserID {
			comments[i]["is_post_author"] = true
		} else {
			comments[i]["is_post_author"] = false
		}
	}

	// Return comments data
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":       commentID,
		"comments": comments,
	})
}

// GetUserFollowersHandler retrieves followers for the authenticated user
func GetUserFollowersHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from session
	session, err := store.Get(r, "session")
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	userID, ok := session.Values["user_id"].(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get followers from the database
	followers, err := db.GetUserFollowers(userID)
	if err != nil {
		http.Error(w, "Failed to retrieve followers: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Return followers data
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"followers": followers,
	})
}

// FollowUserHandler allows a user to follow another user
func FollowUserHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from session
	session, err := store.Get(r, "session")
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	followerID, ok := session.Values["user_id"].(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get user ID to follow from request
	vars := mux.Vars(r)
	userIDStr, ok := vars["id"]
	if !ok {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	followingID, err := strconv.Atoi(userIDStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Can't follow yourself
	if followerID == followingID {
		http.Error(w, "You cannot follow yourself", http.StatusBadRequest)
		return
	}

	// Add follow relationship in the database
	err = db.FollowUser(followerID, followingID)
	if err != nil {
		http.Error(w, "Failed to follow user: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "User followed successfully",
	})
}

// DeletePostHandler removes a post by ID
func DeletePostHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from session
	session, err := store.Get(r, "session")
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	userID, ok := session.Values["user_id"].(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get post ID from URL
	vars := mux.Vars(r)
	postIDStr, ok := vars["id"]
	if !ok {
		http.Error(w, "Post ID is required", http.StatusBadRequest)
		return
	}

	postID, err := strconv.ParseInt(postIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	// Get post to check if the user is the owner
	post, err := db.GetPost(postID)
	if err != nil {
		http.Error(w, "Post not found", http.StatusNotFound)
		return
	}

	// Check if the user is the owner of the post
	postUserID, ok := post["user_id"].(int64)
	if !ok || int64(userID) != postUserID {
		http.Error(w, "Unauthorized to delete this post", http.StatusForbidden)
		return
	}

	// Delete the post
	err = db.DeletePost(postID)
	if err != nil {
		http.Error(w, "Failed to delete post: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Post deleted successfully along with all associated comments and votes",
	})
}

// DeleteCommentHandler removes a comment by ID
func DeleteCommentHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from session
	session, err := store.Get(r, "session")
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	userID, ok := session.Values["user_id"].(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get post ID and comment ID from URL
	vars := mux.Vars(r)
	
	postIDStr, ok := vars["id"]
	if !ok {
		http.Error(w, "Post ID is required", http.StatusBadRequest)
		return
	}

	commentIDStr, ok := vars["commentId"]
	if !ok {
		http.Error(w, "Comment ID is required", http.StatusBadRequest)
		return
	}

	postID, err := strconv.ParseInt(postIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	commentID, err := strconv.ParseInt(commentIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid comment ID", http.StatusBadRequest)
		return
	}

	// Get the comment to check if the user is the owner
	comment, err := db.GetCommentByID(commentID)
	if err != nil {
		http.Error(w, "Comment not found", http.StatusNotFound)
		return
	}

	// Check if the user is the owner of the comment
	commentUserID, ok := comment["user_id"].(int64)
	if !ok {
		http.Error(w, "Failed to determine comment ownership", http.StatusInternalServerError)
		return
	}

	// Get the post to check if the user is the post owner (post owners can delete any comment on their post)
	post, err := db.GetPost(postID)
	if err != nil {
		http.Error(w, "Post not found", http.StatusNotFound)
		return
	}

	postUserID, ok := post["user_id"].(int64)
	if !ok {
		http.Error(w, "Failed to determine post ownership", http.StatusInternalServerError)
		return
	}

	// Allow deletion only if the user is the comment owner or the post owner
	if int64(userID) != commentUserID && int64(userID) != postUserID {
		http.Error(w, "Unauthorized to delete this comment", http.StatusForbidden)
		return
	}

	// Delete the comment
	err = db.DeleteComment(commentID)
	if err != nil {
		http.Error(w, "Failed to delete comment: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Return updated comments for the post
	comments, err := db.GetCommentsByPostID(postID)
	if err != nil {
		http.Error(w, "Failed to retrieve updated comments", http.StatusInternalServerError)
		return
	}

	// Set is_author flag for each comment
	for i := range comments {
		commentUserID, ok := comments[i]["user_id"].(int64)
		if ok && int64(userID) == commentUserID {
			comments[i]["is_author"] = true
		} else {
			comments[i]["is_author"] = false
		}

		// Also set is_post_author flag if the user is the post author
		if int64(userID) == postUserID {
			comments[i]["is_post_author"] = true
		} else {
			comments[i]["is_post_author"] = false
		}
	}

	// Return success response with updated comments
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Comment deleted successfully",
		"comments": comments,
	})
}
// VotePostHandler handles upvotes and downvotes on posts
func VotePostHandler(w http.ResponseWriter, r *http.Request) {
	// Handle CORS preflight request
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Get user ID from session
	session, err := store.Get(r, "session")
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	userID, ok := session.Values["user_id"].(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get post ID from URL
	vars := mux.Vars(r)
	postIDStr, ok := vars["id"]
	if !ok {
		http.Error(w, "Post ID is required", http.StatusBadRequest)
		return
	}

	postID, err := strconv.ParseInt(postIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	// Parse request body
	var voteRequest struct {
		VoteType int `json:"vote_type"` // 1 for upvote, -1 for downvote
	}

	err = json.NewDecoder(r.Body).Decode(&voteRequest)
	if err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate vote type
	if voteRequest.VoteType != 1 && voteRequest.VoteType != -1 {
		http.Error(w, "Invalid vote type. Must be 1 (upvote) or -1 (downvote)", http.StatusBadRequest)
		return
	}

	// Apply the vote
	err = db.Vote(userID, postID, "post", voteRequest.VoteType)
	if err != nil {
		http.Error(w, "Failed to vote on post: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Get updated post
	post, err := db.GetPost(postID)
	if err != nil {
		http.Error(w, "Failed to retrieve updated post", http.StatusInternalServerError)
		return
	}

	// Return updated post data
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(post)
}

// VoteCommentHandler handles upvotes and downvotes on comments
func VoteCommentHandler(w http.ResponseWriter, r *http.Request) {
	// Handle CORS preflight request
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Get user ID from session
	session, err := store.Get(r, "session")
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	userID, ok := session.Values["user_id"].(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get post ID and comment ID from URL
	vars := mux.Vars(r)
	
	postIDStr, ok := vars["id"]
	if !ok {
		http.Error(w, "Post ID is required", http.StatusBadRequest)
		return
	}

	commentIDStr, ok := vars["commentId"]
	if !ok {
		http.Error(w, "Comment ID is required", http.StatusBadRequest)
		return
	}

	postID, err := strconv.ParseInt(postIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	commentID, err := strconv.ParseInt(commentIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid comment ID", http.StatusBadRequest)
		return
	}

	// Parse request body
	var voteRequest struct {
		VoteType int `json:"vote_type"` // 1 for upvote, -1 for downvote
	}

	err = json.NewDecoder(r.Body).Decode(&voteRequest)
	if err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate vote type
	if voteRequest.VoteType != 1 && voteRequest.VoteType != -1 {
		http.Error(w, "Invalid vote type. Must be 1 (upvote) or -1 (downvote)", http.StatusBadRequest)
		return
	}

	// Apply the vote
	err = db.Vote(userID, commentID, "comment", voteRequest.VoteType)
	if err != nil {
		http.Error(w, "Failed to vote on comment: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Get the comment
	comment, err := db.GetCommentByID(commentID)
	if err != nil {
		http.Error(w, "Failed to retrieve updated comment", http.StatusInternalServerError)
		return
	}

	// Get the user's vote
	userVote, err := db.GetUserVote(userID, commentID, "comment")
	if err != nil {
		userVote = 0 // Default if there's an error
	}

	// Add vote information to the response
	response := map[string]interface{}{
		"comment":   comment,
		"user_vote": userVote,
		"vote_count": comment["vote_count"],
		"post_id": postID,
	}

	// Return updated comment data
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
