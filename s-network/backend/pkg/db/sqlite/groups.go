package sqlite

import (
	"database/sql"
	"fmt"
	"log"
	"time"
)

// Group represents a group in the system
type Group struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatorID   int64     `json:"creator_id"`
	Avatar      string    `json:"avatar"`
	Privacy     string    `json:"privacy"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// Additional fields for API responses
	MemberCount    int    `json:"member_count,omitempty"`
	IsJoined       bool   `json:"is_joined,omitempty"`
	IsPending      bool   `json:"is_pending,omitempty"`
	HasJoinRequest bool   `json:"has_join_request,omitempty"`
	UserRole       string `json:"user_role,omitempty"`
	CreatorName    string `json:"creator_name,omitempty"`
}

// GroupMember represents a group member
type GroupMember struct {
	GroupID  int64     `json:"group_id"`
	UserID   int64     `json:"user_id"`
	Role     string    `json:"role"`
	JoinedAt time.Time `json:"joined_at"`

	// User details for API responses
	FirstName string `json:"first_name,omitempty"`
	LastName  string `json:"last_name,omitempty"`
	Avatar    string `json:"avatar,omitempty"`
	Email     string `json:"email,omitempty"`
}

// GroupInvitation represents a group invitation
type GroupInvitation struct {
	ID        int64     `json:"id"`
	GroupID   int64     `json:"group_id"`
	InviterID int64     `json:"inviter_id"`
	InviteeID int64     `json:"invitee_id"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Additional fields for API responses
	GroupName   string `json:"group_name,omitempty"`
	InviterName string `json:"inviter_name,omitempty"`
	InviteeName string `json:"invitee_name,omitempty"`
}

// GroupJoinRequest represents a request to join a group
type GroupJoinRequest struct {
	ID        int64     `json:"id"`
	GroupID   int64     `json:"group_id"`
	UserID    int64     `json:"user_id"`
	Status    string    `json:"status"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Additional fields for API responses
	GroupName  string `json:"group_name,omitempty"`
	UserName   string `json:"user_name,omitempty"`
	UserAvatar string `json:"user_avatar,omitempty"`
}

// GroupPost represents a post in a group
type GroupPost struct {
	ID            int64     `json:"id"`
	GroupID       int64     `json:"group_id"`
	AuthorID      int64     `json:"author_id"`
	Content       string    `json:"content"`
	ImagePath     string    `json:"image_path"`
	LikesCount    int       `json:"likes_count"`
	CommentsCount int       `json:"comments_count"`
	Upvotes       int       `json:"upvotes"`
	Downvotes     int       `json:"downvotes"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`

	// Additional fields for API responses
	AuthorName   string `json:"author_name,omitempty"`
	AuthorAvatar string `json:"author_avatar,omitempty"`
	IsLiked      bool   `json:"is_liked,omitempty"`
	UserVote     int    `json:"user_vote,omitempty"` // 1 for upvote, -1 for downvote, 0 for no vote
}

// GroupPostComment represents a comment on a group post
type GroupPostComment struct {
	ID        int64     `json:"id"`
	PostID    int64     `json:"post_id"`
	AuthorID  int64     `json:"author_id"`
	Content   string    `json:"content"`
	VoteCount int       `json:"vote_count"`
	Upvotes   int       `json:"upvotes"`
	Downvotes int       `json:"downvotes"`
	CreatedAt time.Time `json:"created_at"`

	// Additional fields for API responses
	AuthorName   string `json:"author_name,omitempty"`
	AuthorAvatar string `json:"author_avatar,omitempty"`
	UserVote     int    `json:"user_vote,omitempty"` // 1 for upvote, -1 for downvote, 0 for no vote
}

// GroupEvent represents an event in a group
type GroupEvent struct {
	ID          int64     `json:"id"`
	GroupID     int64     `json:"group_id"`
	CreatorID   int64     `json:"creator_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	EventDate   time.Time `json:"event_date"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// Additional fields for API responses
	CreatorName   string `json:"creator_name,omitempty"`
	GoingCount    int    `json:"going_count,omitempty"`
	NotGoingCount int    `json:"not_going_count,omitempty"`
	UserResponse  string `json:"user_response,omitempty"`
}

