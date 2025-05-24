"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { IoSearch, IoNotifications } from "react-icons/io5";
import { FaUsers, FaPlus, FaUserPlus } from "react-icons/fa";
import * as Dialog from "@radix-ui/react-dialog";

interface Group {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  avatar?: string;
  isJoined?: boolean;
  isPending?: boolean;
  createdAt: string;
}

export default function GroupsPage() {
  const router = useRouter();
  const { isLoggedIn, loading } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: "",
    description: "",
  });
  const [showInvitationDialog, setShowInvitationDialog] = useState(false);
  const [inviteGroupId, setInviteGroupId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  useEffect(() => {
    // If not logged in, redirect to login
    if (!loading && !isLoggedIn) {
      router.push("/login");
    } else if (isLoggedIn) {
      // Fetch groups
      fetchGroups();
    }
  }, [isLoggedIn, loading, router]);

  // Filter groups based on search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredGroups(groups);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredGroups(
        groups.filter(
          (group) =>
            group.name.toLowerCase().includes(query) ||
            group.description.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, groups]);

  const fetchGroups = async () => {
    setIsLoading(true);
    // Mock data for now - would be replaced with actual API call
    setTimeout(() => {
      const mockGroups: Group[] = [
        {
          id: "1",
          name: "Web Development",
          description:
            "A group for web developers to share ideas and collaborate on projects.",
          memberCount: 24,
          createdAt: "2023-01-15",
          isJoined: true,
        },
        {
          id: "2",
          name: "Mobile App Developers",
          description:
            "Discussion about mobile app development for iOS and Android.",
          memberCount: 42,
          createdAt: "2023-02-20",
        },
        {
          id: "3",
          name: "AI Enthusiasts",
          description:
            "Exploring artificial intelligence, machine learning, and data science.",
          memberCount: 56,
          createdAt: "2023-03-05",
          isPending: true,
        },
        {
          id: "4",
          name: "UX/UI Design",
          description:
            "Share and discuss UX/UI design principles, tools, and trends.",
          memberCount: 37,
          createdAt: "2023-03-15",
        },
        {
          id: "5",
          name: "DevOps Community",
          description:
            "Everything related to DevOps, CI/CD, and infrastructure as code.",
          memberCount: 19,
          createdAt: "2023-04-01",
          isJoined: true,
        },
      ];
      setGroups(mockGroups);
      setFilteredGroups(mockGroups);
      setIsLoading(false);
    }, 1000);
  };

  const handleCreateGroup = () => {
    // Just close the dialog for now - this would normally be an API call
    setIsCreateDialogOpen(false);
    setNewGroup({ name: "", description: "" });
  };

  const handleGroupAction = (
    group: Group,
    action: "join" | "request" | "invite" | "leave"
  ) => {
    if (action === "invite") {
      setInviteGroupId(group.id);
      setShowInvitationDialog(true);
      return;
    }

    // This would normally be an API call
    const updatedGroups = groups.map((g) => {
      if (g.id === group.id) {
        if (action === "join" || action === "request") {
          return {
            ...g,
            isPending: action === "request",
            isJoined: action === "join",
          };
        } else if (action === "leave") {
          return { ...g, isJoined: false, isPending: false };
        }
      }
      return g;
    });

    setGroups(updatedGroups);
  };

  const handleInviteUser = () => {
    // This would normally be an API call
    alert(`Invited ${inviteEmail} to group!`);
    setShowInvitationDialog(false);
    setInviteEmail("");
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
          <p className="text-gray-600">Discover, join and create groups</p>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              placeholder="Search groups..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <IoSearch
              className="absolute left-3 top-2.5 text-gray-500"
              size={18}
            />
          </div>
          <button
            onClick={() => setIsCreateDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <FaPlus size={14} />
            <span>Create Group</span>
          </button>
        </div>
      </div>

      {/* Group list */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredGroups.length > 0 ? (
          <div className="divide-y">
            {filteredGroups.map((group) => (
              <div key={group.id} className="p-4 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center">
                  <div className="flex-shrink-0 mb-4 md:mb-0 md:mr-6">
                    <div className="h-16 w-16 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                      {group.avatar ? (
                        <img
                          src={group.avatar}
                          alt={group.name}
                          className="h-full w-full object-cover rounded-lg"
                        />
                      ) : (
                        <FaUsers size={32} />
                      )}
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {group.name}
                        </h3>
                        <p className="mt-1 text-gray-600">
                          {group.description}
                        </p>
                        <div className="mt-2 flex items-center text-sm text-gray-500">
                          <span className="mr-4">
                            {group.memberCount} members
                          </span>
                          <span>
                            Created{" "}
                            {new Date(group.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 md:mt-0 flex flex-wrap gap-2">
                        {group.isJoined ? (
                          <>
                            <button
                              onClick={() =>
                                router.push(`/chats?group=${group.id}`)
                              }
                              className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 transition-colors"
                            >
                              Chat
                            </button>
                            <button
                              onClick={() => handleGroupAction(group, "invite")}
                              className="px-4 py-2 bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors"
                            >
                              <FaUserPlus className="inline mr-1" size={14} />
                              Invite
                            </button>
                            <button
                              onClick={() => handleGroupAction(group, "leave")}
                              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                            >
                              Leave
                            </button>
                          </>
                        ) : group.isPending ? (
                          <button
                            disabled
                            className="px-4 py-2 bg-yellow-50 text-yellow-600 rounded-md cursor-not-allowed"
                          >
                            Request Pending
                          </button>
                        ) : (
                          <button
                            onClick={() => handleGroupAction(group, "request")}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                          >
                            Request to Join
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-4">
              <FaUsers size={40} />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              No groups found
            </h3>
            <p className="text-gray-500">
              {searchQuery
                ? `No groups match "${searchQuery}"`
                : "Try creating a new group or adjusting your search"}
            </p>
          </div>
        )}
      </div>

      {/* Create Group Dialog */}
      <Dialog.Root
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 w-full max-w-md z-50">
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
                  value={newGroup.name}
                  onChange={(e) =>
                    setNewGroup({ ...newGroup, name: e.target.value })
                  }
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
                  value={newGroup.description}
                  onChange={(e) =>
                    setNewGroup({ ...newGroup, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter group description"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setIsCreateDialogOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={!newGroup.name.trim()}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                  newGroup.name.trim()
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-blue-400 cursor-not-allowed"
                }`}
              >
                Create Group
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Invite User Dialog */}
      <Dialog.Root
        open={showInvitationDialog}
        onOpenChange={setShowInvitationDialog}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 w-full max-w-md z-50">
            <Dialog.Title className="text-xl font-semibold mb-4">
              Invite User to Group
            </Dialog.Title>

            <div>
              <label
                htmlFor="inviteEmail"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email Address
              </label>
              <input
                id="inviteEmail"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter email address"
              />
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowInvitationDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleInviteUser}
                disabled={!inviteEmail.includes("@")}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                  inviteEmail.includes("@")
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-blue-400 cursor-not-allowed"
                }`}
              >
                Send Invitation
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
