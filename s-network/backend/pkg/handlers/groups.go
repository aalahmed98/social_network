package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"s-network/backend/pkg/db/sqlite"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// GetGroups retrieves all groups with pagination and user context
func GetGroups(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse pagination parameters
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 20
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	offset := 0
	if offsetStr != "" {
		if parsedOffset, err := strconv.Atoi(offsetStr); err == nil && parsedOffset >= 0 {
			offset = parsedOffset
		}
	}

	userIDPtr := int64(userID)
	groups, err := db.GetGroups(limit, offset, &userIDPtr)
	if err != nil {
		log.Printf("Error fetching groups: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"groups": groups,
		"count":  len(groups),
		"limit":  limit,
		"offset": offset,
	})
}

// GetGroup retrieves a specific group by ID
func GetGroup(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	groupIDStr := vars["id"]
	groupID, err := strconv.ParseInt(groupIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	group, err := db.GetGroup(groupID)
	if err != nil {
		log.Printf("Error fetching group: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	if group == nil {
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}

	// Check if user has access to this group
	isMember := db.IsGroupMember(groupID, int64(userID))
	if group.Privacy == "private" && !isMember && group.CreatorID != int64(userID) {
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}

	// Add user-specific information
	group.IsJoined = isMember
	group.IsPending = db.HasPendingInvitation(groupID, int64(userID))
	group.HasJoinRequest = db.HasPendingJoinRequest(groupID, int64(userID))
	group.UserRole = db.GetUserRoleInGroup(groupID, int64(userID))

	// Get member count
	members, err := db.GetGroupMembers(groupID)
	if err == nil {
		group.MemberCount = len(members)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(group)
}

// CreateGroup creates a new group
func CreateGroup(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		log.Printf("[CreateGroup] Unauthorized: %v", err)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var requestData struct {
		Name        string  `json:"name"`
		Description string  `json:"description"`
		Privacy     string  `json:"privacy"`
		Avatar      string  `json:"avatar"`
		MemberIDs   []int64 `json:"member_ids"` // Optional member IDs to invite
	}

	if err := json.NewDecoder(r.Body).Decode(&requestData); err != nil {
		log.Printf("[CreateGroup] Invalid request body: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	log.Printf("[CreateGroup] userID=%v, requestData=%+v", userID, requestData)

	// Validate input
	if requestData.Name == "" {
		log.Printf("[CreateGroup] Group name is required")
		http.Error(w, "Group name is required", http.StatusBadRequest)
		return
	}

	if requestData.Privacy != "public" && requestData.Privacy != "private" {
		requestData.Privacy = "public" // Default to public
	}

	group := &sqlite.Group{
		Name:        requestData.Name,
		Description: requestData.Description,
		CreatorID:   int64(userID),
		Privacy:     requestData.Privacy,
		Avatar:      requestData.Avatar,
	}

	groupID, err := db.CreateGroup(group)
	if err != nil {
		log.Printf("[CreateGroup] Error creating group: %v", err)
		http.Error(w, "Failed to create group", http.StatusInternalServerError)
		return
	}

	// Create group chat conversation
	_, err = db.GetOrCreateGroupConversation(groupID)
	if err != nil {
		log.Printf("[CreateGroup] Error creating group conversation: %v", err)
		// Don't fail the group creation if chat creation fails
	}

	// Handle initial members based on group privacy
	if len(requestData.MemberIDs) > 0 {
		log.Printf("[CreateGroup] Adding %d members to %s group %d", len(requestData.MemberIDs), requestData.Privacy, groupID)

		// Get inviter (creator) information for notifications
		inviter, err := db.GetUserById(int(userID))
		if err != nil {
			log.Printf("[CreateGroup] Warning: Could not get inviter info: %v", err)
		}

		var inviterName string
		if inviter != nil {
			inviterName = inviter["first_name"].(string) + " " + inviter["last_name"].(string)
		} else {
			inviterName = "Unknown User"
		}

		for _, memberID := range requestData.MemberIDs {
			// Check if target user exists
			targetUser, err := db.GetUserById(int(memberID))
			if err != nil || targetUser == nil {
				log.Printf("[CreateGroup] Warning: User %d not found, skipping", memberID)
				continue
			}

			// Check if user is already a member (shouldn't happen for new group, but safety check)
			if db.IsGroupMember(groupID, memberID) {
				log.Printf("[CreateGroup] Warning: User %d is already a member, skipping", memberID)
				continue
			}

			if requestData.Privacy == "private" {
				// For private groups, send invitation
				
				// Check if invitation already exists
				if db.HasPendingInvitation(groupID, memberID) {
					log.Printf("[CreateGroup] Warning: User %d already has pending invitation, skipping", memberID)
					continue
				}

				// Create invitation
				invitation := &sqlite.GroupInvitation{
					GroupID:   groupID,
					InviterID: int64(userID),
					InviteeID: memberID,
				}

				invitationID, err := db.CreateGroupInvitation(invitation)
				if err != nil {
					log.Printf("[CreateGroup] Error creating invitation for user %d: %v", memberID, err)
					continue
				}

				// Create notification for the invited user
				_, err = db.CreateGroupInviteNotification(memberID, int64(userID), groupID, requestData.Name, inviterName)
				if err != nil {
					log.Printf("[CreateGroup] Error creating notification for user %d: %v", memberID, err)
					// Don't fail the invitation if notification creation fails
				}

				log.Printf("[CreateGroup] Successfully sent invitation %d to user %d for private group", invitationID, memberID)

			} else {
				// For public groups, add directly as member
				err = db.AddGroupMember(groupID, memberID, "member")
				if err != nil {
					log.Printf("[CreateGroup] Error adding member %d: %v", memberID, err)
					continue
				}

				// Add user to group chat conversation
				err = db.AddMemberToGroupConversation(groupID, memberID)
				if err != nil {
					log.Printf("[CreateGroup] Error adding user %d to group conversation: %v", memberID, err)
					// Don't fail if chat addition fails
				}

				// Create notification for the added user (different type than invitation)
				notificationContent := fmt.Sprintf("%s added you to the group '%s'", inviterName, requestData.Name)
				
				notification := &sqlite.Notification{
					ReceiverID:  memberID,
					SenderID:    int64(userID),
					Type:        "group_member_added", // Different type for direct addition
					Content:     notificationContent,
					ReferenceID: groupID,
					IsRead:      false,
				}
				
				_, err = db.CreateNotification(notification)
				if err != nil {
					log.Printf("[CreateGroup] Warning: Could not create group addition notification for user %d: %v", memberID, err)
				}

				log.Printf("[CreateGroup] Successfully added user %d as member to public group", memberID)
			}
		}
	}

	// Return the created group
	createdGroup, err := db.GetGroup(groupID)
	if err != nil {
		log.Printf("[CreateGroup] Error fetching created group: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	log.Printf("[CreateGroup] Group created successfully: %+v", createdGroup)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"group":   createdGroup,
		"message": "Group created successfully",
	})
}

// JoinGroup allows a user to join a public group
func JoinGroup(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	groupIDStr := vars["id"]
	groupID, err := strconv.ParseInt(groupIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	// Check if group exists and is public
	group, err := db.GetGroup(groupID)
	if err != nil || group == nil {
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}

	if group.Privacy != "public" {
		http.Error(w, "Cannot join private group directly", http.StatusForbidden)
		return
	}

	// Check if user is already a member
	if db.IsGroupMember(groupID, int64(userID)) {
		http.Error(w, "Already a member", http.StatusConflict)
		return
	}

	// Add user as member
	err = db.AddGroupMember(groupID, int64(userID), "member")
	if err != nil {
		log.Printf("Error adding group member: %v", err)
		http.Error(w, "Failed to join group", http.StatusInternalServerError)
		return
	}

	// Add user to group chat conversation
	err = db.AddMemberToGroupConversation(groupID, int64(userID))
	if err != nil {
		log.Printf("Error adding user to group conversation: %v", err)
		// Don't fail if chat addition fails
	}

	// No notification needed for JoinGroup since the user is joining voluntarily

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Successfully joined group",
	})
}

// LeaveGroup allows a user to leave a group
func LeaveGroup(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	groupIDStr := vars["id"]
	groupID, err := strconv.ParseInt(groupIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	// Check if user is a member
	if !db.IsGroupMember(groupID, int64(userID)) {
		http.Error(w, "Not a member of this group", http.StatusBadRequest)
		return
	}

	// Get group to check if user is creator
	group, err := db.GetGroup(groupID)
	if err != nil || group == nil {
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}

	// Creator cannot leave, they must transfer ownership or delete the group
	if group.CreatorID == int64(userID) {
		http.Error(w, "Group creator cannot leave. Transfer ownership or delete the group.", http.StatusBadRequest)
		return
	}

	// Remove user from group
	err = db.RemoveGroupMember(groupID, int64(userID))
	if err != nil {
		log.Printf("Error removing group member: %v", err)
		http.Error(w, "Failed to leave group", http.StatusInternalServerError)
		return
	}

	// Remove user from group chat conversation
	err = db.RemoveMemberFromGroupConversation(groupID, int64(userID))
	if err != nil {
		log.Printf("Error removing user from group conversation: %v", err)
		// Don't fail if chat removal fails
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Successfully left group",
	})
}

// InviteToGroup invites a user to join a group
func InviteToGroup(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	groupIDStr := vars["id"]
	groupID, err := strconv.ParseInt(groupIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	// Check if user is a member of the group
	if !db.IsGroupMember(groupID, int64(userID)) {
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}

	var requestData struct {
		UserID int64 `json:"user_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&requestData); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Check if target user exists
	targetUser, err := db.GetUserById(int(requestData.UserID))
	if err != nil || targetUser == nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// Check if user is already a member
	if db.IsGroupMember(groupID, requestData.UserID) {
		http.Error(w, "User is already a member", http.StatusConflict)
		return
	}

	// Check if invitation already exists
	if db.HasPendingInvitation(groupID, requestData.UserID) {
		http.Error(w, "Invitation already sent", http.StatusConflict)
		return
	}

	// Get group information for notification
	group, err := db.GetGroup(groupID)
	if err != nil || group == nil {
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}

	// Get inviter information for notification
	inviter, err := db.GetUserById(int(userID))
	if err != nil {
		log.Printf("Error getting inviter info: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	inviterName := inviter["first_name"].(string) + " " + inviter["last_name"].(string)

	// Create invitation
	invitation := &sqlite.GroupInvitation{
		GroupID:   groupID,
		InviterID: int64(userID),
		InviteeID: requestData.UserID,
	}

	_, err = db.CreateGroupInvitation(invitation)
	if err != nil {
		log.Printf("Error creating group invitation: %v", err)
		http.Error(w, "Failed to send invitation", http.StatusInternalServerError)
		return
	}

	// Create notification for the invited user
	_, err = db.CreateGroupInviteNotification(requestData.UserID, int64(userID), groupID, group.Name, inviterName)
	if err != nil {
		log.Printf("Error creating notification for invitation: %v", err)
		// Don't fail the invitation if notification creation fails
	}

	// Add user to group chat
	err = db.AddMemberToGroupConversation(groupID, int64(userID))
	if err != nil {
		log.Printf("Error adding user to group conversation: %v", err)
	}

	// No need to mark notification as read here since invitation was just sent

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Invitation sent successfully",
	})
}

// RequestToJoinGroup creates a request to join a private group
func RequestToJoinGroup(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	groupIDStr := vars["id"]
	groupID, err := strconv.ParseInt(groupIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	var requestData struct {
		Message string `json:"message"`
	}

	if err := json.NewDecoder(r.Body).Decode(&requestData); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Check if group exists
	group, err := db.GetGroup(groupID)
	if err != nil || group == nil {
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}

	// Check if user is already a member
	if db.IsGroupMember(groupID, int64(userID)) {
		http.Error(w, "Already a member", http.StatusConflict)
		return
	}

	// Check if request already exists
	if db.HasPendingJoinRequest(groupID, int64(userID)) {
		http.Error(w, "Join request already sent", http.StatusConflict)
		return
	}

	// Create join request
	joinRequest := &sqlite.GroupJoinRequest{
		GroupID: groupID,
		UserID:  int64(userID),
		Message: requestData.Message,
	}

	_, err = db.CreateJoinRequest(joinRequest)
	if err != nil {
		log.Printf("Error creating join request: %v", err)
		http.Error(w, "Failed to send join request", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Join request sent successfully",
	})
}

// AcceptInvitation allows a user to accept a group invitation
func AcceptInvitation(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	invitationIDStr := vars["id"]
	invitationID, err := strconv.ParseInt(invitationIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid invitation ID", http.StatusBadRequest)
		return
	}

	// Get invitation details
	invitations, err := db.GetUserInvitations(int64(userID), "pending")
	if err != nil {
		http.Error(w, "Failed to get invitations", http.StatusInternalServerError)
		return
	}

	var invitation *sqlite.GroupInvitation
	for _, inv := range invitations {
		if inv.ID == invitationID {
			invitation = inv
			break
		}
	}

	if invitation == nil {
		http.Error(w, "Invitation not found", http.StatusNotFound)
		return
	}

	// Accept invitation
	err = db.UpdateInvitationStatus(invitationID, "accepted")
	if err != nil {
		http.Error(w, "Failed to accept invitation", http.StatusInternalServerError)
		return
	}

	// Add user to group
	err = db.AddGroupMember(invitation.GroupID, int64(userID), "member")
	if err != nil {
		http.Error(w, "Failed to join group", http.StatusInternalServerError)
		return
	}

	// Add user to group chat
	err = db.AddMemberToGroupConversation(invitation.GroupID, int64(userID))
	if err != nil {
		log.Printf("Error adding user to group conversation: %v", err)
	}

	// Delete related notification since invitation is processed
	deleteGroupInvitationNotification(int64(userID), invitation.GroupID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Invitation accepted successfully",
	})
}

// RejectInvitation allows a user to reject a group invitation
func RejectInvitation(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	invitationIDStr := vars["id"]
	invitationID, err := strconv.ParseInt(invitationIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid invitation ID", http.StatusBadRequest)
		return
	}

	// Verify invitation belongs to user
	invitations, err := db.GetUserInvitations(int64(userID), "pending")
	if err != nil {
		http.Error(w, "Failed to get invitations", http.StatusInternalServerError)
		return
	}

	var foundInvitation *sqlite.GroupInvitation
	for _, inv := range invitations {
		if inv.ID == invitationID {
			foundInvitation = inv
			break
		}
	}

	if foundInvitation == nil {
		http.Error(w, "Invitation not found", http.StatusNotFound)
		return
	}

	// Reject invitation
	err = db.UpdateInvitationStatus(invitationID, "rejected")
	if err != nil {
		http.Error(w, "Failed to reject invitation", http.StatusInternalServerError)
		return
	}

	// Delete related notification since invitation is processed
	deleteGroupInvitationNotification(int64(userID), foundInvitation.GroupID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Invitation rejected successfully",
	})
}

// GetUserInvitations retrieves all invitations for the current user
func GetUserInvitations(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	invitations, err := db.GetUserInvitations(int64(userID), "pending")
	if err != nil {
		http.Error(w, "Failed to get invitations", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"invitations": invitations,
	})
}

// AcceptJoinRequest allows group creator to accept a join request
func AcceptJoinRequest(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	requestIDStr := vars["id"]
	requestID, err := strconv.ParseInt(requestIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid request ID", http.StatusBadRequest)
		return
	}

	// Get join request details
	var groupID int64
	var requesterID int64
	query := `SELECT group_id, user_id FROM group_join_requests WHERE id = ? AND status = 'pending'`
	err = db.QueryRow(query, requestID).Scan(&groupID, &requesterID)
	if err != nil {
		http.Error(w, "Join request not found", http.StatusNotFound)
		return
	}

	// Check if user is group creator
	group, err := db.GetGroup(groupID)
	if err != nil || group == nil {
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}

	if group.CreatorID != int64(userID) {
		http.Error(w, "Only group creator can accept join requests", http.StatusForbidden)
		return
	}

	// Accept join request
	err = db.UpdateJoinRequestStatus(requestID, "accepted")
	if err != nil {
		http.Error(w, "Failed to accept join request", http.StatusInternalServerError)
		return
	}

	// Add user to group
	err = db.AddGroupMember(groupID, requesterID, "member")
	if err != nil {
		http.Error(w, "Failed to add user to group", http.StatusInternalServerError)
		return
	}

	// Add user to group chat
	err = db.AddMemberToGroupConversation(groupID, requesterID)
	if err != nil {
		log.Printf("Error adding user to group conversation: %v", err)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Join request accepted successfully",
	})
}

// RejectJoinRequest allows group creator to reject a join request
func RejectJoinRequest(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	requestIDStr := vars["id"]
	requestID, err := strconv.ParseInt(requestIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid request ID", http.StatusBadRequest)
		return
	}

	// Get join request details
	var groupID int64
	query := `SELECT group_id FROM group_join_requests WHERE id = ? AND status = 'pending'`
	err = db.QueryRow(query, requestID).Scan(&groupID)
	if err != nil {
		http.Error(w, "Join request not found", http.StatusNotFound)
		return
	}

	// Check if user is group creator
	group, err := db.GetGroup(groupID)
	if err != nil || group == nil {
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}

	if group.CreatorID != int64(userID) {
		http.Error(w, "Only group creator can reject join requests", http.StatusForbidden)
		return
	}

	// Reject join request
	err = db.UpdateJoinRequestStatus(requestID, "rejected")
	if err != nil {
		http.Error(w, "Failed to reject join request", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Join request rejected successfully",
	})
}

// GetGroupJoinRequests retrieves all join requests for a group
func GetGroupJoinRequests(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	groupIDStr := vars["id"]
	groupID, err := strconv.ParseInt(groupIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	// Check if user is group creator
	group, err := db.GetGroup(groupID)
	if err != nil || group == nil {
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}

	if group.CreatorID != int64(userID) {
		http.Error(w, "Only group creator can view join requests", http.StatusForbidden)
		return
	}

	requests, err := db.GetGroupJoinRequests(groupID, "pending")
	if err != nil {
		http.Error(w, "Failed to get join requests", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"requests": requests,
	})
}

// CreateGroupPost creates a new post in a group
func CreateGroupPost(w http.ResponseWriter, r *http.Request) {
	log.Printf("=== CreateGroupPost Handler Start ===")

	userID, err := getUserIDFromSession(r)
	if err != nil {
		log.Printf("CreateGroupPost: getUserIDFromSession error: %v", err)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	log.Printf("CreateGroupPost: User ID: %d", userID)

	vars := mux.Vars(r)
	groupIDStr := vars["id"]
	log.Printf("CreateGroupPost: Group ID string: %s", groupIDStr)

	groupID, err := strconv.ParseInt(groupIDStr, 10, 64)
	if err != nil {
		log.Printf("CreateGroupPost: ParseInt error: %v", err)
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}
	log.Printf("CreateGroupPost: Parsed Group ID: %d", groupID)

	// Check if user is a member of the group
	log.Printf("CreateGroupPost: Checking if user %d is member of group %d", userID, groupID)
	isMember := db.IsGroupMember(groupID, int64(userID))
	log.Printf("CreateGroupPost: Is member check result: %t", isMember)

	if !isMember {
		log.Printf("CreateGroupPost: Access denied - user %d is not a member of group %d", userID, groupID)
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}

	// Parse multipart form for file uploads
	log.Printf("CreateGroupPost: Parsing multipart form")
	err = r.ParseMultipartForm(10 << 20) // 10 MB max
	if err != nil {
		log.Printf("CreateGroupPost: ParseMultipartForm error: %v", err)
		http.Error(w, "Unable to parse form", http.StatusBadRequest)
		return
	}

	content := r.FormValue("content")
	log.Printf("CreateGroupPost: Content: %s", content)

	if content == "" {
		log.Printf("CreateGroupPost: Content is empty")
		http.Error(w, "Content is required", http.StatusBadRequest)
		return
	}

	// Handle file upload
	var imagePath string
	log.Printf("CreateGroupPost: Checking for image file")
	file, handler, err := r.FormFile("image")
	if err == nil && handler != nil && handler.Filename != "" {
		log.Printf("CreateGroupPost: Image file found: %s (size: %d bytes)", handler.Filename, handler.Size)
		defer file.Close()

		// Only validate if there's actually a file with content
		if handler.Size > 0 {
			// Validate image file format (JPEG, PNG, GIF only)
			log.Printf("CreateGroupPost: Validating image file")
			if err := ValidateImageFile(file, handler); err != nil {
				log.Printf("CreateGroupPost: ValidateImageFile error: %v", err)
				http.Error(w, "Invalid image file: "+err.Error(), http.StatusBadRequest)
				return
			}

			// Create uploads directory if it doesn't exist
			uploadsDir := "./uploads/groups"
			log.Printf("CreateGroupPost: Creating uploads directory: %s", uploadsDir)
			err = os.MkdirAll(uploadsDir, 0755)
			if err != nil {
				log.Printf("CreateGroupPost: MkdirAll error: %v", err)
				http.Error(w, "Failed to create upload directory", http.StatusInternalServerError)
				return
			}

			// Generate a unique filename with proper extension based on content type
			log.Printf("CreateGroupPost: Getting image MIME type")
			mimeType, err := GetImageMimeType(file)
			if err != nil {
				log.Printf("CreateGroupPost: GetImageMimeType error: %v", err)
				http.Error(w, "Failed to determine image type", http.StatusBadRequest)
				return
			}
			log.Printf("CreateGroupPost: Image MIME type: %s", mimeType)

			var ext string
			switch mimeType {
			case "image/jpeg":
				ext = ".jpg"
			case "image/png":
				ext = ".png"
			case "image/gif":
				ext = ".gif"
			default:
				log.Printf("CreateGroupPost: Unsupported image format: %s", mimeType)
				http.Error(w, "Unsupported image format", http.StatusBadRequest)
				return
			}

			filename := uuid.New().String() + ext
			imagePath = "/uploads/groups/" + filename
			log.Printf("CreateGroupPost: Image path: %s", imagePath)

			// Create the file
			fullPath := filepath.Join(uploadsDir, filename)
			log.Printf("CreateGroupPost: Creating file: %s", fullPath)
			dst, err := os.Create(fullPath)
			if err != nil {
				log.Printf("CreateGroupPost: os.Create error: %v", err)
				http.Error(w, "Failed to save image", http.StatusInternalServerError)
				return
			}
			defer dst.Close()

			// Copy the file content
			log.Printf("CreateGroupPost: Copying file content")
			if _, err = io.Copy(dst, file); err != nil {
				log.Printf("CreateGroupPost: io.Copy error: %v", err)
				http.Error(w, "Failed to save image", http.StatusInternalServerError)
				return
			}
			log.Printf("CreateGroupPost: Image saved successfully")
		} else {
			log.Printf("CreateGroupPost: Empty image file provided, ignoring")
		}
	} else {
		log.Printf("CreateGroupPost: No image file provided (error: %v)", err)
	}

	// Create post
	post := &sqlite.GroupPost{
		GroupID:   groupID,
		AuthorID:  int64(userID),
		Content:   content,
		ImagePath: imagePath,
	}
	log.Printf("CreateGroupPost: Creating post struct: %+v", post)

	log.Printf("CreateGroupPost: Calling db.CreateGroupPost")
	postID, err := db.CreateGroupPost(post)
	if err != nil {
		log.Printf("CreateGroupPost: db.CreateGroupPost error: %v", err)
		http.Error(w, "Failed to create post", http.StatusInternalServerError)
		return
	}
	log.Printf("CreateGroupPost: Post created with ID: %d", postID)

	// Get the created post with author details
	log.Printf("CreateGroupPost: Getting created post details")
	createdPost, err := db.GetGroupPost(postID, int64(userID))
	if err != nil {
		log.Printf("CreateGroupPost: db.GetGroupPost error: %v", err)
		http.Error(w, "Failed to retrieve created post", http.StatusInternalServerError)
		return
	}
	log.Printf("CreateGroupPost: Retrieved post: %+v", createdPost)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	// Send WebSocket notification to group members about new post
	go func() {
		notificationMessage := map[string]interface{}{
			"type":       "post_created",
			"post_id":    postID,
			"group_id":   groupID,
			"created_by": userID,
		}
		
		if err := broadcastToGroupMembers(groupID, notificationMessage); err != nil {
			log.Printf("Error broadcasting post creation: %v", err)
		}
	}()

	log.Printf("CreateGroupPost: Sending response")
	err = json.NewEncoder(w).Encode(createdPost)
	if err != nil {
		log.Printf("CreateGroupPost: json.Encode error: %v", err)
	}

	log.Printf("=== CreateGroupPost Handler End ===")
}

// GetGroupPosts retrieves all posts for a group
func GetGroupPosts(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	groupIDStr := vars["id"]
	groupID, err := strconv.ParseInt(groupIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	// Check if user is a member of the group
	if !db.IsGroupMember(groupID, int64(userID)) {
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}

	// Parse pagination parameters
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 20
	if limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	offset := 0
	if offsetStr != "" {
		if parsedOffset, err := strconv.Atoi(offsetStr); err == nil && parsedOffset >= 0 {
			offset = parsedOffset
		}
	}

	posts, err := db.GetGroupPosts(groupID, limit, offset, int64(userID))
	if err != nil {
		http.Error(w, "Failed to get posts", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"posts": posts,
	})
}

// LikeGroupPost likes or unlikes a group post
func LikeGroupPost(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	postIDStr := vars["postId"]
	postID, err := strconv.ParseInt(postIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	// Check if post exists
	post, err := db.GetGroupPost(postID, int64(userID))
	if err != nil || post == nil {
		http.Error(w, "Post not found", http.StatusNotFound)
		return
	}

	// Check if user already liked the post
	if db.HasUserLikedGroupPost(postID, int64(userID)) {
		// Unlike the post
		err = db.UnlikeGroupPost(postID, int64(userID))
		if err != nil {
			http.Error(w, "Failed to unlike post", http.StatusInternalServerError)
			return
		}
	} else {
		// Like the post
		err = db.LikeGroupPost(postID, int64(userID))
		if err != nil {
			http.Error(w, "Failed to like post", http.StatusInternalServerError)
			return
		}
	}

	// Get updated post
	post, err = db.GetGroupPost(postID, int64(userID))
	if err != nil {
		http.Error(w, "Failed to get updated post", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(post)
}

// CreateGroupPostComment creates a comment on a group post
func CreateGroupPostComment(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	postIDStr := vars["postId"]
	postID, err := strconv.ParseInt(postIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	var content string
	var imagePath string

	// Check if this is a multipart form request (has image)
	contentType := r.Header.Get("Content-Type")
	if strings.Contains(contentType, "multipart/form-data") {
		// Parse multipart form
		err := r.ParseMultipartForm(10 << 20) // 10MB limit
		if err != nil {
			http.Error(w, "Failed to parse multipart form", http.StatusBadRequest)
			return
		}

		// Get text content (optional)
		content = r.FormValue("content")

		// Handle image upload
		file, header, err := r.FormFile("image")
		if err != nil && err != http.ErrMissingFile {
			http.Error(w, "Error retrieving image file", http.StatusBadRequest)
			return
		}

		if file != nil {
			defer file.Close()

			// Validate file type
			allowedTypes := map[string]bool{
				"image/jpeg": true,
				"image/jpg":  true,
				"image/png":  true,
				"image/gif":  true,
			}

			// Get file type
			fileHeader := make([]byte, 512)
			_, err = file.Read(fileHeader)
			if err != nil {
				http.Error(w, "Error reading file", http.StatusBadRequest)
				return
			}

			fileType := http.DetectContentType(fileHeader)
			if !allowedTypes[fileType] {
				http.Error(w, "Invalid file type. Only JPEG, PNG, and GIF are allowed", http.StatusBadRequest)
				return
			}

			// Reset file pointer
			file.Seek(0, 0)

			// Validate file size (10MB limit)
			if header.Size > 10*1024*1024 {
				http.Error(w, "File too large. Maximum size is 10MB", http.StatusBadRequest)
				return
			}

			// Generate unique filename
			ext := filepath.Ext(header.Filename)
			filename := fmt.Sprintf("comment_%d_%s%s", userID, uuid.New().String(), ext)

			// Create uploads directory if it doesn't exist
			uploadsDir := "uploads/comments"
			if err := os.MkdirAll(uploadsDir, 0755); err != nil {
				log.Printf("Error creating uploads directory: %v", err)
				http.Error(w, "Failed to create upload directory", http.StatusInternalServerError)
				return
			}

			// Save file
			filePath := filepath.Join(uploadsDir, filename)
			dst, err := os.Create(filePath)
			if err != nil {
				log.Printf("Error creating file: %v", err)
				http.Error(w, "Failed to save file", http.StatusInternalServerError)
				return
			}
			defer dst.Close()

			_, err = io.Copy(dst, file)
			if err != nil {
				log.Printf("Error copying file: %v", err)
				http.Error(w, "Failed to save file", http.StatusInternalServerError)
				return
			}

			imagePath = "/" + filePath
		}
	} else {
		// Handle JSON request
		var requestData struct {
			Content string `json:"content"`
		}

		if err := json.NewDecoder(r.Body).Decode(&requestData); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		content = requestData.Content
	}

	// Validate that we have either content or an image
	if content == "" && imagePath == "" {
		http.Error(w, "Either content or image is required", http.StatusBadRequest)
		return
	}

	// Check if post exists
	post, err := db.GetGroupPost(postID, int64(userID))
	if err != nil || post == nil {
		http.Error(w, "Post not found", http.StatusNotFound)
		return
	}

	// Create comment
	comment := &sqlite.GroupPostComment{
		PostID:    postID,
		AuthorID:  int64(userID),
		Content:   content,
		ImagePath: imagePath,
	}

	commentID, err := db.CreateGroupPostComment(comment)
	if err != nil {
		http.Error(w, "Failed to create comment", http.StatusInternalServerError)
		return
	}

	// Get the created comment with user details
	createdComment, err := db.GetGroupPostComment(commentID, int64(userID))
	if err != nil {
		http.Error(w, "Failed to get created comment", http.StatusInternalServerError)
		return
	}

	// Send WebSocket notification to group members about new comment
	go func() {
		notificationMessage := map[string]interface{}{
			"type":       "comment_created",
			"comment_id": commentID,
			"post_id":    postID,
			"group_id":   post.GroupID,
			"created_by": userID,
		}
		
		if err := broadcastToGroupMembers(post.GroupID, notificationMessage); err != nil {
			log.Printf("Error broadcasting comment creation: %v", err)
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(createdComment)
}

// GetGroupPostComments retrieves all comments for a group post
func GetGroupPostComments(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	postIDStr := vars["postId"]
	postID, err := strconv.ParseInt(postIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	comments, err := db.GetGroupPostCommentsWithUserVotes(postID, int64(userID))
	if err != nil {
		http.Error(w, "Failed to get comments", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"comments": comments,
	})
}

// CreateGroupEvent creates a new event in a group
func CreateGroupEvent(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	groupIDStr := vars["id"]
	groupID, err := strconv.ParseInt(groupIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	// Check if user is a member of the group
	if !db.IsGroupMember(groupID, int64(userID)) {
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}

	var requestData struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Date        string `json:"date"`
		Time        string `json:"time"`
	}

	if err := json.NewDecoder(r.Body).Decode(&requestData); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if requestData.Title == "" || requestData.Date == "" || requestData.Time == "" {
		http.Error(w, "Title, date, and time are required", http.StatusBadRequest)
		return
	}

	// Parse date and time
	dateTimeStr := requestData.Date + " " + requestData.Time
	eventDate, err := time.Parse("2006-01-02 15:04", dateTimeStr)
	if err != nil {
		http.Error(w, "Invalid date/time format", http.StatusBadRequest)
		return
	}

	// Create event
	event := &sqlite.GroupEvent{
		GroupID:     groupID,
		CreatorID:   int64(userID),
		Title:       requestData.Title,
		Description: requestData.Description,
		EventDate:   eventDate,
	}

	eventID, err := db.CreateGroupEvent(event)
	if err != nil {
		log.Printf("Error creating event: %v", err)
		http.Error(w, "Failed to create event", http.StatusInternalServerError)
		return
	}

	// Get the created event
	createdEvent, err := db.GetGroupEvent(eventID, int64(userID))
	if err != nil {
		log.Printf("Error retrieving created event: %v", err)
		http.Error(w, "Failed to retrieve created event", http.StatusInternalServerError)
		return
	}

	// Send notifications to all group members about the new event
	go func() {
		members, err := db.GetGroupMembers(groupID)
		if err != nil {
			log.Printf("CreateGroupEvent: Failed to get group members for notifications: %v", err)
			return
		}

		// Get group details for notification
		group, err := db.GetGroup(groupID)
		if err != nil {
			log.Printf("CreateGroupEvent: Failed to get group details for notifications: %v", err)
			return
		}

		// Get creator details
		creator, err := db.GetUserById(userID)
		if err != nil {
			log.Printf("CreateGroupEvent: Failed to get creator details for notifications: %v", err)
			return
		}

		// Send notification to all group members except the creator
		for _, member := range members {
			if member.UserID != int64(userID) { // Don't notify the creator
				notification := &sqlite.Notification{
					ReceiverID:  member.UserID,
					SenderID:    int64(userID),
					Type:        "event_created",
					Content:     fmt.Sprintf("%s %s created a new event \"%s\" in %s", creator["first_name"], creator["last_name"], requestData.Title, group.Name),
					ReferenceID: eventID,
					IsRead:      false,
				}

				_, err := db.CreateNotification(notification)
				if err != nil {
					log.Printf("CreateGroupEvent: Failed to create notification for user %d: %v", member.UserID, err)
				}
			}
		}
	}()

	// Send WebSocket notification to group members about new event
	go func() {
		notificationMessage := map[string]interface{}{
			"type":       "event_created",
			"event_id":   eventID,
			"group_id":   groupID,
			"created_by": userID,
		}
		
		if err := broadcastToGroupMembers(groupID, notificationMessage); err != nil {
			log.Printf("Error broadcasting event creation: %v", err)
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(createdEvent)
}

// GetGroupEvents retrieves all events for a group
func GetGroupEvents(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	groupIDStr := vars["id"]
	groupID, err := strconv.ParseInt(groupIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	// Check if user is a member of the group
	if !db.IsGroupMember(groupID, int64(userID)) {
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}

	events, err := db.GetGroupEvents(groupID, int64(userID))
	if err != nil {
		http.Error(w, "Failed to get events", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"events": events,
	})
}

// RespondToGroupEvent allows a user to respond to a group event
func RespondToGroupEvent(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	eventIDStr := vars["eventId"]
	eventID, err := strconv.ParseInt(eventIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid event ID", http.StatusBadRequest)
		return
	}

	var requestData struct {
		Response string `json:"response"` // "going" or "not_going"
	}

	if err := json.NewDecoder(r.Body).Decode(&requestData); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if requestData.Response != "going" && requestData.Response != "not_going" && requestData.Response != "remove" {
		http.Error(w, "Response must be 'going', 'not_going', or 'remove'", http.StatusBadRequest)
		return
	}

	// Check if event exists before responding
	event, err := db.GetGroupEvent(eventID, int64(userID))
	if err != nil || event == nil {
		http.Error(w, "Event not found", http.StatusNotFound)
		return
	}

	// Respond to event
	err = db.RespondToEvent(eventID, int64(userID), requestData.Response)
	if err != nil {
		http.Error(w, "Failed to respond to event", http.StatusInternalServerError)
		return
	}

	// Get updated event
	event, err = db.GetGroupEvent(eventID, int64(userID))
	if err != nil {
		http.Error(w, "Failed to get updated event", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(event)
}

// DeleteGroupEvent deletes an event (creator or group admin only)
func DeleteGroupEvent(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	eventIDStr := vars["eventId"]
	eventID, err := strconv.ParseInt(eventIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid event ID", http.StatusBadRequest)
		return
	}

	// Get the event to check permissions
	event, err := db.GetGroupEvent(eventID, int64(userID))
	if err != nil {
		http.Error(w, "Failed to get event", http.StatusInternalServerError)
		return
	}
	if event == nil {
		http.Error(w, "Event not found", http.StatusNotFound)
		return
	}

	// Check if user is the event creator
	if event.CreatorID == int64(userID) {
		// User is the event creator, allow deletion
	} else {
		// Check if user is the group admin/creator
		group, err := db.GetGroup(event.GroupID)
		if err != nil || group == nil {
			http.Error(w, "Group not found", http.StatusNotFound)
			return
		}
		
		if group.CreatorID != int64(userID) {
			http.Error(w, "Only event creator or group admin can delete events", http.StatusForbidden)
			return
		}
	}

	// Delete the event
	err = db.DeleteGroupEvent(eventID)
	if err != nil {
		http.Error(w, "Failed to delete event", http.StatusInternalServerError)
		return
	}

	// Send WebSocket notification to group members about event deletion
	go func() {
		notificationMessage := map[string]interface{}{
			"type":       "event_deleted",
			"event_id":   eventID,
			"group_id":   event.GroupID,
			"deleted_by": userID,
		}
		
		if err := broadcastToGroupMembers(event.GroupID, notificationMessage); err != nil {
			log.Printf("Error broadcasting event deletion: %v", err)
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Event deleted successfully",
	})
}

// GetGroupMembers retrieves all members of a group
func GetGroupMembers(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	groupIDStr := vars["id"]
	groupID, err := strconv.ParseInt(groupIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	// Check if user is a member of the group
	if !db.IsGroupMember(groupID, int64(userID)) {
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}

	members, err := db.GetGroupMembersWithPending(groupID)
	if err != nil {
		http.Error(w, "Failed to get group members", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"members": members,
	})
}

// AddGroupMember adds a member to a group (creator only)
func AddGroupMember(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	groupIDStr := vars["id"]
	groupID, err := strconv.ParseInt(groupIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	var requestData struct {
		UserID    int64   `json:"user_id"`    // For single user
		MemberIDs []int64 `json:"member_ids"` // For multiple users
	}

	if err := json.NewDecoder(r.Body).Decode(&requestData); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Determine which users to add
	var userIDsToAdd []int64
	if requestData.UserID != 0 {
		// Single user mode (backward compatibility)
		userIDsToAdd = []int64{requestData.UserID}
	} else if len(requestData.MemberIDs) > 0 {
		// Multiple users mode
		userIDsToAdd = requestData.MemberIDs
	} else {
		http.Error(w, "No user IDs provided", http.StatusBadRequest)
		return
	}

	// Get group to check permissions
	group, err := db.GetGroup(groupID)
	if err != nil || group == nil {
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}

	// Check if user is the group creator (only creator can add members directly)
	if group.CreatorID != int64(userID) {
		http.Error(w, "Only group creator can add members directly", http.StatusForbidden)
		return
	}

	// Check if target users exist
	for _, memberID := range userIDsToAdd {
		targetUser, err := db.GetUserById(int(memberID))
		if err != nil || targetUser == nil {
			http.Error(w, "User not found", http.StatusNotFound)
			return
		}

		// Check if user is already a member
		if db.IsGroupMember(groupID, memberID) {
			http.Error(w, "User is already a member", http.StatusConflict)
			return
		}
	}

	// Get inviter information for notifications
	inviter, err := db.GetUserById(int(userID))
	if err != nil {
		log.Printf("Warning: Could not get inviter info: %v", err)
	}

	var inviterName string
	if inviter != nil {
		inviterName = inviter["first_name"].(string) + " " + inviter["last_name"].(string)
	} else {
		inviterName = "Unknown User"
	}

	var addedMembers []int64
	var sentInvitations []int64

	// Handle users based on group privacy
	for _, memberID := range userIDsToAdd {
		if group.Privacy == "private" {
			// For private groups, send invitation instead of adding directly
			
			// Check if invitation already exists
			if db.HasPendingInvitation(groupID, memberID) {
				log.Printf("Warning: User %d already has pending invitation, skipping", memberID)
				continue
			}

			// Create invitation
			invitation := &sqlite.GroupInvitation{
				GroupID:   groupID,
				InviterID: int64(userID),
				InviteeID: memberID,
			}

			invitationID, err := db.CreateGroupInvitation(invitation)
			if err != nil {
				log.Printf("Error creating invitation for user %d: %v", memberID, err)
				continue
			}

			// Create notification for the invited user
			_, err = db.CreateGroupInviteNotification(memberID, int64(userID), groupID, group.Name, inviterName)
			if err != nil {
				log.Printf("Error creating notification for user %d: %v", memberID, err)
				// Don't fail the invitation if notification creation fails
			}

			sentInvitations = append(sentInvitations, memberID)
			log.Printf("Successfully sent invitation %d to user %d for private group", invitationID, memberID)

		} else {
			// For public groups, add directly as before
			err = db.AddGroupMember(groupID, memberID, "member")
			if err != nil {
				log.Printf("Error adding group member: %v", err)
				http.Error(w, "Failed to add member", http.StatusInternalServerError)
				return
			}

			// Add user to group chat conversation
			err = db.AddMemberToGroupConversation(groupID, memberID)
			if err != nil {
				log.Printf("Error adding user to group conversation: %v", err)
				// Don't fail if chat addition fails
			}

			// Create notification for the added user (different type than invitation)
			notificationContent := fmt.Sprintf("%s added you to the group '%s'", inviterName, group.Name)
			
			notification := &sqlite.Notification{
				ReceiverID:  memberID,
				SenderID:    int64(userID),
				Type:        "group_member_added", // Different type for direct addition
				Content:     notificationContent,
				ReferenceID: groupID,
				IsRead:      false,
			}
			
			_, err = db.CreateNotification(notification)
			if err != nil {
				log.Printf("Warning: Could not create group addition notification: %v", err)
			}

			addedMembers = append(addedMembers, memberID)
		}
	}

	// Create appropriate response message
	var message string
	if group.Privacy == "private" {
		if len(sentInvitations) > 0 {
			message = fmt.Sprintf("Invitations sent to %d user(s)", len(sentInvitations))
		} else {
			message = "No invitations were sent"
		}
	} else {
		if len(addedMembers) > 0 {
			message = fmt.Sprintf("%d member(s) added successfully", len(addedMembers))
		} else {
			message = "No members were added"
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":           message,
		"group_privacy":     group.Privacy,
		"added_members":     addedMembers,
		"sent_invitations":  sentInvitations,
	})
}

// RemoveGroupMember removes a member from a group (admin/creator only)
func RemoveGroupMember(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	groupIDStr := vars["groupId"]
	memberIDStr := vars["memberId"]

	groupID, err := strconv.ParseInt(groupIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	memberID, err := strconv.ParseInt(memberIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid member ID", http.StatusBadRequest)
		return
	}

	// Get group to check permissions
	group, err := db.GetGroup(groupID)
	if err != nil || group == nil {
		http.Error(w, "Group not found", http.StatusNotFound)
		return
	}

	// Check if user is the group creator (only creator can remove members)
	if group.CreatorID != int64(userID) {
		http.Error(w, "Only group creator can remove members", http.StatusForbidden)
		return
	}

	// Cannot remove the creator
	if memberID == group.CreatorID {
		http.Error(w, "Cannot remove group creator", http.StatusBadRequest)
		return
	}

	// Check if target user is actually a member
	if !db.IsGroupMember(groupID, memberID) {
		http.Error(w, "User is not a member of this group", http.StatusBadRequest)
		return
	}

	// Remove member from group
	err = db.RemoveGroupMember(groupID, memberID)
	if err != nil {
		log.Printf("Error removing group member: %v", err)
		http.Error(w, "Failed to remove member", http.StatusInternalServerError)
		return
	}

	// Remove member from group chat conversation
	err = db.RemoveMemberFromGroupConversation(groupID, memberID)
	if err != nil {
		log.Printf("Error removing member from group conversation: %v", err)
		// Don't fail if chat removal fails
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Member removed successfully",
	})
}

// DeleteGroup deletes a group (creator only)
func DeleteGroup(w http.ResponseWriter, r *http.Request) {
	log.Printf("=== DeleteGroup Handler Called ===")
	log.Printf("Request URL: %s", r.URL.String())
	log.Printf("Request Method: %s", r.Method)

	userID, err := getUserIDFromSession(r)
	if err != nil {
		log.Printf("DeleteGroup: Authentication failed: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Unauthorized - Please log in to delete groups",
		})
		return
	}
	log.Printf("DeleteGroup: User ID from session: %d", userID)

	vars := mux.Vars(r)
	groupIDStr := vars["id"]
	log.Printf("DeleteGroup: Group ID from URL: %s", groupIDStr)

	groupID, err := strconv.ParseInt(groupIDStr, 10, 64)
	if err != nil {
		log.Printf("DeleteGroup: Invalid group ID format: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Invalid group ID format",
		})
		return
	}
	log.Printf("DeleteGroup: Parsed group ID: %d", groupID)

	// Check if the group exists
	group, err := db.GetGroup(groupID)
	if err != nil {
		log.Printf("DeleteGroup: Database error while fetching group: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Database error while fetching group",
		})
		return
	}

	if group == nil {
		log.Printf("DeleteGroup: Group %d not found", groupID)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		response := map[string]string{
			"error": "Group not found or has already been deleted",
		}
		responseBytes, _ := json.Marshal(response)
		log.Printf("DeleteGroup: Sending 404 response: %s", string(responseBytes))
		json.NewEncoder(w).Encode(response)
		return
	}
	log.Printf("DeleteGroup: Found group '%s' (ID: %d, Creator: %d)", group.Name, group.ID, group.CreatorID)

	// Check if the user is the creator
	if group.CreatorID != int64(userID) {
		log.Printf("DeleteGroup: User %d is not the creator of group %d (creator is %d)", userID, groupID, group.CreatorID)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Only the group creator can delete this group",
		})
		return
	}

	// Delete the group
	log.Printf("DeleteGroup: Attempting to delete group %d", groupID)
	err = db.DeleteGroup(groupID)
	if err != nil {
		log.Printf("DeleteGroup: Database error while deleting group: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)

		// Provide more detailed error message based on the error type
		errorMsg := "Failed to delete group"
		if strings.Contains(err.Error(), "foreign key constraint") {
			errorMsg = "Failed to delete group: Some related data could not be deleted. Please try again."
		} else if strings.Contains(err.Error(), "no rows affected") {
			errorMsg = "Failed to delete group: Group may have already been deleted."
		}

		json.NewEncoder(w).Encode(map[string]string{
			"error":   errorMsg,
			"details": err.Error(),
		})
		return
	}

	log.Printf("DeleteGroup: Successfully deleted group %d", groupID)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Group deleted successfully",
	})
}

// VoteGroupPost handles upvotes and downvotes on group posts
func VoteGroupPost(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	postIDStr := vars["postId"]
	postID, err := strconv.ParseInt(postIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	var voteRequest struct {
		VoteType int `json:"vote_type"` // 1 for upvote, -1 for downvote
	}

	if err := json.NewDecoder(r.Body).Decode(&voteRequest); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Validate vote type
	if voteRequest.VoteType != 1 && voteRequest.VoteType != -1 {
		http.Error(w, "Vote type must be 1 (upvote) or -1 (downvote)", http.StatusBadRequest)
		return
	}

	// Check if post exists and user has access
	post, err := db.GetGroupPost(postID, int64(userID))
	if err != nil || post == nil {
		http.Error(w, "Group post not found or access denied", http.StatusNotFound)
		return
	}

	// Cast vote using the generalized vote function with content type "group_post"
	err = db.Vote(userID, postID, "group_post", voteRequest.VoteType)
	if err != nil {
		log.Printf("Error voting on group post: %v", err)
		http.Error(w, "Failed to vote on group post: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Get updated post data including vote counts
	updatedPost, err := db.GetGroupPost(postID, int64(userID))
	if err != nil {
		log.Printf("Error fetching updated group post: %v", err)
		http.Error(w, "Failed to fetch updated post", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":   "Vote recorded successfully",
		"upvotes":   updatedPost.Upvotes,
		"downvotes": updatedPost.Downvotes,
		"user_vote": updatedPost.UserVote,
	})
}

// VoteGroupPostComment handles upvotes and downvotes on group post comments
func VoteGroupPostComment(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	commentIDStr := vars["commentId"]
	commentID, err := strconv.ParseInt(commentIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid comment ID", http.StatusBadRequest)
		return
	}

	var voteRequest struct {
		VoteType int `json:"vote_type"` // 1 for upvote, -1 for downvote
	}

	if err := json.NewDecoder(r.Body).Decode(&voteRequest); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Validate vote type
	if voteRequest.VoteType != 1 && voteRequest.VoteType != -1 {
		http.Error(w, "Vote type must be 1 (upvote) or -1 (downvote)", http.StatusBadRequest)
		return
	}

	// Check if comment exists and user has access
	comment, err := db.GetGroupPostComment(commentID, int64(userID))
	if err != nil || comment == nil {
		http.Error(w, "Group post comment not found or access denied", http.StatusNotFound)
		return
	}

	// Cast vote using the generalized vote function with content type "group_post_comment"
	err = db.Vote(userID, commentID, "group_post_comment", voteRequest.VoteType)
	if err != nil {
		log.Printf("Error voting on group post comment: %v", err)
		http.Error(w, "Failed to vote on group post comment: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Get updated comment data including vote counts
	updatedComment, err := db.GetGroupPostComment(commentID, int64(userID))
	if err != nil {
		log.Printf("Error fetching updated group post comment: %v", err)
		http.Error(w, "Failed to fetch updated comment", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":   "Vote recorded successfully",
		"upvotes":   updatedComment.Upvotes,
		"downvotes": updatedComment.Downvotes,
		"user_vote": updatedComment.UserVote,
	})
}

// DeleteGroupPostComment deletes a group post comment (only by comment author or post owner)
func DeleteGroupPostComment(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	commentIDStr := vars["commentId"]
	commentID, err := strconv.ParseInt(commentIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid comment ID", http.StatusBadRequest)
		return
	}

	// Get the comment to check ownership
	comment, err := db.GetGroupPostComment(commentID, int64(userID))
	if err != nil || comment == nil {
		http.Error(w, "Comment not found", http.StatusNotFound)
		return
	}

	// Get the post to check if user is the post owner
	post, err := db.GetGroupPost(comment.PostID, int64(userID))
	if err != nil || post == nil {
		http.Error(w, "Post not found", http.StatusNotFound)
		return
	}

	// Check permissions: user must be either the comment author or the post owner
	if comment.AuthorID != int64(userID) && post.AuthorID != int64(userID) {
		http.Error(w, "Access denied: you can only delete your own comments or comments on your posts", http.StatusForbidden)
		return
	}

	// Delete the comment
	err = db.DeleteGroupPostComment(commentID)
	if err != nil {
		log.Printf("Error deleting group post comment: %v", err)
		http.Error(w, "Failed to delete comment", http.StatusInternalServerError)
		return
	}

	// Send WebSocket notification to group members about comment deletion
	go func() {
		notificationMessage := map[string]interface{}{
			"type":       "comment_deleted",
			"comment_id": commentID,
			"post_id":    comment.PostID,
			"group_id":   post.GroupID,
			"deleted_by": userID,
		}
		
		if err := broadcastToGroupMembers(post.GroupID, notificationMessage); err != nil {
			log.Printf("Error broadcasting comment deletion: %v", err)
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Comment deleted successfully",
	})
}

// DeleteGroupPost deletes a group post (only by post author or group admin)
func DeleteGroupPost(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromSession(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	vars := mux.Vars(r)
	postIDStr := vars["postId"]
	postID, err := strconv.ParseInt(postIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	// Get the post to check ownership and group info
	post, err := db.GetGroupPost(postID, int64(userID))
	if err != nil || post == nil {
		http.Error(w, "Post not found", http.StatusNotFound)
		return
	}

	// Check permissions: user must be either the post author or the group admin
	if post.AuthorID != int64(userID) {
		// Check if user is the group admin/creator
		group, err := db.GetGroup(post.GroupID)
		if err != nil || group == nil {
			http.Error(w, "Group not found", http.StatusNotFound)
			return
		}
		
		if group.CreatorID != int64(userID) {
			http.Error(w, "Access denied: you can only delete your own posts or posts in groups you admin", http.StatusForbidden)
			return
		}
	}

	// Delete the post
	err = db.DeleteGroupPost(postID)
	if err != nil {
		log.Printf("Error deleting group post: %v", err)
		http.Error(w, "Failed to delete post", http.StatusInternalServerError)
		return
	}

	// Send WebSocket notification to group members about post deletion
	go func() {
		notificationMessage := map[string]interface{}{
			"type":       "post_deleted",
			"post_id":    postID,
			"group_id":   post.GroupID,
			"deleted_by": userID,
		}
		
			if err := broadcastToGroupMembers(post.GroupID, notificationMessage); err != nil {
		log.Printf("Error broadcasting post deletion: %v", err)
	}
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Post deleted successfully",
		"post_id": postID,
		"group_id": post.GroupID,
	})
}

// broadcastToGroupMembers sends a WebSocket message to all members of a group
func broadcastToGroupMembers(groupID int64, message map[string]interface{}) error {
	if chatHub == nil {
		return fmt.Errorf("chat hub not initialized")
	}

	// Get group conversation
	conversation, err := db.GetGroupConversation(groupID)
	if err != nil || conversation == nil {
		log.Printf("No conversation found for group %d", groupID)
		return nil // Not an error, group might not have chat enabled
	}

	// Convert message to JSON
	messageBytes, err := json.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %v", err)
	}

	// Send to all clients in the group conversation
	chatHub.mutex.Lock()
	clients := chatHub.conversations[conversation.ID]
	sentCount := 0
	for _, client := range clients {
		select {
		case client.Send <- messageBytes:
			sentCount++
		default:
			log.Printf("Failed to send broadcast to client %d", client.UserID)
		}
	}
	chatHub.mutex.Unlock()

	log.Printf("Broadcast sent to %d clients in group %d", sentCount, groupID)
	return nil
}

// RegisterGroupRoutes registers all group-related routes
func RegisterGroupRoutes(router *mux.Router) {
	// Group management
	router.HandleFunc("/groups", GetGroups).Methods("GET", "OPTIONS")
	router.HandleFunc("/groups", CreateGroup).Methods("POST", "OPTIONS")
	router.HandleFunc("/groups/{id}", GetGroup).Methods("GET", "OPTIONS")

	// Group membership
	router.HandleFunc("/groups/{id}/join", JoinGroup).Methods("POST", "OPTIONS")
	router.HandleFunc("/groups/{id}/leave", LeaveGroup).Methods("POST", "OPTIONS")
	router.HandleFunc("/groups/{id}/members", GetGroupMembers).Methods("GET", "OPTIONS")
	router.HandleFunc("/groups/{id}/members", AddGroupMember).Methods("POST", "OPTIONS")
	router.HandleFunc("/groups/{groupId}/members/{memberId}", RemoveGroupMember).Methods("DELETE", "OPTIONS")
	router.HandleFunc("/groups/{id}", DeleteGroup).Methods("DELETE", "OPTIONS")

	// Group invitations
	router.HandleFunc("/groups/{id}/invite", InviteToGroup).Methods("POST", "OPTIONS")
	router.HandleFunc("/invitations", GetUserInvitations).Methods("GET", "OPTIONS")
	router.HandleFunc("/invitations/{id}/accept", AcceptInvitation).Methods("POST", "OPTIONS")
	router.HandleFunc("/invitations/{id}/reject", RejectInvitation).Methods("POST", "OPTIONS")

	// Join requests
	router.HandleFunc("/groups/{id}/request", RequestToJoinGroup).Methods("POST", "OPTIONS")
	router.HandleFunc("/groups/{id}/requests", GetGroupJoinRequests).Methods("GET", "OPTIONS")
	router.HandleFunc("/requests/{id}/accept", AcceptJoinRequest).Methods("POST", "OPTIONS")
	router.HandleFunc("/requests/{id}/reject", RejectJoinRequest).Methods("POST", "OPTIONS")

	// Group posts
	router.HandleFunc("/groups/{id}/posts", GetGroupPosts).Methods("GET", "OPTIONS")
	router.HandleFunc("/groups/{id}/posts", CreateGroupPost).Methods("POST", "OPTIONS")
	router.HandleFunc("/groups/posts/{postId}/like", LikeGroupPost).Methods("POST", "OPTIONS")
	router.HandleFunc("/groups/posts/{postId}/vote", VoteGroupPost).Methods("POST", "OPTIONS")
	router.HandleFunc("/groups/posts/{postId}/comments", GetGroupPostComments).Methods("GET", "OPTIONS")
	router.HandleFunc("/groups/posts/{postId}/comments", CreateGroupPostComment).Methods("POST", "OPTIONS")
	router.HandleFunc("/groups/posts/{postId}/comments/{commentId}/vote", VoteGroupPostComment).Methods("POST", "OPTIONS")
	router.HandleFunc("/groups/posts/{postId}/comments/{commentId}", DeleteGroupPostComment).Methods("DELETE", "OPTIONS")
	router.HandleFunc("/groups/posts/{postId}", DeleteGroupPost).Methods("DELETE", "OPTIONS")

	// Group events
	router.HandleFunc("/groups/{id}/events", GetGroupEvents).Methods("GET", "OPTIONS")
	router.HandleFunc("/groups/{id}/events", CreateGroupEvent).Methods("POST", "OPTIONS")
	router.HandleFunc("/groups/events/{eventId}/respond", RespondToGroupEvent).Methods("POST", "OPTIONS")
	router.HandleFunc("/groups/events/{eventId}", DeleteGroupEvent).Methods("DELETE", "OPTIONS")
}

// Helper function to delete group invitation notifications
func deleteGroupInvitationNotification(userID, groupID int64) {
	query := `DELETE FROM notifications 
	          WHERE receiver_id = ? AND reference_id = ? AND type = 'group_invitation'`
	_, err := db.Exec(query, userID, groupID)
	if err != nil {
		log.Printf("Error deleting group invitation notification: %v", err)
	}
}