// GroupEventResponse represents a user's response to an event
type GroupEventResponse struct {
	ID        int64     `json:"id"`
	EventID   int64     `json:"event_id"`
	UserID    int64     `json:"user_id"`
	Response  string    `json:"response"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CreateGroup creates a new group
func (db *DB) CreateGroup(group *Group) (int64, error) {
	query := `INSERT INTO groups (name, description, creator_id, avatar, privacy) 
	          VALUES (?, ?, ?, ?, ?)`

	result, err := db.Exec(query, group.Name, group.Description, group.CreatorID, group.Avatar, group.Privacy)
	if err != nil {
		return 0, err
	}

	groupID, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}

	// Add creator as admin member
	_, err = db.Exec(`INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'admin')`,
		groupID, group.CreatorID)
	if err != nil {
		return 0, err
	}

	return groupID, nil
}

// GetGroup retrieves a group by ID
func (db *DB) GetGroup(id int64) (*Group, error) {
	query := `SELECT id, name, description, creator_id, avatar, privacy, created_at, updated_at 
	          FROM groups WHERE id = ?`

	var group Group
	err := db.QueryRow(query, id).Scan(
		&group.ID, &group.Name, &group.Description, &group.CreatorID,
		&group.Avatar, &group.Privacy, &group.CreatedAt, &group.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &group, nil
}

// GetGroups retrieves all groups with optional filters
func (db *DB) GetGroups(limit, offset int, userID *int64) ([]*Group, error) {
	query := `SELECT g.id, g.name, g.description, g.creator_id, g.avatar, g.privacy, 
	                 g.created_at, g.updated_at,
	                 COUNT(gm.user_id) as member_count,
	                 u.first_name || ' ' || u.last_name as creator_name
	          FROM groups g
	          LEFT JOIN group_members gm ON g.id = gm.group_id
	          LEFT JOIN users u ON g.creator_id = u.id
	          WHERE g.privacy = 'public' OR g.creator_id = ? OR 
	                EXISTS(SELECT 1 FROM group_members WHERE group_id = g.id AND user_id = ?)
	          GROUP BY g.id
	          ORDER BY g.created_at DESC
	          LIMIT ? OFFSET ?`

	var queryUserID int64 = -1
	if userID != nil {
		queryUserID = *userID
	}

	rows, err := db.Query(query, queryUserID, queryUserID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []*Group
	for rows.Next() {
		var group Group
		var creatorName sql.NullString
		if err := rows.Scan(
			&group.ID, &group.Name, &group.Description, &group.CreatorID,
			&group.Avatar, &group.Privacy, &group.CreatedAt, &group.UpdatedAt,
			&group.MemberCount, &creatorName,
		); err != nil {
			return nil, err
		}

		// Set creator name if available
		if creatorName.Valid {
			group.CreatorName = creatorName.String
		}

		// Check user's relationship with this group if userID provided
		if userID != nil {
			group.IsJoined = db.IsGroupMember(group.ID, *userID)
			group.IsPending = db.HasPendingInvitation(group.ID, *userID)
			group.HasJoinRequest = db.HasPendingJoinRequest(group.ID, *userID)
			group.UserRole = db.GetUserRoleInGroup(group.ID, *userID)
		}

		groups = append(groups, &group)
	}

	return groups, rows.Err()
}

// IsGroupMember checks if a user is a member of a group
func (db *DB) IsGroupMember(groupID, userID int64) bool {
	var count int
	query := `SELECT COUNT(*) FROM group_members WHERE group_id = ? AND user_id = ?`
	db.QueryRow(query, groupID, userID).Scan(&count)
	return count > 0
}

// GetUserRoleInGroup gets a user's role in a group
func (db *DB) GetUserRoleInGroup(groupID, userID int64) string {
	var role string
	query := `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`
	db.QueryRow(query, groupID, userID).Scan(&role)
	return role
}

// AddGroupMember adds a user to a group
func (db *DB) AddGroupMember(groupID, userID int64, role string) error {
	query := `INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)`
	_, err := db.Exec(query, groupID, userID, role)
	return err
}

// RemoveGroupMember removes a user from a group
func (db *DB) RemoveGroupMember(groupID, userID int64) error {
	query := `DELETE FROM group_members WHERE group_id = ? AND user_id = ?`
	_, err := db.Exec(query, groupID, userID)
	return err
}

// GetGroupMembers retrieves all members of a group
func (db *DB) GetGroupMembers(groupID int64) ([]*GroupMember, error) {
	query := `SELECT gm.group_id, gm.user_id, gm.role, gm.joined_at,
	                 u.first_name, u.last_name, u.avatar, u.email
	          FROM group_members gm
	          JOIN users u ON gm.user_id = u.id
	          WHERE gm.group_id = ?
	          ORDER BY gm.joined_at ASC`

	rows, err := db.Query(query, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []*GroupMember
	for rows.Next() {
		var member GroupMember
		if err := rows.Scan(
			&member.GroupID, &member.UserID, &member.Role, &member.JoinedAt,
			&member.FirstName, &member.LastName, &member.Avatar, &member.Email,
		); err != nil {
			return nil, err
		}
		members = append(members, &member)
	}

	return members, rows.Err()
}

// UpdateGroup updates an existing group
func (db *DB) UpdateGroup(group *Group) error {
	query := `UPDATE groups 
	          SET name = ?, description = ?, avatar = ?, privacy = ?, updated_at = CURRENT_TIMESTAMP 
	          WHERE id = ?`

	_, err := db.Exec(query, group.Name, group.Description, group.Avatar, group.Privacy, group.ID)
	return err
}

// DeleteGroup removes a group from the database
func (db *DB) DeleteGroup(id int64) error {
	// Start a transaction to ensure all deletions happen atomically
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Enable foreign keys for this transaction
	_, err = tx.Exec("PRAGMA foreign_keys = ON")
	if err != nil {
		return err
	}

	// Delete related data in the correct order to avoid foreign key violations

	// 1. Delete group event responses
	_, err = tx.Exec("DELETE FROM group_event_responses WHERE event_id IN (SELECT id FROM group_events WHERE group_id = ?)", id)
	if err != nil {
		return err
	}

	// 2. Delete group events
	_, err = tx.Exec("DELETE FROM group_events WHERE group_id = ?", id)
	if err != nil {
		return err
	}

	// 3. Delete group post comments
	_, err = tx.Exec("DELETE FROM group_post_comments WHERE post_id IN (SELECT id FROM group_posts WHERE group_id = ?)", id)
	if err != nil {
		return err
	}

	// 4. Delete group post likes
	_, err = tx.Exec("DELETE FROM group_post_likes WHERE post_id IN (SELECT id FROM group_posts WHERE group_id = ?)", id)
	if err != nil {
		return err
	}

	// 5. Delete group posts
	_, err = tx.Exec("DELETE FROM group_posts WHERE group_id = ?", id)
	if err != nil {
		return err
	}

	// 6. Delete group invitations
	_, err = tx.Exec("DELETE FROM group_invitations WHERE group_id = ?", id)
	if err != nil {
		return err
	}

	// 7. Delete group join requests
	_, err = tx.Exec("DELETE FROM group_join_requests WHERE group_id = ?", id)
	if err != nil {
		return err
	}

	// 8. Delete conversation participants for this group
	_, err = tx.Exec("DELETE FROM chat_participants WHERE conversation_id IN (SELECT id FROM chat_conversations WHERE group_id = ?)", id)
	if err != nil {
		return err
	}

	// 9. Delete messages in group conversations
	_, err = tx.Exec("DELETE FROM chat_messages WHERE conversation_id IN (SELECT id FROM chat_conversations WHERE group_id = ?)", id)
	if err != nil {
		return err
	}

	// 10. Delete group conversations
	_, err = tx.Exec("DELETE FROM chat_conversations WHERE group_id = ?", id)
	if err != nil {
		return err
	}

	// 11. Delete group members
	_, err = tx.Exec("DELETE FROM group_members WHERE group_id = ?", id)
	if err != nil {
		return err
	}

	// 12. Finally delete the group itself
	_, err = tx.Exec("DELETE FROM groups WHERE id = ?", id)
	if err != nil {
		return err
	}

	// Commit the transaction
	return tx.Commit()
}

// GetUserGroups retrieves all groups a user is a member of
func (db *DB) GetUserGroups(userID int64) ([]*Group, error) {
	query := `SELECT g.id, g.name, g.description, g.creator_id, g.avatar, g.privacy, g.created_at, g.updated_at 
	          FROM groups g
	          JOIN group_members gm ON g.id = gm.group_id
	          WHERE gm.user_id = ?
	          ORDER BY g.name`

	rows, err := db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []*Group
	for rows.Next() {
		var group Group
		if err := rows.Scan(
			&group.ID,
			&group.Name,
			&group.Description,
			&group.CreatorID,
			&group.Avatar,
			&group.Privacy,
			&group.CreatedAt,
			&group.UpdatedAt,
		); err != nil {
			return nil, err
		}
		groups = append(groups, &group)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return groups, nil
}

// GetPublicGroups retrieves all public groups
func (db *DB) GetPublicGroups(limit, offset int) ([]*Group, error) {
	query := `SELECT id, name, description, creator_id, avatar, privacy, created_at, updated_at 
	          FROM groups 
	          WHERE privacy = 'public' 
	          ORDER BY name 
	          LIMIT ? OFFSET ?`

	rows, err := db.Query(query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []*Group
	for rows.Next() {
		var group Group
		if err := rows.Scan(
			&group.ID,
			&group.Name,
			&group.Description,
			&group.CreatorID,
			&group.Avatar,
			&group.Privacy,
			&group.CreatedAt,
			&group.UpdatedAt,
		); err != nil {
			return nil, err
		}
		groups = append(groups, &group)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return groups, nil
}

// HasPendingInvitation checks if a user has a pending invitation to a group
func (db *DB) HasPendingInvitation(groupID, userID int64) bool {
	var count int
	query := `SELECT COUNT(*) FROM group_invitations 
	          WHERE group_id = ? AND invitee_id = ? AND status = 'pending'`
	db.QueryRow(query, groupID, userID).Scan(&count)
	return count > 0
}

// HasPendingJoinRequest checks if a user has a pending join request for a group
func (db *DB) HasPendingJoinRequest(groupID, userID int64) bool {
	var count int
	query := `SELECT COUNT(*) FROM group_join_requests 
	          WHERE group_id = ? AND user_id = ? AND status = 'pending'`
	db.QueryRow(query, groupID, userID).Scan(&count)
	return count > 0
}

// CreateGroupInvitation creates a new group invitation
func (db *DB) CreateGroupInvitation(invitation *GroupInvitation) (int64, error) {
	query := `INSERT INTO group_invitations (group_id, inviter_id, invitee_id, status) 
	          VALUES (?, ?, ?, 'pending')`

	result, err := db.Exec(query, invitation.GroupID, invitation.InviterID, invitation.InviteeID)
	if err != nil {
		return 0, err
	}

	return result.LastInsertId()
}

// UpdateInvitationStatus updates the status of a group invitation
func (db *DB) UpdateInvitationStatus(invitationID int64, status string) error {
	query := `UPDATE group_invitations SET status = ?, updated_at = CURRENT_TIMESTAMP 
	          WHERE id = ?`

	_, err := db.Exec(query, status, invitationID)
	return err
}

// GetUserInvitations retrieves all invitations for a user
func (db *DB) GetUserInvitations(userID int64, status string) ([]*GroupInvitation, error) {
	query := `SELECT gi.id, gi.group_id, gi.inviter_id, gi.invitee_id, gi.status, 
	                 gi.created_at, gi.updated_at, g.name as group_name,
	                 u.first_name || ' ' || u.last_name as inviter_name
	          FROM group_invitations gi
	          JOIN groups g ON gi.group_id = g.id
	          JOIN users u ON gi.inviter_id = u.id
	          WHERE gi.invitee_id = ? AND gi.status = ?
	          ORDER BY gi.created_at DESC`

	rows, err := db.Query(query, userID, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var invitations []*GroupInvitation
	for rows.Next() {
		var inv GroupInvitation
		if err := rows.Scan(
			&inv.ID, &inv.GroupID, &inv.InviterID, &inv.InviteeID, &inv.Status,
			&inv.CreatedAt, &inv.UpdatedAt, &inv.GroupName, &inv.InviterName,
		); err != nil {
			return nil, err
		}
		invitations = append(invitations, &inv)
	}

	return invitations, rows.Err()
}

// CreateJoinRequest creates a new join request
func (db *DB) CreateJoinRequest(request *GroupJoinRequest) (int64, error) {
	query := `INSERT INTO group_join_requests (group_id, user_id, message, status) 
	          VALUES (?, ?, ?, 'pending')`

	result, err := db.Exec(query, request.GroupID, request.UserID, request.Message)
	if err != nil {
		return 0, err
	}

	return result.LastInsertId()
}

// GetGroupJoinRequests retrieves all join requests for a group
func (db *DB) GetGroupJoinRequests(groupID int64, status string) ([]*GroupJoinRequest, error) {
	query := `SELECT gjr.id, gjr.group_id, gjr.user_id, gjr.status, gjr.message,
	                 gjr.created_at, gjr.updated_at, g.name as group_name,
	                 u.first_name || ' ' || u.last_name as user_name, u.avatar as user_avatar
	          FROM group_join_requests gjr
	          JOIN groups g ON gjr.group_id = g.id
	          JOIN users u ON gjr.user_id = u.id
	          WHERE gjr.group_id = ? AND gjr.status = ?
	          ORDER BY gjr.created_at DESC`

	rows, err := db.Query(query, groupID, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var requests []*GroupJoinRequest
	for rows.Next() {
		var req GroupJoinRequest
		if err := rows.Scan(
			&req.ID, &req.GroupID, &req.UserID, &req.Status, &req.Message,
			&req.CreatedAt, &req.UpdatedAt, &req.GroupName, &req.UserName, &req.UserAvatar,
		); err != nil {
			return nil, err
		}
		requests = append(requests, &req)
	}

	return requests, rows.Err()
}

// UpdateJoinRequestStatus updates the status of a join request
func (db *DB) UpdateJoinRequestStatus(requestID int64, status string) error {
	query := `UPDATE group_join_requests SET status = ?, updated_at = CURRENT_TIMESTAMP 
	          WHERE id = ?`

	_, err := db.Exec(query, status, requestID)
	return err
}

// Group Posts Functions

// CreateGroupPost creates a new post in a group
func (db *DB) CreateGroupPost(post *GroupPost) (int64, error) {
	query := `INSERT INTO group_posts (group_id, author_id, content, image_path) 
	          VALUES (?, ?, ?, ?)`

	result, err := db.Exec(query, post.GroupID, post.AuthorID, post.Content, post.ImagePath)
	if err != nil {
		return 0, err
	}

	return result.LastInsertId()
}

// GetGroupPosts retrieves all posts for a group with pagination
func (db *DB) GetGroupPosts(groupID int64, limit, offset int, userID int64) ([]*GroupPost, error) {
	query := `SELECT gp.id, gp.group_id, gp.author_id, gp.content, gp.image_path, 
	                 gp.likes_count, gp.comments_count, gp.upvotes, gp.downvotes, gp.created_at, gp.updated_at,
	                 u.first_name || ' ' || u.last_name as author_name, u.avatar as author_avatar
	          FROM group_posts gp
	          JOIN users u ON gp.author_id = u.id
	          WHERE gp.group_id = ?
	          ORDER BY gp.created_at DESC
	          LIMIT ? OFFSET ?`

	rows, err := db.Query(query, groupID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []*GroupPost
	for rows.Next() {
		var post GroupPost
		if err := rows.Scan(
			&post.ID, &post.GroupID, &post.AuthorID, &post.Content, &post.ImagePath,
			&post.LikesCount, &post.CommentsCount, &post.Upvotes, &post.Downvotes, &post.CreatedAt, &post.UpdatedAt,
			&post.AuthorName, &post.AuthorAvatar,
		); err != nil {
			return nil, err
		}

		// Check if user liked this post
		post.IsLiked = db.HasUserLikedGroupPost(post.ID, userID)

		// Get user's vote on this post
		userVote, err := db.GetUserVote(int(userID), post.ID, "group_post")
		if err == nil {
			post.UserVote = userVote
		}

		posts = append(posts, &post)
	}

	return posts, rows.Err()
}

// GetGroupPost retrieves a specific group post by ID
func (db *DB) GetGroupPost(postID int64, userID int64) (*GroupPost, error) {
	query := `SELECT gp.id, gp.group_id, gp.author_id, gp.content, gp.image_path, 
	                 gp.likes_count, gp.comments_count, gp.upvotes, gp.downvotes, gp.created_at, gp.updated_at,
	                 u.first_name || ' ' || u.last_name as author_name, u.avatar as author_avatar
	          FROM group_posts gp
	          JOIN users u ON gp.author_id = u.id
	          WHERE gp.id = ?`

	var post GroupPost
	err := db.QueryRow(query, postID).Scan(
		&post.ID, &post.GroupID, &post.AuthorID, &post.Content, &post.ImagePath,
		&post.LikesCount, &post.CommentsCount, &post.Upvotes, &post.Downvotes, &post.CreatedAt, &post.UpdatedAt,
		&post.AuthorName, &post.AuthorAvatar,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	// Check if user liked this post
	post.IsLiked = db.HasUserLikedGroupPost(post.ID, userID)

	// Get user's vote on this post
	userVote, err := db.GetUserVote(int(userID), post.ID, "group_post")
	if err == nil {
		post.UserVote = userVote
	}

	return &post, nil
}

// LikeGroupPost adds a like to a group post
func (db *DB) LikeGroupPost(postID, userID int64) error {
	// Check if already liked
	if db.HasUserLikedGroupPost(postID, userID) {
		return nil // Already liked
	}

	// Insert like
	query := `INSERT INTO group_post_likes (post_id, user_id) VALUES (?, ?)`
	_, err := db.Exec(query, postID, userID)
	if err != nil {
		return err
	}

	// Update likes count
	updateQuery := `UPDATE group_posts SET likes_count = likes_count + 1 WHERE id = ?`
	_, err = db.Exec(updateQuery, postID)
	return err
}

// UnlikeGroupPost removes a like from a group post
func (db *DB) UnlikeGroupPost(postID, userID int64) error {
	// Remove like
	query := `DELETE FROM group_post_likes WHERE post_id = ? AND user_id = ?`
	result, err := db.Exec(query, postID, userID)
	if err != nil {
		return err
	}

	// Check if like was actually removed
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected > 0 {
		// Update likes count
		updateQuery := `UPDATE group_posts SET likes_count = likes_count - 1 WHERE id = ?`
		_, err = db.Exec(updateQuery, postID)
	}

	return err
}

// HasUserLikedGroupPost checks if a user has liked a specific group post
func (db *DB) HasUserLikedGroupPost(postID, userID int64) bool {
	var count int
	query := `SELECT COUNT(*) FROM group_post_likes WHERE post_id = ? AND user_id = ?`
	db.QueryRow(query, postID, userID).Scan(&count)
	return count > 0
}

// Group Post Comments Functions

// CreateGroupPostComment adds a comment to a group post
func (db *DB) CreateGroupPostComment(comment *GroupPostComment) (int64, error) {
	query := `INSERT INTO group_post_comments (post_id, author_id, content) 
	          VALUES (?, ?, ?)`

	result, err := db.Exec(query, comment.PostID, comment.AuthorID, comment.Content)
	if err != nil {
		return 0, err
	}

	commentID, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}

	// Update comments count
	updateQuery := `UPDATE group_posts SET comments_count = comments_count + 1 WHERE id = ?`
	_, err = db.Exec(updateQuery, comment.PostID)

	return commentID, err
}

// GetGroupPostComments retrieves all comments for a group post
func (db *DB) GetGroupPostComments(postID int64) ([]*GroupPostComment, error) {
	query := `SELECT gpc.id, gpc.post_id, gpc.author_id, gpc.content, gpc.vote_count, gpc.upvotes, gpc.downvotes, gpc.created_at,
	                 u.first_name || ' ' || u.last_name as author_name, u.avatar as author_avatar
	          FROM group_post_comments gpc
	          JOIN users u ON gpc.author_id = u.id
	          WHERE gpc.post_id = ?
	          ORDER BY gpc.created_at ASC`

	rows, err := db.Query(query, postID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var comments []*GroupPostComment
	for rows.Next() {
		var comment GroupPostComment
		if err := rows.Scan(
			&comment.ID, &comment.PostID, &comment.AuthorID, &comment.Content, &comment.VoteCount, &comment.Upvotes, &comment.Downvotes, &comment.CreatedAt,
			&comment.AuthorName, &comment.AuthorAvatar,
		); err != nil {
			return nil, err
		}
		comments = append(comments, &comment)
	}

	return comments, rows.Err()
}

// GetGroupPostCommentsWithUserVotes retrieves all comments for a group post with user vote data
func (db *DB) GetGroupPostCommentsWithUserVotes(postID int64, userID int64) ([]*GroupPostComment, error) {
	comments, err := db.GetGroupPostComments(postID)
	if err != nil {
		return nil, err
	}

	// Add user vote data for each comment
	for i, comment := range comments {
		userVote, err := db.GetUserVote(int(userID), comment.ID, "group_post_comment")
		if err == nil {
			comments[i].UserVote = userVote
		}
	}

	return comments, nil
}

// GetGroupPostComment retrieves a specific group post comment by ID
func (db *DB) GetGroupPostComment(commentID int64, userID int64) (*GroupPostComment, error) {
	query := `SELECT gpc.id, gpc.post_id, gpc.author_id, gpc.content, gpc.vote_count, gpc.upvotes, gpc.downvotes, gpc.created_at,
	                 u.first_name || ' ' || u.last_name as author_name, u.avatar as author_avatar
	          FROM group_post_comments gpc
	          JOIN users u ON gpc.author_id = u.id
	          WHERE gpc.id = ?`

	var comment GroupPostComment
	err := db.QueryRow(query, commentID).Scan(
		&comment.ID, &comment.PostID, &comment.AuthorID, &comment.Content, &comment.VoteCount, &comment.Upvotes, &comment.Downvotes, &comment.CreatedAt,
		&comment.AuthorName, &comment.AuthorAvatar,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	// Get user's vote on this comment
	userVote, err := db.GetUserVote(int(userID), comment.ID, "group_post_comment")
	if err == nil {
		comment.UserVote = userVote
	}

	return &comment, nil
}

// DeleteGroupPostComment removes a comment from a group post
func (db *DB) DeleteGroupPostComment(commentID int64) error {
	// Start transaction to update comment count
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Get the post ID before deleting the comment
	var postID int64
	err = tx.QueryRow("SELECT post_id FROM group_post_comments WHERE id = ?", commentID).Scan(&postID)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("comment not found")
		}
		return err
	}

	// Delete the comment
	result, err := tx.Exec("DELETE FROM group_post_comments WHERE id = ?", commentID)
	if err != nil {
		return err
	}

	// Check if comment was actually deleted
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return fmt.Errorf("comment not found")
	}

	// Update comments count in the post
	_, err = tx.Exec("UPDATE group_posts SET comments_count = comments_count - 1 WHERE id = ?", postID)
	if err != nil {
		return err
	}

	// Commit transaction
	return tx.Commit()
}

// Group Events Functions

// CreateGroupEvent creates a new event in a group
func (db *DB) CreateGroupEvent(event *GroupEvent) (int64, error) {
	query := `INSERT INTO group_events (group_id, creator_id, title, description, event_date, event_time) 
	          VALUES (?, ?, ?, ?, ?, ?)`

	// Format date and time separately for SQLite
	formattedDate := event.EventDate.Format("2006-01-02")
	formattedTime := event.EventDate.Format("15:04:05")

	result, err := db.Exec(query, event.GroupID, event.CreatorID, event.Title, event.Description, formattedDate, formattedTime)
	if err != nil {
		return 0, err
	}

	return result.LastInsertId()
}

// GetGroupEvents retrieves all events for a group
func (db *DB) GetGroupEvents(groupID int64, userID int64) ([]*GroupEvent, error) {
	query := `SELECT ge.id, ge.group_id, ge.creator_id, ge.title, ge.description, 
	                 ge.event_date, ge.created_at,
	                 u.first_name || ' ' || u.last_name as creator_name
	          FROM group_events ge
	          JOIN users u ON ge.creator_id = u.id
	          WHERE ge.group_id = ?
	          ORDER BY ge.event_date ASC`

	rows, err := db.Query(query, groupID)
	if err != nil {
		log.Printf("GetGroupEvents: Query error - %v", err)
		return nil, err
	}
	defer rows.Close()

	var events []*GroupEvent
	for rows.Next() {
		var event GroupEvent
		if err := rows.Scan(
			&event.ID, &event.GroupID, &event.CreatorID, &event.Title, &event.Description,
			&event.EventDate, &event.CreatedAt, &event.CreatorName,
		); err != nil {
			log.Printf("GetGroupEvents: Scan error - %v", err)
			continue // Skip this event but continue processing others
		}

		// Get response counts
		event.GoingCount, event.NotGoingCount = db.GetEventResponseCounts(event.ID)

		// Get user's response
		event.UserResponse = db.GetUserEventResponse(event.ID, userID)

		events = append(events, &event)
	}

	if err := rows.Err(); err != nil {
		log.Printf("GetGroupEvents: Rows error - %v", err)
		return nil, err
	}

	return events, nil
}

// GetGroupEvent retrieves a specific group event by ID
func (db *DB) GetGroupEvent(eventID int64, userID int64) (*GroupEvent, error) {
	query := `SELECT ge.id, ge.group_id, ge.creator_id, ge.title, ge.description, 
	                 ge.event_date, ge.created_at,
	                 u.first_name || ' ' || u.last_name as creator_name
	          FROM group_events ge
	          JOIN users u ON ge.creator_id = u.id
	          WHERE ge.id = ?`

	var event GroupEvent
	err := db.QueryRow(query, eventID).Scan(
		&event.ID, &event.GroupID, &event.CreatorID, &event.Title, &event.Description,
		&event.EventDate, &event.CreatedAt, &event.CreatorName,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	// Get response counts
	event.GoingCount, event.NotGoingCount = db.GetEventResponseCounts(event.ID)

	// Get user's response
	event.UserResponse = db.GetUserEventResponse(event.ID, userID)

	return &event, nil
}

// RespondToEvent adds or updates a user's response to an event
func (db *DB) RespondToEvent(eventID, userID int64, response string) error {
	// Check if response already exists
	var existingResponse string
	query := `SELECT response FROM group_event_responses WHERE event_id = ? AND user_id = ?`
	err := db.QueryRow(query, eventID, userID).Scan(&existingResponse)

	if err == sql.ErrNoRows {
		// Insert new response
		insertQuery := `INSERT INTO group_event_responses (event_id, user_id, response) 
		                VALUES (?, ?, ?)`
		_, err = db.Exec(insertQuery, eventID, userID, response)
	} else if err == nil {
		// Update existing response
		updateQuery := `UPDATE group_event_responses 
		                SET response = ?, updated_at = CURRENT_TIMESTAMP 
		                WHERE event_id = ? AND user_id = ?`
		_, err = db.Exec(updateQuery, response, eventID, userID)
	}

	return err
}

// GetEventResponseCounts returns the counts of going and not going responses
func (db *DB) GetEventResponseCounts(eventID int64) (going int, notGoing int) {
	query := `SELECT 
	            SUM(CASE WHEN response = 'going' THEN 1 ELSE 0 END) as going,
	            SUM(CASE WHEN response = 'not_going' THEN 1 ELSE 0 END) as not_going
	          FROM group_event_responses 
	          WHERE event_id = ?`

	db.QueryRow(query, eventID).Scan(&going, &notGoing)
	return
}

// GetUserEventResponse gets a user's response to a specific event
func (db *DB) GetUserEventResponse(eventID, userID int64) string {
	var response string
	query := `SELECT response FROM group_event_responses WHERE event_id = ? AND user_id = ?`
	db.QueryRow(query, eventID, userID).Scan(&response)
	return response
}

// GetEventResponses retrieves all responses for an event
func (db *DB) GetEventResponses(eventID int64) ([]*GroupEventResponse, error) {
	query := `SELECT ger.id, ger.event_id, ger.user_id, ger.response, ger.created_at, ger.updated_at
	          FROM group_event_responses ger
	          WHERE ger.event_id = ?
	          ORDER BY ger.created_at DESC`

	rows, err := db.Query(query, eventID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var responses []*GroupEventResponse
	for rows.Next() {
		var response GroupEventResponse
		if err := rows.Scan(
			&response.ID, &response.EventID, &response.UserID, &response.Response,
			&response.CreatedAt, &response.UpdatedAt,
		); err != nil {
			return nil, err
		}
		responses = append(responses, &response)
	}

	return responses, rows.Err()
}

// Group Chat Functions

// CreateGroupConversation creates a chat conversation for a group
func (db *DB) CreateGroupConversation(groupID int64, groupName string) (int64, error) {
	query := `INSERT INTO chat_conversations (name, is_group, group_id) VALUES (?, ?, ?)`

	result, err := db.Exec(query, groupName+" Chat", true, groupID)
	if err != nil {
		return 0, err
	}

	conversationID, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}

	// Add all group members to the conversation
	members, err := db.GetGroupMembers(groupID)
	if err != nil {
		return conversationID, err
	}

	for _, member := range members {
		_, err = db.Exec(`INSERT INTO chat_participants (conversation_id, user_id) VALUES (?, ?)`,
			conversationID, member.UserID)
		if err != nil {
			log.Printf("Error adding member %d to group conversation: %v", member.UserID, err)
		}
	}

	return conversationID, nil
}

// GetGroupConversation retrieves the chat conversation for a group
func (db *DB) GetGroupConversation(groupID int64) (*ChatConversation, error) {
	query := `SELECT id, name, is_group, group_id, created_at, updated_at 
	          FROM chat_conversations WHERE group_id = ?`

	var conv ChatConversation
	err := db.QueryRow(query, groupID).Scan(
		&conv.ID, &conv.Name, &conv.IsGroup, &conv.GroupID, &conv.CreatedAt, &conv.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &conv, nil
}

// GetOrCreateGroupConversation gets existing group conversation or creates a new one
func (db *DB) GetOrCreateGroupConversation(groupID int64) (int64, error) {
	// Check if conversation already exists
	conv, err := db.GetGroupConversation(groupID)
	if err != nil {
		return 0, err
	}

	if conv != nil {
		return conv.ID, nil
	}

	// Get group information
	group, err := db.GetGroup(groupID)
	if err != nil || group == nil {
		return 0, fmt.Errorf("group not found")
	}

	// Create new conversation
	return db.CreateGroupConversation(groupID, group.Name)
}

// AddMemberToGroupConversation adds a new member to the group conversation
func (db *DB) AddMemberToGroupConversation(groupID, userID int64) error {
	// Get the group conversation
	conv, err := db.GetGroupConversation(groupID)
	if err != nil || conv == nil {
		// If no conversation exists, create one
		_, err = db.GetOrCreateGroupConversation(groupID)
		if err != nil {
			return err
		}
		// Get the newly created conversation
		conv, err = db.GetGroupConversation(groupID)
		if err != nil || conv == nil {
			return fmt.Errorf("failed to create group conversation")
		}
	}

	// Add user to conversation
	query := `INSERT OR IGNORE INTO chat_participants (conversation_id, user_id) VALUES (?, ?)`
	_, err = db.Exec(query, conv.ID, userID)
	return err
}

// RemoveMemberFromGroupConversation removes a member from the group conversation
func (db *DB) RemoveMemberFromGroupConversation(groupID, userID int64) error {
	// Get the group conversation
	conv, err := db.GetGroupConversation(groupID)
	if err != nil || conv == nil {
		return nil // No conversation to remove from
	}

	// Remove user from conversation
	query := `DELETE FROM chat_participants WHERE conversation_id = ? AND user_id = ?`
	_, err = db.Exec(query, conv.ID, userID)
	return err
}
