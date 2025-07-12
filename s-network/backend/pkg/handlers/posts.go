package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"s-network/backend/pkg/db/sqlite"
	"s-network/backend/pkg/utils"
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
	session, err := store.Get(r, SessionCookieName)
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
		uploadsDir := utils.GetUploadSubdir("posts")
		os.MkdirAll(uploadsDir, 0755)

		// Generate a unique filename
		ext := filepath.Ext(handler.Filename)
		filename := uuid.New().String() + ext
		imageURL = utils.GetUploadURL(filename, "posts")

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
	session, err := store.Get(r, SessionCookieName)
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

// GetExplorePostsHandler retrieves all public posts for the explore page
func GetExplorePostsHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from session
	session, err := store.Get(r, SessionCookieName)
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

	// Get public posts from the database
	posts, err := db.GetExplorePosts(userID, page, limit)
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
	session, err := store.Get(r, SessionCookieName)
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
	session, err := store.Get(r, SessionCookieName)
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

	// Handle file upload
	var imageURL string
	file, handler, err := r.FormFile("image")
	if err == nil {
		defer file.Close()

		// Create uploads directory if it doesn't exist
		uploadsDir := utils.GetUploadSubdir("comments")
		os.MkdirAll(uploadsDir, 0755)

		// Generate a unique filename
		ext := filepath.Ext(handler.Filename)
		filename := uuid.New().String() + ext
		imageURL = utils.GetUploadURL(filename, "comments")

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

	// Validate that we have either content or an image
	if content == "" && imageURL == "" {
		http.Error(w, "Either content or image is required", http.StatusBadRequest)
		return
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
	session, err := store.Get(r, SessionCookieName)
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

// //////////////////////////////////////////////////////////////////////////////////////////////////////////
// GetUserFollowersHandler retrieves followers for the authenticated user
func GetUserFollowingHandler(w http.ResponseWriter, r *http.Request) {
	// Try reading userId from query string
	queryID := r.URL.Query().Get("userId")

	var userID int
	var err error

	if queryID != "" {
		userID, err = strconv.Atoi(queryID)
		if err != nil {
			http.Error(w, "Invalid user ID", http.StatusBadRequest)
			return
		}
	} else {
		// fallback to session-based authenticated user
		session, err := store.Get(r, SessionCookieName)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		var ok bool
		userID, ok = session.Values["user_id"].(int)
		if !ok {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
	}

	following, err := db.GetUserFollowing(userID)
	if err != nil {
		http.Error(w, "Failed to retrieve following: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"followings": following,
	})
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// FollowUserHandler allows a user to follow another user
func FollowUserHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from session
	session, err := store.Get(r, SessionCookieName)
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

	// Get user to check if account is public or private
	userToFollow, err := db.GetUserById(followingID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	isPublic, ok := userToFollow["is_public"].(bool)
	if !ok {
		isPublic = true // Default to public if field is missing
	}

	if isPublic {
		// Direct follow for public accounts
		err = db.FollowUser(followerID, followingID)
		if err != nil {
			http.Error(w, "Failed to follow user: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// Create notification for the user being followed
		followerUser, err := db.GetUserById(followerID)
		if err == nil {
			followerName := followerUser["first_name"].(string) + " " + followerUser["last_name"].(string)
			db.CreateNotification(&sqlite.Notification{
				ReceiverID:  int64(followingID),
				SenderID:    int64(followerID),
				Type:        "follow",
				Content:     followerName + " started following you",
				ReferenceID: int64(followerID),
				IsRead:      false,
			})

			// Send real-time notification
			SendFollowNotification(int64(followingID), int64(followerID), "follow",
				followerName+" started following you", int64(followerID))
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "User followed successfully",
			"status":  "followed",
		})
	} else {
		// Create follow request for private accounts
		exists, err := db.CheckFollowRequestExists(int64(followerID), int64(followingID))
		if err != nil {
			http.Error(w, "Failed to check follow request: "+err.Error(), http.StatusInternalServerError)
			return
		}

		if exists {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"message": "Follow request already sent",
				"status":  "request_sent",
			})
			return
		}

		requestID, err := db.CreateFollowRequest(int64(followerID), int64(followingID))
		if err != nil {
			http.Error(w, "Failed to create follow request: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// Create notification for the follow request
		followerUser, err := db.GetUserById(followerID)
		if err == nil {
			followerName := followerUser["first_name"].(string) + " " + followerUser["last_name"].(string)
			db.CreateNotification(&sqlite.Notification{
				ReceiverID:  int64(followingID),
				SenderID:    int64(followerID),
				Type:        "follow_request",
				Content:     followerName + " wants to follow you",
				ReferenceID: requestID,
				IsRead:      false,
			})

			// Send real-time notification
			SendFollowNotification(int64(followingID), int64(followerID), "follow_request",
				followerName+" wants to follow you", requestID)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message":   "Follow request sent successfully",
			"status":    "request_sent",
			"requestId": requestID,
		})
	}
}

// GetFollowStatusHandler checks if a user is following another user or has a pending follow request
func GetFollowStatusHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from session
	session, err := store.Get(r, SessionCookieName)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	followerID, ok := session.Values["user_id"].(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get user ID to check from request
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

	// Check if the user is following
	isFollowing, err := db.IsFollowing(followerID, followingID)
	if err != nil {
		http.Error(w, "Failed to check follow status: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Check if a follow request exists
	followRequestSent, err := db.CheckFollowRequestExists(int64(followerID), int64(followingID))
	if err != nil {
		http.Error(w, "Failed to check follow request: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"isFollowing":       isFollowing,
		"followRequestSent": followRequestSent,
	})
}

// UnfollowUserHandler allows a user to unfollow another user
func UnfollowUserHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from session
	session, err := store.Get(r, SessionCookieName)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	followerID, ok := session.Values["user_id"].(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get user ID to unfollow from request
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

	// Remove follow relationship
	err = db.UnfollowUser(followerID, followingID)
	if err != nil {
		http.Error(w, "Failed to unfollow user: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "User unfollowed successfully",
	})
}

// AcceptFollowRequestHandler allows a user to accept a follow request
func AcceptFollowRequestHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from session
	session, err := store.Get(r, SessionCookieName)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	userID, ok := session.Values["user_id"].(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get request ID from URL
	vars := mux.Vars(r)
	requestIDStr, ok := vars["id"]
	if !ok {
		http.Error(w, "Request ID is required", http.StatusBadRequest)
		return
	}

	requestID, err := strconv.ParseInt(requestIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid request ID", http.StatusBadRequest)
		return
	}

	// Get follow request to verify it's for this user
	request, err := db.GetFollowRequest(requestID)
	if err != nil {
		http.Error(w, "Follow request not found", http.StatusNotFound)
		return
	}

	if request.FollowingID != int64(userID) {
		http.Error(w, "Unauthorized to accept this request", http.StatusForbidden)
		return
	}

	// Accept the follow request
	err = db.AcceptFollowRequest(requestID)
	if err != nil {
		http.Error(w, "Failed to accept follow request: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Create notification for accepted request
	// Get follower user info for the notification
	followingUser, err := db.GetUserById(userID)
	if err == nil {
		followerID := request.FollowerID
		followingName := followingUser["first_name"].(string) + " " + followingUser["last_name"].(string)
		db.CreateNotification(&sqlite.Notification{
			ReceiverID:  followerID,
			SenderID:    int64(userID),
			Type:        "follow_accepted",
			Content:     followingName + " accepted your follow request",
			ReferenceID: int64(userID),
			IsRead:      false,
		})

		// Send real-time notification
		SendFollowNotification(followerID, int64(userID), "follow_accepted",
			followingName+" accepted your follow request", int64(userID))
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Follow request accepted successfully",
	})
}

// RejectFollowRequestHandler allows a user to reject a follow request
func RejectFollowRequestHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from session
	session, err := store.Get(r, SessionCookieName)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	userID, ok := session.Values["user_id"].(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get request ID from URL
	vars := mux.Vars(r)
	requestIDStr, ok := vars["id"]
	if !ok {
		http.Error(w, "Request ID is required", http.StatusBadRequest)
		return
	}

	requestID, err := strconv.ParseInt(requestIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid request ID", http.StatusBadRequest)
		return
	}

	// Check if the follow request still exists
	exists, err := db.CheckFollowRequestExistsById(requestID)
	if err != nil {
		fmt.Printf("Error checking if follow request exists: %v\n", err)
		// Continue to try get the request
	} else if !exists {
		// The request doesn't exist anymore, it might have been deleted by another operation
		fmt.Printf("Follow request %d doesn't exist in the database\n", requestID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "Follow request already processed",
		})
		return
	}

	// Get follow request to verify it's for this user
	request, err := db.GetFollowRequest(requestID)
	if err != nil {
		if err.Error() == "follow request not found" {
			// Special case: request not found but might have been deleted by a race condition
			fmt.Printf("Follow request %d not found\n", requestID)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"message": "Follow request already processed",
			})
			return
		}
		http.Error(w, "Failed to get follow request: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if request == nil {
		fmt.Printf("Follow request %d is nil\n", requestID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "Follow request already processed",
		})
		return
	}

	if request.FollowingID != int64(userID) {
		http.Error(w, "Unauthorized to reject this request", http.StatusForbidden)
		return
	}

	// Reject the follow request
	err = db.RejectFollowRequest(requestID)
	if err != nil {
		if err.Error() == "follow request not found" {
			// Special case: request not found but might have been deleted by a race condition
			fmt.Printf("Follow request %d not found during rejection\n", requestID)
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"message": "Follow request already processed",
			})
			return
		}
		http.Error(w, "Failed to reject follow request: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Follow request rejected successfully",
	})
}

// DeletePostHandler removes a post by ID
func DeletePostHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from session
	session, err := store.Get(r, SessionCookieName)
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
	session, err := store.Get(r, SessionCookieName)
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
		"message":  "Comment deleted successfully",
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
	session, err := store.Get(r, SessionCookieName)
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
	session, err := store.Get(r, SessionCookieName)
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
		"comment":    comment,
		"user_vote":  userVote,
		"vote_count": comment["vote_count"],
		"post_id":    postID,
	}

	// Return updated comment data
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// CancelFollowRequestHandler allows a user to cancel their follow request
func CancelFollowRequestHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from session
	session, err := store.Get(r, SessionCookieName)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	followerID, ok := session.Values["user_id"].(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get user ID to unfollow from request
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

	// Cancel the follow request
	err = db.CancelFollowRequest(int64(followerID), int64(followingID))
	if err != nil {
		http.Error(w, "Failed to cancel follow request: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Follow request canceled successfully",
	})
}

// RemoveFollowerHandler allows a user to remove someone from their followers list
func RemoveFollowerHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from session (the user who wants to remove a follower)
	session, err := store.Get(r, SessionCookieName)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	userID, ok := session.Values["user_id"].(int)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get follower ID to remove from request
	vars := mux.Vars(r)
	followerIDStr, ok := vars["id"]
	if !ok {
		http.Error(w, "Follower ID is required", http.StatusBadRequest)
		return
	}

	followerID, err := strconv.Atoi(followerIDStr)
	if err != nil {
		http.Error(w, "Invalid follower ID", http.StatusBadRequest)
		return
	}

	// Remove the follow relationship (the followerID follows userID, so we unfollow)
	err = db.UnfollowUser(followerID, userID)
	if err != nil {
		http.Error(w, "Failed to remove follower: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Follower removed successfully",
	})
}

