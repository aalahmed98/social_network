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
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If not logged in, redirect to login
    if (!loading && !isLoggedIn) {
      router.push("/login");
    } else if (isLoggedIn) {
      // Fetch chats, followers, and following
      fetchChats();
      fetchFollowRelationships();
    }
  }, [isLoggedIn, loading, router]);

  const fetchFollowRelationships = async () => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      // Fetch followers
      const followersResponse = await fetch(`${backendUrl}/api/followers`, {
        method: "GET",
        credentials: "include",
      });

      if (followersResponse.ok) {
        const followersData = await followersResponse.json();
        setFollowers(followersData.followers || []);
      }

      // Fetch following
      const followingResponse = await fetch(`${backendUrl}/api/following`, {
        method: "GET",
        credentials: "include",
      });

      if (followingResponse.ok) {
        const followingData = await followingResponse.json();
        setFollowing(followingData.followings || []);
      }
    } catch (error) {
      console.error("Error fetching follow relationships:", error);
      setError("Failed to load contacts. Please try again later.");
    }
  };

  const fetchChats = async () => {
    setIsLoading(true);

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/conversations`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch conversations: ${response.status}`);
      }

      const data = await response.json();

      // Process conversations from the API
      const directChats: Chat[] = [];
      const groups: Chat[] = [];

      if (data.conversations && Array.isArray(data.conversations)) {
        data.conversations.forEach((conv: any) => {
          const chat: Chat = {
            id: conv.id.toString(),
            name: conv.name,
            avatar: conv.avatar,
            isGroup: conv.is_group,
            unreadCount: conv.unread_count,
          };

          // Add last message if available
          if (conv.last_message) {
            chat.lastMessage = conv.last_message.content;
            // Format timestamp
            const messageDate = new Date(conv.last_message.timestamp);
            const now = new Date();

            if (messageDate.toDateString() === now.toDateString()) {
              // Today - show time
              chat.lastMessageTime = messageDate.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
            } else {
              // Not today - show date
              chat.lastMessageTime = messageDate.toLocaleDateString([], {
                month: "short",
                day: "numeric",
              });
            }
          }

          if (conv.is_group) {
            if (conv.participants) {
              chat.members = conv.participants.map((p: any) => ({
                id: p.id,
                name: `${p.first_name} ${p.last_name}`,
                avatar: p.avatar,
              }));
            }
            groups.push(chat);
          } else {
            directChats.push(chat);
          }
        });
      }

      setChats(directChats);
      setGroupChats(groups);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      setError("Failed to load conversations. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  // Function to create a new conversation with a user
  const createConversation = async (userId: number) => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          is_group: false,
          participants: [userId],
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create conversation: ${response.status}`);
      }

      const data = await response.json();

      // Refresh conversations list
      fetchChats();

      // Return the new conversation ID
      return data.id;
    } catch (error) {
      console.error("Error creating conversation:", error);
      setError("Failed to start conversation. Please try again later.");
      return null;
    }
  };

  // Get list of available contacts (users who follow you or you follow)
  const getAvailableContacts = () => {
    // Create a map of all users in follow relationships
    const contactsMap = new Map();

    // Add followers
    followers.forEach((follower) => {
      contactsMap.set(follower.id, {
        id: follower.id,
        name: `${follower.first_name} ${follower.last_name}`,
        avatar: follower.avatar,
        relationship: "follower",
      });
    });

    // Add following
    following.forEach((followed) => {
      const existing = contactsMap.get(followed.id);
      if (existing) {
        existing.relationship = "mutual";
      } else {
        contactsMap.set(followed.id, {
          id: followed.id,
          name: `${followed.first_name} ${followed.last_name}`,
          avatar: followed.avatar,
          relationship: "following",
        });
      }
    });

    return Array.from(contactsMap.values());
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
              error={error}
              contacts={getAvailableContacts()}
              onStartNewChat={createConversation}
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
              error={error}
            />
          </Tabs.Content>
        </div>

        {/* Chat window */}
        <div className="flex-1 flex flex-col h-full">
          {selectedChat ? (
            <ChatWindow
              chat={selectedChat}
              onConversationUpdated={fetchChats}
            />
          ) : (
            <EmptyState
              title="Select a conversation"
              description="Choose a chat from the sidebar or start a new conversation"
            />
          )}
        </div>
      </Tabs.Root>
    </div>
  );
}
