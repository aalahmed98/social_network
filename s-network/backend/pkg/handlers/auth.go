package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/sessions"
	"golang.org/x/crypto/bcrypt"

	"s-network/backend/pkg/db/sqlite"
	"s-network/backend/pkg/utils"
)

var (
	db    *sqlite.DB
	store *sessions.CookieStore
)

// SessionCookieName is the name of the session cookie
const SessionCookieName = "social-network-session"

// SetDependencies initializes the handlers package with the database and session store
func SetDependencies(database *sqlite.DB, sessionStore *sessions.CookieStore) {
	db = database
	store = sessionStore
}

// RegisterRequest represents the data needed for user registration
type RegisterRequest struct {
	Email     string `json:"email"`
	Password  string `json:"password"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	DOB       string `json:"dob"`
	Avatar    string `json:"avatar"`
	Nickname  string `json:"nickname"`
	AboutMe   string `json:"aboutMe"`
}

// LoginRequest represents the data needed for user login
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// generateSessionID creates a random session ID
func generateSessionID() (string, error) {
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// generateAuthToken creates a random auth token
func generateAuthToken() (string, error) {
	b := make([]byte, 64) // Longer token for better security
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// createAuthToken creates and saves an auth token for the user
func createAuthToken(userID int, tokenType string) (string, error) {
	// Generate token
	token, err := generateAuthToken()
	if err != nil {
		return "", err
	}

	// Set expiry based on token type
	var expiryDuration time.Duration
	switch tokenType {
	case "login":
		expiryDuration = 7 * 24 * time.Hour // 7 days
	case "remember":
		expiryDuration = 30 * 24 * time.Hour // 30 days
	case "api":
		expiryDuration = 90 * 24 * time.Hour // 90 days
	default:
		expiryDuration = 24 * time.Hour // 1 day default
	}

	expiryTime := time.Now().Add(expiryDuration)

	// Use the existing database method
	err = db.CreateAuthToken(token, userID, tokenType, expiryTime.Format(time.RFC3339))
	if err != nil {
		return "", fmt.Errorf("failed to save auth token: %v", err)
	}

	return token, nil
}

// deleteUserAuthTokens deletes all auth tokens for a user
func deleteUserAuthTokens(userID int) error {
	return db.DeleteAuthTokensByUserID(userID)
}

// RegisterHandler handles user registration
func Register(w http.ResponseWriter, r *http.Request) {
	// Handle preflight OPTIONS request
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	var req RegisterRequest

	contentType := r.Header.Get("Content-Type")

	// Parse request based on Content-Type
	if contentType == "application/json" {
		// Handle JSON request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Invalid JSON request body",
			})
			return
		}
	} else if strings.HasPrefix(contentType, "multipart/form-data") {
		// Handle FormData request
		err := r.ParseMultipartForm(10 << 20) // 10 MB max
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Failed to parse form data",
			})
			return
		}

		// Extract fields from form
		req.Email = r.FormValue("email")
		req.Password = r.FormValue("password")
		req.FirstName = r.FormValue("firstName")
		req.LastName = r.FormValue("lastName")
		req.DOB = r.FormValue("dob")
		req.Nickname = r.FormValue("nickname")
		req.AboutMe = r.FormValue("aboutMe")

		// Handle avatar file if present
		file, header, err := r.FormFile("avatar")
		if err == nil {
			defer file.Close()

			// Validate file type and size
			allowedTypes := map[string]bool{
				"image/jpeg": true,
				"image/jpg":  true,
				"image/png":  true,
				"image/gif":  true,
			}

			contentType := header.Header.Get("Content-Type")
			if !allowedTypes[contentType] {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				json.NewEncoder(w).Encode(map[string]string{
					"error": "Invalid file type. Only JPEG, PNG, and GIF are allowed.",
				})
				return
			}

			// Check file size (max 10MB)
			const maxSize = 10 * 1024 * 1024 // 10MB
			if header.Size > maxSize {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				json.NewEncoder(w).Encode(map[string]string{
					"error": "File size too large. Maximum size is 10MB.",
				})
				return
			}

			// Generate unique filename
			ext := filepath.Ext(header.Filename)
			filename := fmt.Sprintf("avatar_%s_%d%s", uuid.New().String(), time.Now().Unix(), ext)

			// Create uploads directory if it doesn't exist
			uploadsDir := utils.GetUploadSubdir("avatars")
			if err := os.MkdirAll(uploadsDir, 0755); err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]string{
					"error": "Failed to create upload directory",
				})
				return
			}

			// Save file
			filePath := filepath.Join(uploadsDir, filename)
			dst, err := os.Create(filePath)
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]string{
					"error": "Failed to save uploaded file",
				})
				return
			}
			defer dst.Close()

			_, err = io.Copy(dst, file)
			if err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]string{
					"error": "Failed to save uploaded file",
				})
				return
			}

			// Set the avatar path in the request
			req.Avatar = utils.GetUploadURL(filename, "avatars")
		}
	} else {
		// Handle URL-encoded form data
		err := r.ParseForm()
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Failed to parse form data",
			})
			return
		}

		req.Email = r.FormValue("email")
		req.Password = r.FormValue("password")
		req.FirstName = r.FormValue("firstName")
		req.LastName = r.FormValue("lastName")
		req.DOB = r.FormValue("dob")
		req.Nickname = r.FormValue("nickname")
		req.AboutMe = r.FormValue("aboutMe")
	}

	// Validate required fields
	if req.Email == "" || req.Password == "" || req.FirstName == "" || req.LastName == "" || req.DOB == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Missing required fields",
		})
		return
	}

	// Check if email already exists
	emailExists, err := db.CheckEmailExists(req.Email)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Server error",
		})
		return
	}
	if emailExists {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Email already exists",
			"field": "email",
		})
		return
	}

	// Check if nickname already exists (if provided)
	if req.Nickname != "" {
		nicknameExists, err := db.CheckNicknameExists(req.Nickname)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Server error",
			})
			return
		}
		if nicknameExists {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Nickname already taken",
				"field": "nickname",
			})
			return
		}
	}

	// Validate password strength
	passwordValidation := utils.ValidatePassword(req.Password)
	if !passwordValidation.IsValid {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error":           "Password does not meet security requirements: " + strings.Join(passwordValidation.Errors, ", "),
			"password_errors": passwordValidation.Errors,
		})
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Server error",
		})
		return
	}

	// Create user
	_, err = db.CreateUser(req.Email, string(hashedPassword), req.FirstName, req.LastName, req.DOB, req.Avatar, req.Nickname, req.AboutMe)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Failed to create user",
		})
		return
	}

	// Get the newly created user to get their ID
	newUser, err := db.GetUserByEmail(req.Email)
	if err == nil && newUser != nil {
		// Create auth token for the new user
		_, err := createAuthToken(newUser["id"].(int), "login")
		if err != nil {
			fmt.Printf("\033[33m[WARNING] Failed to create auth token for new user: %v\033[0m\n", err)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "User registered successfully",
	})
}

// LoginHandler handles user login
func Login(w http.ResponseWriter, r *http.Request) {
	// Handle preflight OPTIONS request
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	var req LoginRequest
	contentType := r.Header.Get("Content-Type")

	// Parse request based on Content-Type
	if contentType == "application/json" {
		// Handle JSON request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Invalid JSON request body",
			})
			return
		}
	} else {
		// Handle URL-encoded form data
		err := r.ParseForm()
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Failed to parse form data",
			})
			return
		}

		req.Email = r.FormValue("email")
		req.Password = r.FormValue("password")
	}

	// Validate required fields
	if req.Email == "" || req.Password == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Email and password are required",
		})
		return
	}

	// Get user by email
	user, err := db.GetUserByEmail(req.Email)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Invalid credentials",
		})
		return
	}

	// Compare password
	err = bcrypt.CompareHashAndPassword([]byte(user["password"].(string)), []byte(req.Password))
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Invalid credentials",
		})
		return
	}

	// Clean up old sessions and auth tokens for this user before creating new ones
	userID := user["id"].(int)
	err = db.DeleteSessionsByUserID(userID)
	if err != nil {
		fmt.Printf("\033[33m[WARNING] Failed to delete old sessions for user %d: %v\033[0m\n", userID, err)
	}

	err = deleteUserAuthTokens(userID)
	if err != nil {
		fmt.Printf("\033[33m[WARNING] Failed to delete old auth tokens for user %d: %v\033[0m\n", userID, err)
	}

	// Generate session ID
	sessionID, err := generateSessionID()
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Server error",
		})
		return
	}

	// Session data
	sessionData := map[string]interface{}{
		"user_id": user["id"],
		"email":   user["email"],
	}

	sessionDataJSON, err := json.Marshal(sessionData)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Server error",
		})
		return
	}

	// Set expiry for 7 days
	expiryTime := time.Now().Add(7 * 24 * time.Hour).Format(time.RFC3339)

	// Save session to database
	err = db.SaveSession(sessionID, user["id"].(int), string(sessionDataJSON), expiryTime)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Server error",
		})
		return
	}

	// Set session cookie
	session, _ := store.Get(r, SessionCookieName)
	session.Values["session_id"] = sessionID
	session.Values["user_id"] = user["id"].(int)
	session.Values["authenticated"] = true
	session.Options.MaxAge = 60 * 60 * 24 * 7 // 7 days
	session.Options.HttpOnly = true
	session.Options.Path = "/"

	// For development, we don't need these settings
	// In production, set these to true
	isDev := true
	if !isDev {
		session.Options.SameSite = http.SameSiteNoneMode
		session.Options.Secure = true
	}

	err = session.Save(r, w)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Failed to save session: " + err.Error(),
		})
		return
	}

	// Create auth token for the login
	authToken, err := createAuthToken(user["id"].(int), "login")
	if err != nil {
		// Log the error but don't fail the login
		fmt.Printf("\033[33m[WARNING] Failed to create auth token: %v\033[0m\n", err)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Login successful",
		"user": map[string]interface{}{
			"id":        user["id"],
			"email":     user["email"],
			"firstName": user["first_name"],
			"lastName":  user["last_name"],
		},
		"authToken": authToken, // Include auth token in response (optional)
	})
}

// LogoutHandler handles user logout
func Logout(w http.ResponseWriter, r *http.Request) {
	// Handle preflight OPTIONS request
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	session, _ := store.Get(r, SessionCookieName)

	// Get user ID from session to delete auth tokens
	userID, userIDOk := session.Values["user_id"].(int)

	// Get session ID from cookie
	sessionID, ok := session.Values["session_id"].(string)
	if ok {
		// Delete session from database
		db.DeleteSession(sessionID)
	}

	// Delete all auth tokens for this user
	if userIDOk && userID > 0 {
		err := deleteUserAuthTokens(userID)
		if err != nil {
			fmt.Printf("\033[33m[WARNING] Failed to delete auth tokens for user %d: %v\033[0m\n", userID, err)
		}
	}

	// Clear the cookie
	session.Options.MaxAge = -1
	session.Save(r, w)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Logout successful",
	})
}

// GetProfile returns the user's profile
func GetProfile(w http.ResponseWriter, r *http.Request) {
	// Handle preflight OPTIONS request
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	session, _ := store.Get(r, SessionCookieName)
	sessionID, ok := session.Values["session_id"].(string)
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Unauthorized",
		})
		return
	}

	// Get session from database
	dbSession, err := db.GetSession(sessionID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Session expired or invalid",
		})
		return
	}

	// Get user ID from session
	userID := dbSession["user_id"].(int)

	// Get user from database
	user, err := db.GetUserById(userID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "User not found",
		})
		return
	}

	// Remove password from response
	delete(user, "password")

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(user)
}

// AuthMiddleware checks if the user is authenticated
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		session, _ := store.Get(r, SessionCookieName)
		sessionID, ok := session.Values["session_id"].(string)
		if !ok {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Verify session in database
		_, err := db.GetSession(sessionID)
		if err != nil {
			http.Error(w, "Session expired or invalid", http.StatusUnauthorized)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// CheckAuth returns the user's authentication status
func CheckAuth(w http.ResponseWriter, r *http.Request) {
	// Handle preflight OPTIONS request
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	session, err := store.Get(r, SessionCookieName)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]bool{
			"authenticated": false,
		})
		return
	}

	// Check if user is authenticated (same pattern as AuthMiddleware)
	auth, ok := session.Values["authenticated"].(bool)

	if !ok || !auth {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]bool{
			"authenticated": false,
		})
		return
	}

	// Get user ID from session
	userID, ok := session.Values["user_id"].(int)

	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]bool{
			"authenticated": false,
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"authenticated": true,
		"user_id":       userID,
	})
}

// UpdateProfile handles profile updates
func UpdateProfile(w http.ResponseWriter, r *http.Request) {
	// Handle preflight OPTIONS request
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Only allow POST method
	if r.Method != "POST" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Method not allowed",
		})
		return
	}

	// Check authentication
	session, _ := store.Get(r, SessionCookieName)
	sessionID, ok := session.Values["session_id"].(string)
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Unauthorized",
		})
		return
	}

	// Get session from database
	dbSession, err := db.GetSession(sessionID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Session expired or invalid",
		})
		return
	}

	// Get user ID from session
	userID := dbSession["user_id"].(int)

	// Parse form data (max 10MB)
	err = r.ParseMultipartForm(10 << 20)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Failed to parse form data: " + err.Error(),
		})
		return
	}

	// Extract form fields
	firstName := r.FormValue("firstName")
	lastName := r.FormValue("lastName")
	nickname := r.FormValue("nickname")
	aboutMe := r.FormValue("aboutMe")
	isPublicStr := r.FormValue("isPublic")
	isPublic := isPublicStr == "true"

	// Validate required fields
	if firstName == "" || lastName == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "First name and last name are required",
		})
		return
	}

	// Check if nickname already exists for other users (if nickname is provided)
	if nickname != "" {
		nicknameExists, err := db.CheckNicknameExistsForUpdate(nickname, userID)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Server error",
			})
			return
		}
		if nicknameExists {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusConflict)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Nickname already taken",
				"field": "nickname",
			})
			return
		}
	}

	// Prepare update data
	updateData := map[string]interface{}{
		"first_name": firstName,
		"last_name":  lastName,
		"nickname":   nickname,
		"about_me":   aboutMe,
		"is_public":  isPublic,
	}

	// Handle avatar upload if present
	file, handler, err := r.FormFile("avatar")
	if err == nil && handler != nil {
		defer file.Close()

		// Validate image file format
		if err := ValidateImageFile(file, handler); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Invalid avatar image: " + err.Error(),
			})
			return
		}

		// Create uploads directory if it doesn't exist
		uploadsDir := utils.GetUploadSubdir("avatars")
		err = os.MkdirAll(uploadsDir, 0755)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Failed to create upload directory",
			})
			return
		}

		// Generate a unique filename with proper extension based on content type
		mimeType, err := GetImageMimeType(file)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Failed to determine image type",
			})
			return
		}

		var ext string
		switch mimeType {
		case "image/jpeg":
			ext = ".jpg"
		case "image/png":
			ext = ".png"
		case "image/gif":
			ext = ".gif"
		default:
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Unsupported image format",
			})
			return
		}

		filename := fmt.Sprintf("avatar_%d_%s%s", time.Now().Unix(), uuid.New().String(), ext)
		uploadPath := utils.GetUploadURL(filename, "avatars")
		fullPath := filepath.Join(uploadsDir, filename)

		// Create file
		dst, err := os.Create(fullPath)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Failed to save avatar: " + err.Error(),
			})
			return
		}
		defer dst.Close()

		// Copy file data
		if _, err = io.Copy(dst, file); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Failed to save avatar: " + err.Error(),
			})
			return
		}

		// Add avatar path to update data
		updateData["avatar"] = uploadPath
	}

	// Handle banner upload if present
	bannerFile, bannerHandler, err := r.FormFile("banner")
	if err == nil && bannerHandler != nil {
		defer bannerFile.Close()

		// Validate image file format
		if err := ValidateImageFile(bannerFile, bannerHandler); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Invalid banner image: " + err.Error(),
			})
			return
		}

		// Create uploads directory if it doesn't exist
		uploadsDir := utils.GetUploadSubdir("banners")
		err = os.MkdirAll(uploadsDir, 0755)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Failed to create upload directory",
			})
			return
		}

		// Generate a unique filename with proper extension based on content type
		mimeType, err := GetImageMimeType(bannerFile)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Failed to determine image type",
			})
			return
		}

		var ext string
		switch mimeType {
		case "image/jpeg":
			ext = ".jpg"
		case "image/png":
			ext = ".png"
		case "image/gif":
			ext = ".gif"
		default:
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Unsupported image format",
			})
			return
		}

		filename := fmt.Sprintf("banner_%d_%s%s", time.Now().Unix(), uuid.New().String(), ext)
		uploadPath := utils.GetUploadURL(filename, "banners")
		fullPath := filepath.Join(uploadsDir, filename)

		// Create file
		dst, err := os.Create(fullPath)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Failed to save banner: " + err.Error(),
			})
			return
		}
		defer dst.Close()

		// Copy file data
		if _, err = io.Copy(dst, bannerFile); err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Failed to save banner: " + err.Error(),
			})
			return
		}

		// Add banner path to update data
		updateData["banner"] = uploadPath
	}

	// Get current user data to check if privacy status is changing
	currentUser, err := db.GetUserById(userID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Failed to retrieve current profile",
		})
		return
	}

	// Check if user is changing from private to public
	wasPrivate := !currentUser["is_public"].(bool)
	becomingPublic := isPublic

	// Update user in database
	err = db.UpdateUser(userID, updateData)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Failed to update profile: " + err.Error(),
		})
		return
	}

	// If user changed from private to public, automatically approve all pending follow requests
	if wasPrivate && becomingPublic {
		err = db.AutoApproveFollowRequests(int64(userID))
		if err != nil {
			// Log the error but don't fail the profile update
			fmt.Printf("Warning: Failed to auto-approve follow requests for user %d: %v\n", userID, err)
		}
	}

	// Get updated user info
	user, err := db.GetUserById(userID)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Failed to retrieve updated profile",
		})
		return
	}

	// Remove password from response
	delete(user, "password")

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Profile updated successfully",
		"user":    user,
	})
}

// GetCurrentUser returns the currently logged-in user's information
func GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	// Get session
	session, err := store.Get(r, SessionCookieName)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Check if user is authenticated
	auth, ok := session.Values["authenticated"].(bool)
	if !ok || !auth {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get user ID from session
	userID, ok := session.Values["user_id"].(int)
	if !ok {
		http.Error(w, "Invalid session data", http.StatusInternalServerError)
		return
	}

	// Get user data from database
	user, err := db.GetUserById(userID)
	if err != nil {
		http.Error(w, "Failed to get user data", http.StatusInternalServerError)
		return
	}

	// Return user data
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

// CheckNicknameAvailability checks if a nickname is available
func CheckNicknameAvailability(w http.ResponseWriter, r *http.Request) {
	// Handle preflight OPTIONS request
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Only allow GET method
	if r.Method != "GET" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Method not allowed",
		})
		return
	}

	nickname := r.URL.Query().Get("nickname")
	if nickname == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Nickname parameter is required",
		})
		return
	}

	// Check if nickname exists
	exists, err := db.CheckNicknameExists(nickname)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Server error",
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"available": !exists,
		"nickname":  nickname,
	})
}
