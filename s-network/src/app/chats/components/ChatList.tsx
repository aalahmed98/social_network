"use client";

import { useState } from "react";
import { Chat } from "../page";
import { IoSearch } from "react-icons/io5";
import { FaPlus, FaUser } from "react-icons/fa";
import { createAvatarFallback } from "@/utils/image";
import * as Dialog from "@radix-ui/react-dialog";

interface Contact {
  id: number;
  name: string;
  avatar?: string;
  relationship: "follower" | "following" | "mutual";
}

interface ChatListProps {
  chats: Chat[];
  selectedChatId: string | undefined;
  onSelectChat: (chat: Chat) => void;
  isLoading: boolean;
  error: string | null;
  contacts: Contact[];
  onStartNewChat: (userId: number) => Promise<string | null>;
}

export default function ChatList({
  chats,
  selectedChatId,
  onSelectChat,
  isLoading,
  error,
  contacts,
  onStartNewChat,
}: ChatListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [contactsSearchQuery, setContactsSearchQuery] = useState("");
  const [isCreatingChat, setIsCreatingChat] = useState(false);

  // Filter chats based on search query
  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter contacts based on search query
  const filteredContacts = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(contactsSearchQuery.toLowerCase())
  );

  const handleStartChat = async (contact: Contact) => {
    setIsCreatingChat(true);
    try {
      const conversationId = await onStartNewChat(contact.id);
      if (conversationId) {
        setShowNewChatDialog(false);
      }
    } finally {
      setIsCreatingChat(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search and new chat */}
      <div className="p-3 border-b">
        <div className="relative">
          <input
            type="text"
            placeholder="Search conversations..."
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <IoSearch
            className="absolute left-3 top-2.5 text-gray-500"
            size={18}
          />
        </div>
        <button
          className="mt-2 w-full flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          onClick={() => setShowNewChatDialog(true)}
        >
          <FaPlus size={12} />
          <span>New Conversation</span>
        </button>
      </div>

      {/* Chat list */}
      <div className="overflow-y-auto flex-1">
        {error ? (
          <div className="text-center py-8 text-red-500 px-4">{error}</div>
        ) : isLoading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
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
                <div className="h-10 w-10 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-gray-700 font-semibold text-lg">
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
                    createAvatarFallback(chat.name)
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
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            {searchQuery ? "No conversations found" : "No conversations yet"}
          </div>
        )}
      </div>

      {/* New Conversation Dialog */}
      <Dialog.Root open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 w-full max-w-md z-50">
            <Dialog.Title className="text-xl font-semibold mb-4">
              Start New Conversation
            </Dialog.Title>

            <div className="mb-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search for contacts..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={contactsSearchQuery}
                  onChange={(e) => setContactsSearchQuery(e.target.value)}
                />
                <IoSearch
                  className="absolute left-3 top-2.5 text-gray-500"
                  size={18}
                />
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {contacts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FaUser size={32} className="mx-auto mb-2 text-gray-400" />
                  <p>
                    You need to follow users or have followers to start
                    conversations
                  </p>
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No contacts found matching "{contactsSearchQuery}"
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                    onClick={() => !isCreatingChat && handleStartChat(contact)}
                  >
                    <div className="h-10 w-10 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-gray-700 font-semibold text-lg">
                      {contact.avatar ? (
                        <img
                          src={
                            contact.avatar.startsWith("http")
                              ? contact.avatar
                              : `${
                                  process.env.NEXT_PUBLIC_BACKEND_URL ||
                                  "http://localhost:8080"
                                }${contact.avatar}`
                          }
                          alt={contact.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        createAvatarFallback(contact.name)
                      )}
                    </div>
                    <div className="ml-3 flex-1">
                      <div className="font-medium text-gray-900">
                        {contact.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {contact.relationship === "mutual"
                          ? "You follow each other"
                          : contact.relationship === "follower"
                          ? "Follows you"
                          : "You follow them"}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {isCreatingChat && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowNewChatDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancel
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