// RegisterFollowRoutes registers follow-related routes
func RegisterFollowRoutes(router *mux.Router) {
	router.HandleFunc("/follow/status/{id}", GetFollowStatusHandler).Methods("GET", "OPTIONS")
	router.HandleFunc("/follow/{id}", FollowUserHandler).Methods("POST", "OPTIONS")
	router.HandleFunc("/follow/{id}", UnfollowUserHandler).Methods("DELETE", "OPTIONS")
	router.HandleFunc("/follow/request/{id}/accept", AcceptFollowRequestHandler).Methods("POST", "OPTIONS")
	router.HandleFunc("/follow/request/{id}/reject", RejectFollowRequestHandler).Methods("POST", "OPTIONS")
	router.HandleFunc("/follow/request/{id}/cancel", CancelFollowRequestHandler).Methods("POST", "OPTIONS")
	router.HandleFunc("/followers/remove/{id}", RemoveFollowerHandler).Methods("DELETE", "OPTIONS")
}

// GetUserFollowingByIDHandler retrieves following list for a specific user
func GetUserFollowingByIDHandler(w http.ResponseWriter, r *http.Request) {
	// Get user ID from URL path
	vars := mux.Vars(r)
	userIDStr, ok := vars["id"]
	if !ok {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Get following list
	following, err := db.GetUserFollowing(userID)
	if err != nil {
		http.Error(w, "Failed to retrieve following: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"following": following,
	})
}
