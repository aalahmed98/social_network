"use client";

import { useState } from "react";
import { Chat } from "../page";
import { IoSearch } from "react-icons/io5";
import { FaPlus, FaUsers } from "react-icons/fa";
import * as Dialog from "@radix-ui/react-dialog";
import { createAvatarFallback } from "@/utils/image";

interface GroupChatListProps {
  groupChats: Chat[];
  selectedChatId: string | undefined;
  onSelectChat: (chat: Chat) => void;
  isLoading: boolean;
}

export default function GroupChatList({
  groupChats,
  selectedChatId,
  onSelectChat,
  isLoading,
}: GroupChatListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");

  // Filter chats based on search query
  const filteredChats = groupChats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateGroup = () => {
    // Just close the dialog for now - this will be implemented in the backend later
    setIsCreateDialogOpen(false);
    setNewGroupName("");
    setNewGroupDescription("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search and create group */}
      <div className="p-3 border-b">
        <div className="relative">
          <input
            type="text"
            placeholder="Search groups..."
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <IoSearch
            className="absolute left-3 top-2.5 text-gray-500"
            size={18}
          />
        </div>
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => setIsCreateDialogOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            <FaPlus size={12} />
            <span>Create Group</span>
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors">
            <FaUsers size={12} />
            <span>Browse Groups</span>
          </button>
        </div>
      </div>

      {/* Group list */}
      <div className="overflow-y-auto flex-1">
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
          </div>
        ) : filteredChats.length > 0 ? (
          filteredChats.map((chat) => (
            <div
              key={chat.id}
              className={`flex items-start p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                selectedChatId === chat.id ? "bg-blue-50" : ""
              }`}
              onClick={() => onSelectChat(chat)}
            >
              <div className="relative">
                <div className="h-10 w-10 rounded-full bg-indigo-100 overflow-hidden flex items-center justify-center text-indigo-700">
                  {chat.avatar ? (
                    <img
                      src={chat.avatar}
                      alt={chat.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <FaUsers size={18} />
                  )}
                </div>
                {chat.unreadCount && chat.unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {chat.unreadCount}
                  </span>
                )}
              </div>

              <div className="ml-3 flex-1 overflow-hidden">
                <div className="flex justify-between items-baseline">
                  <h3 className="font-medium text-gray-900 truncate">
                    {chat.name}
                  </h3>
                  <span className="text-xs text-gray-500">
                    {chat.lastMessageTime}
                  </span>
                </div>
                <p className="text-sm text-gray-500 truncate">
                  {chat.lastMessage || "No messages yet"}
                </p>
                <div className="mt-1 flex -space-x-2 overflow-hidden">
                  {chat.members &&
                    chat.members.slice(0, 3).map((member, index) => (
                      <div
                        key={index}
                        className="inline-block h-5 w-5 rounded-full ring-2 ring-white overflow-hidden"
                      >
                        {member.avatar ? (
                          <img
                            src={member.avatar}
                            alt={member.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full bg-gray-200 flex items-center justify-center text-xs text-gray-600">
                            {createAvatarFallback(member.name)}
                          </div>
                        )}
                      </div>
                    ))}
                  {chat.members && chat.members.length > 3 && (
                    <div className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-500 ring-2 ring-white">
                      +{chat.members.length - 3}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            {searchQuery ? "No groups found" : "No groups yet"}
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
                disabled={!newGroupName.trim()}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                  newGroupName.trim()
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
    </div>
  );
}
