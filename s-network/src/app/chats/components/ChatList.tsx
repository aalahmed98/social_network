"use client";

import { useState } from "react";
import { Chat } from "../page";
import { IoSearch } from "react-icons/io5";
import { FaPlus } from "react-icons/fa";
import { createAvatarFallback } from "@/utils/image";

interface ChatListProps {
  chats: Chat[];
  selectedChatId: string | undefined;
  onSelectChat: (chat: Chat) => void;
  isLoading: boolean;
}

export default function ChatList({
  chats,
  selectedChatId,
  onSelectChat,
  isLoading,
}: ChatListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter chats based on search query
  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <button className="mt-2 w-full flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
          <FaPlus size={12} />
          <span>New Conversation</span>
        </button>
      </div>

      {/* Chat list */}
      <div className="overflow-y-auto flex-1">
        {isLoading ? (
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
                      src={chat.avatar}
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
    </div>
  );
}
