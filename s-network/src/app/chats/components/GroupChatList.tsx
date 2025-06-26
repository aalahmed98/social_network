"use client";

import { useState, useEffect } from "react";
import { Chat } from "../page";
import { IoSearch, IoClose } from "react-icons/io5";
import {
  FaPlus,
  FaUsers,
  FaUserCheck,
  FaClock,
  FaUserPlus,
  FaEllipsisV,
  FaTrash,
} from "react-icons/fa";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

interface GroupChatListProps {
  groupChats: Chat[];
  selectedChatId: string | undefined;
  onSelectChat: (chat: Chat) => void;
  isLoading: boolean;
  error: string | null;
  onGroupCreated?: () => void;
}

interface Group {
  id: number;
  name: string;
  description: string;
  creator_id: number;
  avatar?: string;
  privacy: "public" | "private";
  created_at: string;
  member_count: number;
  is_joined: boolean;
  is_pending: boolean;
  has_join_request: boolean;
  user_role?: string;
  creator_name: string;
}

interface GroupInvitation {
  id: number;
  group_id: number;
  group_name: string;
  inviter_name: string;
  created_at: string;
}

export default function GroupChatList({
  groupChats,
  selectedChatId,
  onSelectChat,
  isLoading,
  error,
  onGroupCreated,
}: GroupChatListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isBrowseDialogOpen, setIsBrowseDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [newGroupPrivacy, setNewGroupPrivacy] = useState<"public" | "private">(
    "public"
  );
  const [isCreating, setIsCreating] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [followingUsers, setFollowingUsers] = useState<any[]>([]);
  const [isLoadingFollowing, setIsLoadingFollowing] = useState(false);
  const [searchUsers, setSearchUsers] = useState<any[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);

  // Browse groups state
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [browseActiveTab, setBrowseActiveTab] = useState("all");
  const [isBrowseLoading, setIsBrowseLoading] = useState(false);

  // Current user and delete state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<Chat | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Feedback state for invitations
  const [feedbackMessages, setFeedbackMessages] = useState<{
    [key: number]: { message: string; type: "success" | "error" };
  }>({});
  const [processedInvitations, setProcessedInvitations] = useState<Set<number>>(
    new Set()
  );

  // Show feedback message temporarily
  const showFeedback = (
    invitationId: number,
    message: string,
    type: "success" | "error"
  ) => {
    setFeedbackMessages((prev) => ({
      ...prev,
      [invitationId]: { message, type },
    }));

    // Hide feedback after 3 seconds
    setTimeout(() => {
      setFeedbackMessages((prev) => {
        const newMessages = { ...prev };
        delete newMessages[invitationId];
        return newMessages;
      });
    }, 3000);
  };

  // Filter chats based on search query
  const filteredChats = groupChats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Fetch current user on component mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
        const response = await fetch(`${backendUrl}/api/auth/me`, {
          method: "GET",
          credentials: "include",
        });

        if (response.ok) {
          const userData = await response.json();
          setCurrentUser(userData);
        }
      } catch (error) {
        console.error("Error fetching current user:", error);
      }
    };

    fetchCurrentUser();
  }, []);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;

    setIsCreating(true);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newGroupName.trim(),
          description: newGroupDescription.trim(),
          privacy: newGroupPrivacy,
          member_ids: selectedMembers,
        }),
        credentials: "include",
      });

      if (response.ok) {
        setIsCreateDialogOpen(false);
        setNewGroupName("");
        setNewGroupDescription("");
        setNewGroupPrivacy("public");
        setSelectedMembers([]);

        // Refresh groups
        if (onGroupCreated) {
          onGroupCreated();
        }
      } else {
        console.error("Failed to create group");
      }
    } catch (error) {
      console.error("Error creating group:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const loadAllGroups = async () => {
    setIsBrowseLoading(true);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/groups`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        // Filter to show only public groups in browse section
        // Private groups should only be accessible through invitations
        const publicGroups = (data.groups || []).filter(
          (group: Group) => group.privacy === "public"
        );
        setAllGroups(publicGroups);
      }
    } catch (error) {
      console.error("Error loading groups:", error);
    } finally {
      setIsBrowseLoading(false);
    }
  };

  const loadInvitations = async () => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/invitations`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setInvitations(data || []);
      }
    } catch (error) {
      console.error("Error loading invitations:", error);
    }
  };

  const handleJoinGroup = async (groupId: number) => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/groups/${groupId}/join`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        loadAllGroups();
        if (onGroupCreated) {
          onGroupCreated();
        }
      }
    } catch (error) {
      console.error("Error joining group:", error);
    }
  };

  const handleRequestJoin = async (groupId: number) => {
    const message = prompt("Enter a message (optional):");
    if (message === null) return;

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(
        `${backendUrl}/api/groups/${groupId}/request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
          credentials: "include",
        }
      );

      if (response.ok) {
        loadAllGroups();
      }
    } catch (error) {
      console.error("Error requesting to join group:", error);
    }
  };

  const handleAcceptInvitation = async (invitationId: number) => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(
        `${backendUrl}/api/invitations/${invitationId}/accept`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (response.ok) {
        // Immediately remove the invitation from the UI
        setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));

        setFeedbackMessages((prev) => ({
          ...prev,
          [invitationId]: {
            message: `✅ Successfully joined ${
              invitations.find((inv) => inv.id === invitationId)?.group_name
            }!`,
            type: "success",
          },
        }));

        // Clear feedback after 3 seconds
        setTimeout(() => {
          setFeedbackMessages((prev) => {
            const newMessages = { ...prev };
            delete newMessages[invitationId];
            return newMessages;
          });
        }, 3000);

        loadInvitations();
        loadAllGroups();
        if (onGroupCreated) {
          onGroupCreated();
        }
      } else {
        showFeedback(invitationId, "Failed to accept invitation", "error");
      }
    } catch (error) {
      console.error("Error accepting invitation:", error);
      showFeedback(invitationId, "An error occurred", "error");
    }
  };

  const handleRejectInvitation = async (invitationId: number) => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(
        `${backendUrl}/api/invitations/${invitationId}/reject`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (response.ok) {
        // Immediately remove the invitation from the UI
        setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));

        setFeedbackMessages((prev) => ({
          ...prev,
          [invitationId]: {
            message: `❌ Declined invitation to ${
              invitations.find((inv) => inv.id === invitationId)?.group_name
            }`,
            type: "success",
          },
        }));

        // Clear feedback after 3 seconds
        setTimeout(() => {
          setFeedbackMessages((prev) => {
            const newMessages = { ...prev };
            delete newMessages[invitationId];
            return newMessages;
          });
        }, 3000);

        loadInvitations();
      } else {
        showFeedback(invitationId, "Failed to decline invitation", "error");
      }
    } catch (error) {
      console.error("Error rejecting invitation:", error);
      showFeedback(invitationId, "An error occurred", "error");
    }
  };

  const handleBrowseGroups = () => {
    setIsBrowseDialogOpen(true);
    loadAllGroups();
    loadInvitations();
  };

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;

    setIsDeleting(true);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      console.log(`Attempting to delete group with ID: ${groupToDelete.id}`);

      const response = await fetch(
        `${backendUrl}/api/groups/${groupToDelete.id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      console.log(`Delete response status: ${response.status}`);

      if (response.ok) {
        console.log("Group deleted successfully");
        setShowDeleteConfirm(false);
        setGroupToDelete(null);
        // Refresh the groups list
        if (onGroupCreated) {
          onGroupCreated();
        }
        alert("Group deleted successfully!");
      } else {
        // Get the actual error message from the response
        let errorMessage = "Failed to delete group. Please try again.";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
          console.error("Delete error response:", errorData);
        } catch (e) {
          console.error("Could not parse error response");
        }

        console.error(`Delete failed with status: ${response.status}`);
        alert(`Error: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Error deleting group:", error);
      alert("Network error occurred while deleting group. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const isGroupCreator = (chat: Chat) => {
    // STRICT PERMISSION CHECK: Verify user is the group creator
    if (!currentUser || !chat.members || chat.members.length === 0) {
      return false;
    }

    // Multiple checks for reliability:
    // 1. Check if user matches creator ID if available from group data
    // 2. Fallback: Check if user is the first member (usually the creator)
    const firstMember = chat.members[0];
    const userMatches =
      firstMember &&
      (firstMember.id === currentUser.id ||
        firstMember.id === currentUser.userId ||
        // Additional check for string/number comparison
        String(firstMember.id) === String(currentUser.id) ||
        String(firstMember.id) === String(currentUser.userId));

    return Boolean(userMatches);
  };

  const loadFollowingUsers = async () => {
    if (!currentUser) return;

    setIsLoadingFollowing(true);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(
        `${backendUrl}/api/users/${currentUser.id}/following`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        setFollowingUsers(data.following || []);
      }
    } catch (error) {
      console.error("Error loading following users:", error);
    } finally {
      setIsLoadingFollowing(false);
    }
  };

  const handleMemberToggle = (userId: number) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSearchUsers = async (query: string) => {
    if (!query.trim() || !currentUser) {
      setSearchUsers([]);
      return;
    }

    setIsSearchingUsers(true);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      // Search for users by name
      const response = await fetch(
        `${backendUrl}/api/users/search?q=${encodeURIComponent(query.trim())}`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        const users = data.users || [];

        // Get current user's following and followers to filter results
        const [followingResponse, followersResponse] = await Promise.all([
          fetch(`${backendUrl}/api/users/${currentUser.id}/following`, {
            credentials: "include",
          }),
          fetch(`${backendUrl}/api/followers`, {
            credentials: "include",
          }),
        ]);

        let allowedUserIds = new Set<number>();

        // Add users that current user follows
        if (followingResponse.ok) {
          const followingData = await followingResponse.json();
          (followingData.following || []).forEach((user: any) => {
            allowedUserIds.add(user.id);
          });
        }

        // Add users that follow current user
        if (followersResponse.ok) {
          const followersData = await followersResponse.json();
          (followersData.followers || []).forEach((user: any) => {
            allowedUserIds.add(user.id);
          });
        }

        // Filter search results to only include users with relationships
        const filteredUsers = users.filter((user: any) => {
          return user.id !== currentUser.id && allowedUserIds.has(user.id);
        });

        setSearchUsers(filteredUsers);
      }
    } catch (error) {
      console.error("Error searching users:", error);
      setSearchUsers([]);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (showUserSearch) {
        handleSearchUsers(userSearchQuery);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [userSearchQuery, showUserSearch, currentUser]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 to-blue-50">
      {/* Modern Search and Actions Section */}
      <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-slate-200/60">
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search groups..."
            className="w-full pl-10 pr-4 py-3 bg-white/80 backdrop-blur-sm rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 border border-slate-200 shadow-md transition-all duration-200 placeholder-slate-400 font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <IoSearch
            className="absolute left-3 top-3.5 text-slate-400"
            size={18}
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsCreateDialogOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            <FaPlus size={14} />
            <span>Create Group</span>
          </button>
          <button
            onClick={handleBrowseGroups}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            <FaUsers size={14} />
            <span>Browse Groups</span>
          </button>
        </div>
      </div>

      {/* Modern Group List */}
      <div className="overflow-y-auto flex-1">
        {error ? (
          <div className="flex items-center justify-center h-32 mx-4 mt-4">
            <div className="text-center p-6 bg-red-50 border border-red-200 rounded-2xl shadow-lg">
              <div className="text-red-500 text-3xl mb-3">⚠️</div>
              <p className="text-red-700 font-medium">{error}</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center items-center h-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-200 border-t-blue-600 mx-auto mb-3"></div>
              <p className="text-slate-500 font-medium">Loading groups...</p>
            </div>
          </div>
        ) : filteredChats.length > 0 ? (
          <div className="p-2">
            {filteredChats.map((chat) => (
              <div
                key={chat.id}
                className={`flex items-start p-4 rounded-2xl transition-all duration-200 relative group mb-2 border ${
                  selectedChatId === chat.id
                    ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 shadow-md"
                    : "bg-white/60 backdrop-blur-sm hover:bg-white/80 border-slate-200/60 hover:shadow-lg hover:border-blue-200"
                }`}
              >
                <div className="relative">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 overflow-hidden flex items-center justify-center text-white shadow-lg ring-2 ring-white">
                    {chat.avatar ? (
                      <img
                        src={
                          chat.avatar.startsWith("http")
                            ? chat.avatar
                            : `${
                                process.env.NEXT_PUBLIC_BACKEND_URL ||
                                "http://localhost:8080"
                              }${chat.avatar}`
                        }
                        alt={chat.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <FaUsers className="h-6 w-6" />
                    )}
                  </div>
                  {/* Online indicator */}
                  <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 bg-green-500 border-2 border-white rounded-full"></div>
                </div>

                <div
                  className="ml-4 flex-1 overflow-hidden cursor-pointer"
                  onClick={() => onSelectChat(chat)}
                >
                  <div className="flex justify-between items-baseline">
                    <h3 className="font-bold text-slate-800 truncate">
                      {chat.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium">
                        {chat.lastMessageTime}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 truncate leading-relaxed">
                    {chat.lastMessage || "No messages yet"}
                  </p>
                  {chat.members && chat.members.length > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <div className="h-1.5 w-1.5 bg-indigo-500 rounded-full"></div>
                      <p className="text-xs text-slate-500 font-medium">
                        {chat.members.length} members
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full mx-4">
            <div className="text-center p-8 bg-white/60 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-lg">
              <div className="text-6xl mb-4">👥</div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">
                No groups yet
              </h3>
              <p className="text-slate-500 mb-4">
                Create your first group or browse existing ones to get started!
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl text-sm font-medium shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                >
                  Create Group
                </button>
                <button
                  onClick={handleBrowseGroups}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl text-sm font-medium shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                >
                  Browse Groups
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Group Dialog */}
      <Dialog.Root
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 w-full max-w-lg z-50 max-h-[80vh] overflow-y-auto">
            <Dialog.Title className="text-xl font-semibold mb-4">
              Create New Group
            </Dialog.Title>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="groupName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Group Name
                </label>
                <input
                  id="groupName"
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter group name"
                />
              </div>

              <div>
                <label
                  htmlFor="groupDescription"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Description
                </label>
                <textarea
                  id="groupDescription"
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter group description"
                />
              </div>

              <div>
                <label
                  htmlFor="groupPrivacy"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Privacy
                </label>
                <select
                  id="groupPrivacy"
                  value={newGroupPrivacy}
                  onChange={(e) =>
                    setNewGroupPrivacy(e.target.value as "public" | "private")
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="public">Public - Anyone can join</option>
                  <option value="private">Private - Invitation only</option>
                </select>
              </div>

              {/* Add Members Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Members (Optional)
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Search for people you know to add to this group
                </p>

                {/* Search Input */}
                <div className="relative mb-3">
                  <input
                    type="text"
                    placeholder="Search for users to add..."
                    value={userSearchQuery}
                    onChange={(e) => {
                      setUserSearchQuery(e.target.value);
                      setShowUserSearch(true);
                    }}
                    onFocus={() => setShowUserSearch(true)}
                    className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                  <IoSearch
                    className="absolute left-3 top-2.5 text-gray-400"
                    size={16}
                  />
                  {isSearchingUsers && (
                    <div className="absolute right-3 top-2.5">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                </div>

                {/* Search Results */}
                {showUserSearch && userSearchQuery.trim() && (
                  <div className="border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                    {isSearchingUsers ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      </div>
                    ) : searchUsers.length > 0 ? (
                      searchUsers.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        >
                          <input
                            type="checkbox"
                            id={`search-member-${user.id}`}
                            checked={selectedMembers.includes(user.id)}
                            onChange={() => handleMemberToggle(user.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <div className="ml-3 flex items-center flex-1">
                            <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-200 mr-3 flex items-center justify-center">
                              {user.avatar ? (
                                <img
                                  src={
                                    user.avatar.startsWith("http")
                                      ? user.avatar
                                      : `${
                                          process.env.NEXT_PUBLIC_BACKEND_URL ||
                                          "http://localhost:8080/"
                                        }${user.avatar}`
                                  }
                                  alt={user.first_name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-300">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="white"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="w-4 h-4"
                                  >
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                  </svg>
                                </div>
                              )}
                            </div>
                            <label
                              htmlFor={`search-member-${user.id}`}
                              className="text-sm font-medium text-gray-900 cursor-pointer flex-1"
                            >
                              {user.first_name} {user.last_name}
                            </label>
                          </div>
                        </div>
                      ))
                    ) : userSearchQuery.trim() ? (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        No users found matching "{userSearchQuery}"
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Show hint when no search is active */}
                {(!showUserSearch || !userSearchQuery.trim()) && (
                  <div className="text-center py-4 text-gray-500 text-sm border border-gray-200 rounded-md bg-gray-50">
                    <IoSearch
                      className="mx-auto mb-2 text-gray-400"
                      size={24}
                    />
                    <p>Start typing to search for users to add</p>
                    <p className="text-xs text-gray-400 mt-1">
                      You can add people you follow or who follow you
                    </p>
                  </div>
                )}

                {selectedMembers.length > 0 && (
                  <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-800">
                      {selectedMembers.length} member
                      {selectedMembers.length !== 1 ? "s" : ""} selected
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setIsCreateDialogOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim() || isCreating}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                  newGroupName.trim() && !isCreating
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-blue-400 cursor-not-allowed"
                }`}
              >
                {isCreating ? "Creating..." : "Create Group"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Browse Groups Dialog */}
      <Dialog.Root
        open={isBrowseDialogOpen}
        onOpenChange={setIsBrowseDialogOpen}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[80vh] z-50">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <Dialog.Title className="text-xl font-semibold">
                  Browse Public Groups
                </Dialog.Title>
                <button
                  onClick={() => setIsBrowseDialogOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <IoClose size={24} />
                </button>
              </div>

              <Tabs.Root
                value={browseActiveTab}
                onValueChange={setBrowseActiveTab}
              >
                <Tabs.List className="flex border-b mb-4">
                  <Tabs.Trigger
                    value="all"
                    className={`px-4 py-2 font-medium text-sm border-b-2 ${
                      browseActiveTab === "all"
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500"
                    }`}
                  >
                    Public Groups
                  </Tabs.Trigger>
                  <Tabs.Trigger
                    value="invitations"
                    className={`px-4 py-2 font-medium text-sm border-b-2 ${
                      browseActiveTab === "invitations"
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500"
                    }`}
                  >
                    Invitations ({invitations.length})
                  </Tabs.Trigger>
                </Tabs.List>

                <div className="max-h-96 overflow-y-auto">
                  <Tabs.Content value="all">
                    {isBrowseLoading ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {allGroups.map((group) => (
                          <div key={group.id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h3 className="font-medium text-lg">
                                  {group.name}
                                </h3>
                                <p className="text-gray-600 text-sm mb-2">
                                  {group.description}
                                </p>
                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                  <span>{group.member_count} members</span>
                                  <span className="capitalize">
                                    {group.privacy}
                                  </span>
                                  <span>By {group.creator_name}</span>
                                </div>
                              </div>

                              <div className="flex gap-2">
                                {!group.is_joined &&
                                  !group.is_pending &&
                                  !group.has_join_request && (
                                    <>
                                      {group.privacy === "public" ? (
                                        <button
                                          onClick={() =>
                                            handleJoinGroup(group.id)
                                          }
                                          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 flex items-center gap-2"
                                        >
                                          <FaUserPlus size={14} />
                                          Join
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() =>
                                            handleRequestJoin(group.id)
                                          }
                                          className="bg-yellow-600 text-white px-4 py-2 rounded text-sm hover:bg-yellow-700 flex items-center gap-2"
                                        >
                                          <FaUserPlus size={14} />
                                          Request Join
                                        </button>
                                      )}
                                    </>
                                  )}

                                {group.is_joined && (
                                  <span className="bg-green-100 text-green-800 px-3 py-2 rounded text-sm flex items-center gap-2">
                                    <FaUserCheck size={14} />
                                    Member
                                  </span>
                                )}

                                {group.is_pending && (
                                  <span className="bg-yellow-100 text-yellow-800 px-3 py-2 rounded text-sm flex items-center gap-2">
                                    <FaClock size={14} />
                                    Invitation Pending
                                  </span>
                                )}

                                {group.has_join_request && (
                                  <span className="bg-blue-100 text-blue-800 px-3 py-2 rounded text-sm flex items-center gap-2">
                                    <FaClock size={14} />
                                    Request Sent
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Tabs.Content>

                  <Tabs.Content value="invitations">
                    <div className="space-y-3">
                      {invitations.length > 0 ? (
                        invitations.map((invitation) => (
                          <div
                            key={invitation.id}
                            className="border rounded-lg p-4"
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex-1">
                                <h3 className="font-medium">
                                  {invitation.group_name}
                                </h3>
                                <p className="text-sm text-gray-600">
                                  Invited by {invitation.inviter_name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {new Date(
                                    invitation.created_at
                                  ).toLocaleDateString()}
                                </p>

                                {/* Feedback Message */}
                                {feedbackMessages[invitation.id] && (
                                  <div
                                    className={`mt-2 p-2 rounded-md text-xs font-medium ${
                                      feedbackMessages[invitation.id].type ===
                                      "success"
                                        ? "bg-green-100 text-green-800 border border-green-200"
                                        : "bg-red-100 text-red-800 border border-red-200"
                                    }`}
                                  >
                                    {feedbackMessages[invitation.id].message}
                                  </div>
                                )}
                              </div>

                              {/* Action Buttons - Only show if not processed and no feedback */}
                              {!processedInvitations.has(invitation.id) &&
                                !feedbackMessages[invitation.id] && (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() =>
                                        handleAcceptInvitation(invitation.id)
                                      }
                                      className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700"
                                    >
                                      Accept
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleRejectInvitation(invitation.id)
                                      }
                                      className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700"
                                    >
                                      Decline
                                    </button>
                                  </div>
                                )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          No pending invitations
                        </div>
                      )}
                    </div>
                  </Tabs.Content>
                </div>
              </Tabs.Root>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete Group Confirmation Modal */}
      <Dialog.Root open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-lg z-50 border border-red-200">
            <Dialog.Title className="text-xl font-bold mb-4 text-red-600 flex items-center gap-2">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.502 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              ⚠️ Delete Group Permanently
            </Dialog.Title>

            <div className="mb-6 space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800 font-semibold mb-1">
                  🚨 This action cannot be undone!
                </p>
                <p className="text-red-700 text-sm">
                  Permanently delete <strong>"{groupToDelete?.name}"</strong>{" "}
                  and all its content?
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-gray-700 text-sm">
                  • All messages, posts, and files will be lost
                  <br />• All members will lose access immediately
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setGroupToDelete(null);
                }}
                className="w-full px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors border border-gray-300 flex items-center justify-center gap-2"
                disabled={isDeleting}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                ✅ Cancel - Keep Group Safe
              </button>
              <button
                onClick={handleDeleteGroup}
                disabled={isDeleting}
                className={`w-full px-4 py-3 text-sm font-bold rounded-md flex items-center justify-center gap-2 transition-all duration-200 ${
                  isDeleting
                    ? "bg-red-300 text-red-100 cursor-not-allowed"
                    : "bg-red-600 hover:bg-red-700 text-white border-2 border-red-800 hover:shadow-lg"
                }`}
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Deleting Permanently...</span>
                  </>
                ) : (
                  <>
                    <FaTrash size={14} />
                    <span>🗑️ YES, DELETE "{groupToDelete?.name}" FOREVER</span>
                  </>
                )}
              </button>
            </div>

            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                🛡️ Only group creators can perform this action
              </p>
              <p className="text-xs text-red-500 font-medium">
                This deletion is immediate and irreversible
              </p>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
