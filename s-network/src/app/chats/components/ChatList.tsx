"use client";

import React, { useState } from "react";
import { Chat } from "../page";
import { ChatAvatar } from "@/components/ui/Avatar";
import { FaUsers, FaSearch } from "react-icons/fa";
import { IoSearch } from "react-icons/io5";
import { FaPlus } from "react-icons/fa";
import { getImageUrl, createAvatarFallback } from "@/utils/image";
import * as Dialog from "@radix-ui/react-dialog";

interface Contact {
  id: number;
  name: string;
  avatar?: string;
  relationship: "follower" | "following" | "mutual";
  verified?: boolean;
}

interface ChatListProps {
  chats: Chat[];
  selectedChatId: string | undefined;
  onSelectChat: (chat: Chat) => void;
  isLoading: boolean;
  error: string | null;
  contacts: Contact[];
  onStartNewChat: (userId: number) => Promise<string | null>;
  isMobile?: boolean;
  isTablet?: boolean;
  deviceType?: "phone" | "tablet" | "desktop";
}

export default function ChatList({
  chats,
  selectedChatId,
  onSelectChat,
  isLoading,
  error,
  contacts,
  onStartNewChat,
  isMobile = false,
  isTablet = false,
  deviceType = "desktop",
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
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 to-blue-50">
      {/* Enhanced Search and Actions Section - Device Responsive */}
      <div
        className={`bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-slate-200/60 ${
          deviceType === "phone"
            ? "p-3"
            : deviceType === "tablet"
            ? "p-4"
            : "p-4"
        }`}
      >
        <div className="relative mb-4">
          <input
            type="text"
            placeholder={
              deviceType === "phone" ? "Search..." : "Search conversations..."
            }
            className={`w-full pl-10 pr-4 bg-white/80 backdrop-blur-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 border border-slate-200 shadow-md transition-all duration-200 placeholder-slate-400 font-medium ${
              deviceType === "phone" ? "py-2.5 text-sm" : "py-3 text-sm"
            }`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <IoSearch
            className={`absolute text-slate-400 ${
              deviceType === "phone" ? "left-3 top-3" : "left-3 top-3.5"
            }`}
            size={deviceType === "phone" ? 16 : 18}
          />
        </div>
        <button
          className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95 ${
            deviceType === "phone" ? "py-2.5 text-xs" : "py-3 text-sm"
          }`}
          onClick={() => setShowNewChatDialog(true)}
        >
          <FaPlus size={deviceType === "phone" ? 12 : 14} />
          <span>
            {deviceType === "phone" ? "New Chat" : "New Conversation"}
          </span>
        </button>
      </div>

      {/* Modern Chat List */}
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
              <p className="text-slate-500 font-medium">
                Loading conversations...
              </p>
            </div>
          </div>
        ) : filteredChats.length > 0 ? (
          <div className={`${deviceType === "phone" ? "p-1" : "p-2"}`}>
            {filteredChats.map((chat) => (
              <div
                key={chat.id}
                className={`flex items-start rounded-2xl transition-all duration-200 cursor-pointer group mb-2 border touch-manipulation ${
                  deviceType === "phone" ? "p-3" : "p-4"
                } ${
                  selectedChatId === chat.id
                    ? "bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200 shadow-md"
                    : "bg-white/60 backdrop-blur-sm hover:bg-white/80 border-slate-200/60 hover:shadow-lg hover:border-blue-200 active:bg-white/90"
                }`}
                onClick={() => onSelectChat(chat)}
              >
                <div className="relative">
                  <ChatAvatar
                    avatar={chat.avatar}
                    fullName={chat.name}
                    size={deviceType === "phone" ? "sm" : "md"}
                    className="shadow-lg ring-2 ring-white"
                    fallbackIcon={
                      chat.isGroup ? (
                        <FaUsers size={deviceType === "phone" ? 14 : 16} />
                      ) : undefined
                    }
                  />
                </div>

                <div className="ml-3 flex-1 overflow-hidden min-w-0">
                  <div className="flex justify-between items-baseline">
                    <h3
                      className={`font-bold text-slate-800 truncate ${
                        deviceType === "phone" ? "text-sm" : "text-base"
                      }`}
                    >
                      {chat.name}
                    </h3>
                    <span className="text-xs text-slate-500 font-medium flex-shrink-0 ml-2">
                      {chat.lastMessageTime}
                    </span>
                  </div>
                  <p
                    className={`text-slate-600 truncate leading-relaxed ${
                      deviceType === "phone" ? "text-xs" : "text-sm"
                    }`}
                  >
                    {chat.lastMessage || "Start a conversation..."}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full mx-4">
            <div className="text-center p-8 bg-white/60 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-lg">
              <div className="text-6xl mb-4">💬</div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">
                {searchQuery
                  ? "No conversations found"
                  : "No conversations yet"}
              </h3>
              <p className="text-slate-500 mb-4">
                {searchQuery
                  ? `No conversations match "${searchQuery}"`
                  : "Start chatting with your friends and followers!"}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowNewChatDialog(true)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl text-sm font-medium shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                >
                  Start New Chat
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modern New Conversation Dialog */}
      <Dialog.Root open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
          <Dialog.Content
            className={`fixed z-50 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/60 ${
              deviceType === "phone"
                ? "inset-4 p-4 max-h-[calc(100vh-2rem)]"
                : deviceType === "tablet"
                ? "top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-sm p-5 max-h-[80vh]"
                : "top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-6 max-h-[80vh]"
            }`}
          >
            <Dialog.Title
              className={`font-bold mb-6 text-slate-800 flex items-center gap-2 ${
                deviceType === "phone" ? "text-lg" : "text-xl"
              }`}
            >
              <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
              Start New Conversation
            </Dialog.Title>

            <div className="mb-6">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search for contacts..."
                  className="w-full pl-10 pr-4 py-3 bg-white/80 backdrop-blur-sm rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 border border-slate-200 shadow-md transition-all duration-200 placeholder-slate-400 font-medium"
                  value={contactsSearchQuery}
                  onChange={(e) => setContactsSearchQuery(e.target.value)}
                />
                <IoSearch
                  className="absolute left-3 top-3.5 text-slate-400"
                  size={18}
                />
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200/60 bg-gradient-to-b from-slate-50 to-blue-50">
              {contacts.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <div className="text-4xl mb-3">👥</div>
                  <h3 className="font-semibold text-slate-700 mb-2">
                    No contacts available
                  </h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    Follow users or have followers to start conversations with
                    them.
                  </p>
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <div className="text-4xl mb-3">🔍</div>
                  <h3 className="font-semibold text-slate-700 mb-2">
                    No contacts found
                  </h3>
                  <p className="text-slate-500 text-sm">
                    No contacts match "{contactsSearchQuery}"
                  </p>
                </div>
              ) : (
                <div className="p-2">
                  {filteredContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center p-3 hover:bg-white/80 rounded-xl cursor-pointer transition-all duration-200 group mb-1 border border-transparent hover:border-blue-200 hover:shadow-md"
                      onClick={() =>
                        !isCreatingChat && handleStartChat(contact)
                      }
                    >
                      <div className="relative">
                        <ChatAvatar
                          avatar={contact.avatar}
                          fullName={contact.name}
                          size="md"
                          className="shadow-lg ring-2 ring-white"
                        />
                      </div>

                      <div className="ml-3 flex-1">
                        <div className="font-bold text-slate-800">
                          {contact.name}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <div
                            className={`h-1.5 w-1.5 rounded-full ${
                              contact.relationship === "mutual"
                                ? "bg-green-500"
                                : contact.relationship === "follower"
                                ? "bg-blue-500"
                                : "bg-purple-500"
                            }`}
                          ></div>
                          <span className="text-xs text-slate-600 font-medium">
                            {contact.relationship === "mutual"
                              ? "Mutual connection"
                              : contact.relationship === "follower"
                              ? "Follows you"
                              : "You follow them"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isCreatingChat && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center rounded-xl">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-200 border-t-blue-600 mx-auto mb-3"></div>
                    <p className="text-slate-600 font-medium">
                      Starting conversation...
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowNewChatDialog(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
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
