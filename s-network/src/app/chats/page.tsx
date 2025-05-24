"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import * as Tabs from "@radix-ui/react-tabs";
import { motion } from "framer-motion";
import ChatList from "./components/ChatList.tsx";
import ChatWindow from "./components/ChatWindow.tsx";
import GroupChatList from "./components/GroupChatList.tsx";
import EmptyState from "./components/EmptyState.tsx";

// Chat types
export interface Chat {
  id: string;
  name: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  avatar?: string;
  isGroup?: boolean;
  members?: { id: number; name: string; avatar?: string }[];
}

export default function ChatPage() {
  const router = useRouter();
  const { isLoggedIn, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("direct");
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [groupChats, setGroupChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // If not logged in, redirect to login
    if (!loading && !isLoggedIn) {
      router.push("/login");
    } else if (isLoggedIn) {
      // Fetch chats
      fetchChats();
    }
  }, [isLoggedIn, loading, router]);

  const fetchChats = async () => {
    setIsLoading(true);
    // This is just mock data for now - will be replaced with actual API calls
    setTimeout(() => {
      // Mock direct message chats
      setChats([
        {
          id: "1",
          name: "John Doe",
          lastMessage: "Hey, how are you?",
          lastMessageTime: "10:30 AM",
          unreadCount: 2,
          avatar: "/uploads/avatars/default.png",
        },
        {
          id: "2",
          name: "Jane Smith",
          lastMessage: "Did you see the new post?",
          lastMessageTime: "Yesterday",
          avatar: "/uploads/avatars/default.png",
        },
      ]);

      // Mock group chats
      setGroupChats([
        {
          id: "g1",
          name: "Web Development",
          lastMessage: "Alice: Let's meet tomorrow",
          lastMessageTime: "2:45 PM",
          unreadCount: 5,
          isGroup: true,
          members: [
            { id: 1, name: "Alice", avatar: "/uploads/avatars/default.png" },
            { id: 2, name: "Bob", avatar: "/uploads/avatars/default.png" },
            { id: 3, name: "Charlie", avatar: "/uploads/avatars/default.png" },
          ],
        },
        {
          id: "g2",
          name: "Weekend Hiking",
          lastMessage: "Bob: I'll bring snacks",
          lastMessageTime: "Yesterday",
          isGroup: true,
          members: [
            { id: 1, name: "Alice", avatar: "/uploads/avatars/default.png" },
            { id: 2, name: "Bob", avatar: "/uploads/avatars/default.png" },
          ],
        },
      ]);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="flex h-[calc(100vh-70px)] bg-gray-50">
      {/* Sidebar navigation */}
      <Tabs.Root
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col md:flex-row w-full h-full"
      >
        <div className="w-full md:w-80 bg-white border-r shadow-sm">
          <Tabs.List className="flex w-full border-b">
            <Tabs.Trigger
              value="direct"
              className={`flex-1 py-4 font-medium text-sm transition-colors border-b-2 focus:outline-none ${
                activeTab === "direct"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Direct Messages
            </Tabs.Trigger>
            <Tabs.Trigger
              value="groups"
              className={`flex-1 py-4 font-medium text-sm transition-colors border-b-2 focus:outline-none ${
                activeTab === "groups"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Group Chats
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content
            value="direct"
            className="h-[calc(100%-53px)] overflow-hidden"
          >
            <ChatList
              chats={chats}
              selectedChatId={selectedChat?.id}
              onSelectChat={setSelectedChat}
              isLoading={isLoading}
            />
          </Tabs.Content>

          <Tabs.Content
            value="groups"
            className="h-[calc(100%-53px)] overflow-hidden"
          >
            <GroupChatList
              groupChats={groupChats}
              selectedChatId={selectedChat?.id}
              onSelectChat={setSelectedChat}
              isLoading={isLoading}
            />
          </Tabs.Content>
        </div>

        {/* Chat window */}
        <div className="flex-1 flex flex-col h-full">
          {selectedChat ? (
            <ChatWindow chat={selectedChat} />
          ) : (
            <EmptyState
              title="Select a conversation"
              description="Choose a chat from the sidebar to start messaging"
            />
          )}
        </div>
      </Tabs.Root>
    </div>
  );
}
