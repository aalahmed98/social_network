"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { flushSync } from "react-dom";
import * as Tabs from "@radix-ui/react-tabs";
import { motion } from "framer-motion";
import { FaBars, FaTimes, FaArrowLeft } from "react-icons/fa";
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
  groupId?: number;
  members?: { 
    id: number; 
    name: string; 
    avatar?: string; 
    status?: string;
    role?: string;
    isCreator?: boolean;
  }[];
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

  // Enhanced responsive state for iPhone, iPad, and Desktop
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [deviceType, setDeviceType] = useState<"phone" | "tablet" | "desktop">(
    "desktop"
  );

  // Debouncing for conversation updates
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket for real-time chat list updates
  const chatListSocketRef = useRef<WebSocket | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    id: number | string;
    firstName: string;
    lastName: string;
  } | null>(null);

  // Enhanced device detection for optimal experience
  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      // iPhone: width < 768px
      if (width < 768) {
        setDeviceType("phone");
        setIsMobile(true);
        setIsTablet(false);
      }
      // iPad: width >= 768px && width < 1200px
      else if (width >= 768 && width < 1200) {
        setDeviceType("tablet");
        setIsMobile(false); // iPad gets different treatment
        setIsTablet(true);
      }
      // Desktop: width >= 1200px
      else {
        setDeviceType("desktop");
        setIsMobile(false);
        setIsTablet(false);
        setIsSidebarOpen(false); // Always show sidebar on desktop
      }

      // Smart sidebar behavior based on device and context
      if (width >= 1200) {
        // Desktop: sidebar always visible
        setIsSidebarOpen(false);
      } else if (width >= 768 && width < 1200) {
        // iPad: keep sidebar open if no chat selected, close if chat selected
        if (selectedChat) {
          setIsSidebarOpen(false);
        } else {
          setIsSidebarOpen(true);
        }
      }
      // iPhone: sidebar closed by default, user controls it
    };

    checkDevice();
    window.addEventListener("resize", checkDevice);
    return () => window.removeEventListener("resize", checkDevice);
  }, [selectedChat]);

  // Fetch current user information for WebSocket
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!isLoggedIn) return;

      try {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
        const response = await fetch(`${backendUrl}/api/auth/me`, {
          method: "GET",
          credentials: "include",
        });

        if (response.ok) {
          const userData = await response.json();
          console.log(
            "💬 Current user loaded for chat list:",
            userData.id,
            userData.first_name
          );
          setCurrentUser(userData);
        }
      } catch (error) {
        console.error("Error fetching current user for chat list:", error);
      }
    };

    fetchCurrentUser();
  }, [isLoggedIn]);

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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

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
        console.log("=== CONVERSATION API DEBUG ===");
        console.log(
          "Raw conversations from API:",
          JSON.stringify(data.conversations, null, 2)
        );

        data.conversations.forEach((conv: any) => {
                  if (process.env.NODE_ENV === 'development') {
          console.log(`Processing conversation ${conv.id}:`);
          console.log(`  - is_group: ${conv.is_group}`);
          console.log(`  - group_id: ${conv.group_id}`);
          console.log(`  - name: ${conv.name}`);
        }

          const chat: Chat = {
            id: conv.id.toString(),
            name: conv.name,
            avatar: conv.avatar,
            isGroup: conv.is_group,
            groupId: conv.group_id,
            unreadCount: conv.unread_count,
          };

          console.log(
            `  - Created chat object:`,
            JSON.stringify(chat, null, 2)
          );

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
                status: p.status || "member",
                role: p.role || "member",
                isCreator: p.is_creator || false,
              }));
            }
            console.log(`  - Adding to groups with groupId: ${chat.groupId}`);
            groups.push(chat);
          } else {
            directChats.push(chat);
          }
        });

        if (process.env.NODE_ENV === 'development') {
          console.log("=== FINAL GROUPS ARRAY ===");
          console.log("Groups:", JSON.stringify(groups, null, 2));
          console.log("==============================");
        }
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

  // Smart conversation update function - updates specific conversation without full reload
  const updateConversationInList = (
    conversationId: string,
    updates: Partial<Chat>
  ) => {
    const updateChatsList = (chatsList: Chat[]) =>
      chatsList.map((chat) =>
        chat.id === conversationId ? { ...chat, ...updates } : chat
      );

    // Update in both direct chats and group chats
    setChats((prev) => updateChatsList(prev));
    setGroupChats((prev) => updateChatsList(prev));
  };

  // Optimized conversation updated function - no more full reloads!
  const handleConversationUpdated = async (lastMessage?: string) => {
    // Debounce rapid updates to prevent flashing
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(() => {
      // Just update timestamp and message of selected chat without full reload
      if (selectedChat) {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

        const updates: Partial<Chat> = {
          lastMessageTime: timeString,
        };

        // If a message is provided, update the last message
        if (lastMessage) {
          updates.lastMessage = lastMessage;
        }

        updateConversationInList(selectedChat.id, updates);
      }
    }, 100); // 100ms debounce to batch rapid updates
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

      // Only do full refresh for new conversations
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

  // Handle chat selection with enhanced device-specific behavior
  const handleChatSelect = (chat: Chat) => {
    setSelectedChat(chat);

    // Device-specific sidebar behavior
    if (deviceType === "phone") {
      // iPhone: Always close sidebar when chat selected
      setIsSidebarOpen(false);
    } else if (deviceType === "tablet") {
      // iPad: Close sidebar in portrait, keep open in landscape if space allows
      const width = window.innerWidth;
      if (width < 900) {
        setIsSidebarOpen(false); // Close in portrait mode
      }
      // In landscape (width >= 900), sidebar can stay open
    }
    // Desktop: No change needed
  };

  // WebSocket for real-time chat list updates
  useEffect(() => {
    if (!isLoggedIn || !currentUser) {
      // Clean up existing socket if logged out
      if (chatListSocketRef.current) {
        if (process.env.NODE_ENV === 'development') {
          console.log("💬 Cleaning up chat list WebSocket connection");
        }
        chatListSocketRef.current.close();
        chatListSocketRef.current = null;
      }
      return;
    }

    console.log("💬 Setting up chat list WebSocket for user:", currentUser.id);

    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${backendUrl.replace(
      /^https?:\/\//,
      ""
    )}/ws/chat`;

    console.log("💬 Connecting chat list to WebSocket:", wsUrl);

    const socket = new WebSocket(wsUrl);
    chatListSocketRef.current = socket;

    socket.onopen = () => {
      console.log("💬 Chat list WebSocket connection established");

      // Register for global chat updates
      if (socket.readyState === WebSocket.OPEN) {
        const registrationMessage = {
          type: "register_global",
          user_id: currentUser.id,
        };
        console.log(
          "💬 Sending chat list global registration:",
          registrationMessage
        );
        socket.send(JSON.stringify(registrationMessage));
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("💬 Received chat list message:", data);

        // Handle registration confirmation
        if (data.type === "registered_global") {
          console.log(
            "✅ Chat list global registration confirmed for user:",
            data.user_id
          );
          return;
        }

        // Handle connection confirmation
        if (data.type === "connected") {
          console.log(
            "✅ Chat list WebSocket connection established:",
            data.status
          );
          return;
        }

        // Handle new messages - update the chat list
        if (data.type === "chat_message") {
          console.log(
            "💬 Received message for chat list update:",
            data.conversation_id
          );

          // Update the conversation in the list with new message info
          const conversationId = data.conversation_id?.toString();
          if (conversationId) {
            const messageDate = new Date();
            const timeString = messageDate.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            const updates: Partial<Chat> = {
              lastMessage: data.content,
              lastMessageTime: timeString,
            };

            // Update the conversation in both lists
            flushSync(() => {
              updateConversationInList(conversationId, updates);
            });
          }
        }

        // Handle new conversation creation
        if (data.type === "conversation_created") {
          console.log("💬 New conversation created:", data);

          // Refresh the chat list to include the new conversation
          setTimeout(() => {
            fetchChats();
          }, 500); // Small delay to ensure backend has processed the conversation
        }
      } catch (error) {
        console.error("Error parsing chat list message:", error);
      }
    };

    socket.onerror = (error) => {
      console.error("💬 Chat list WebSocket error:", error);
    };

    socket.onclose = (event) => {
      console.log(
        "💬 Chat list WebSocket connection closed, clean:",
        event.wasClean,
        "code:",
        event.code
      );
      chatListSocketRef.current = null;

      // Attempt to reconnect after 3 seconds if not a clean close
      if (!event.wasClean && isLoggedIn && currentUser) {
        setTimeout(() => {
          console.log("💬 Attempting to reconnect chat list WebSocket");
          // Trigger reconnection by updating state
          setCurrentUser((prev) => (prev ? { ...prev } : null));
        }, 3000);
      }
    };

    // Cleanup function
    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        console.log("💬 Closing chat list WebSocket connection on cleanup");
        socket.close(1000, "Component unmounting");
      }
    };
  }, [isLoggedIn, currentUser, updateConversationInList, fetchChats]);

  return (
    <div className="flex h-[calc(100vh-70px)] bg-gradient-to-br from-slate-50 to-blue-50 relative">
      {/* Enhanced Mobile Header for iPhone and iPad */}
      {(isMobile || isTablet) && (
        <div
          className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between bg-white/95 backdrop-blur-sm border-b border-slate-200/60 shadow-sm ${
            deviceType === "phone" ? "p-3" : "p-4"
          }`}
        >
          {selectedChat ? (
            <button
              onClick={() => {
                setSelectedChat(null);
                // Open sidebar on mobile when going back to chat list
                if (deviceType === "phone") {
                  setIsSidebarOpen(true);
                }
              }}
              className={`rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                deviceType === "phone" ? "p-2.5" : "p-3"
              }`}
            >
              <FaArrowLeft size={deviceType === "phone" ? 16 : 18} />
            </button>
          ) : (
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`rounded-xl bg-blue-500 hover:bg-blue-600 text-white shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                deviceType === "phone" ? "p-2.5" : "p-3"
              }`}
            >
              {isSidebarOpen ? (
                <FaTimes size={deviceType === "phone" ? 16 : 18} />
              ) : (
                <FaBars size={deviceType === "phone" ? 16 : 18} />
              )}
            </button>
          )}

          {selectedChat && (
            <div className="flex items-center gap-3 flex-1 ml-4 min-w-0">
              <div
                className={`font-semibold text-slate-800 truncate ${
                  deviceType === "phone" ? "text-sm" : "text-base"
                }`}
              >
                {selectedChat.name}
              </div>
              {selectedChat.isGroup && (
                <span
                  className={`bg-blue-100 text-blue-600 px-2 py-1 rounded-full font-medium flex-shrink-0 ${
                    deviceType === "phone" ? "text-xs" : "text-sm"
                  }`}
                >
                  Group
                </span>
              )}
            </div>
          )}

          {/* iPad: Show sidebar toggle hint when no chat selected */}
          {isTablet && !selectedChat && (
            <div className="text-slate-600 text-sm font-medium">
              Choose a conversation
            </div>
          )}
        </div>
      )}

      {/* Enhanced Sidebar Overlay */}
      {(isMobile || isTablet) && isSidebarOpen && (
        <div
          className={`fixed inset-0 z-40 transition-opacity duration-300 ${
            deviceType === "phone" ? "bg-black/60" : "bg-black/40"
          }`}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Modern Sidebar Navigation */}
      <Tabs.Root
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col lg:flex-row w-full h-full"
      >
        <div
          className={`
          ${
            deviceType === "phone"
              ? `fixed top-0 left-0 h-full w-[85vw] max-w-xs z-50 transform transition-transform duration-300 ease-in-out ${
                  isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                }`
              : deviceType === "tablet"
              ? `fixed top-0 left-0 h-full z-50 transform transition-transform duration-300 ease-in-out ${
                  window.innerWidth < 900
                    ? `w-[70vw] max-w-sm ${
                        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                      }`
                    : `w-96 ${
                        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                      }`
                }`
              : "w-full md:w-80 lg:w-96 xl:w-80" // Desktop - responsive sidebar width
          } 
          bg-white/95 backdrop-blur-sm border-r border-slate-200/60 shadow-xl
          ${isMobile || isTablet ? "pt-16" : ""}
        `}
        >
          <Tabs.List className="flex w-full bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-slate-200/60">
            <Tabs.Trigger
              value="direct"
              className={`flex-1 py-4 font-semibold text-sm transition-all duration-200 border-b-2 focus:outline-none ${
                activeTab === "direct"
                  ? "border-blue-500 text-blue-600 bg-white/80 shadow-sm"
                  : "border-transparent text-slate-600 hover:text-slate-800 hover:bg-white/50"
              }`}
            >
              💬 Direct Messages
            </Tabs.Trigger>
            <Tabs.Trigger
              value="groups"
              className={`flex-1 py-4 font-semibold text-sm transition-all duration-200 border-b-2 focus:outline-none ${
                activeTab === "groups"
                  ? "border-blue-500 text-blue-600 bg-white/80 shadow-sm"
                  : "border-transparent text-slate-600 hover:text-slate-800 hover:bg-white/50"
              }`}
            >
              👥 Group Chats
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content
            value="direct"
            className="h-[calc(100%-53px)] overflow-hidden"
          >
            <ChatList
              chats={chats}
              selectedChatId={selectedChat?.id}
              onSelectChat={handleChatSelect}
              isLoading={isLoading}
              error={error}
              contacts={getAvailableContacts()}
              onStartNewChat={createConversation}
              isMobile={isMobile}
              isTablet={isTablet}
              deviceType={deviceType}
            />
          </Tabs.Content>

          <Tabs.Content
            value="groups"
            className="h-[calc(100%-53px)] overflow-hidden"
          >
            <GroupChatList
              groupChats={groupChats}
              selectedChatId={selectedChat?.id}
              onSelectChat={handleChatSelect}
              isLoading={isLoading}
              error={error}
              onGroupCreated={fetchChats}
              isMobile={isMobile}
              isTablet={isTablet}
              deviceType={deviceType}
            />
          </Tabs.Content>
        </div>

        {/* Chat window - Enhanced Responsive Layout */}
        <div
          className={`
          flex-1 flex flex-col h-full
          ${
            deviceType === "phone"
              ? selectedChat
                ? "block"
                : "hidden"
              : "block"
          }
          ${(isMobile || isTablet) && selectedChat ? "pt-16" : ""}
          ${
            deviceType === "tablet" && isSidebarOpen && window.innerWidth >= 900
              ? "ml-96"
              : ""
          }
        `}
        >
          {selectedChat ? (
            <motion.div
              initial={
                deviceType === "phone"
                  ? { opacity: 0, x: 20 }
                  : deviceType === "tablet"
                  ? { opacity: 0, scale: 0.95 }
                  : false
              }
              animate={
                deviceType === "phone"
                  ? { opacity: 1, x: 0 }
                  : deviceType === "tablet"
                  ? { opacity: 1, scale: 1 }
                  : false
              }
              transition={{
                duration: deviceType === "phone" ? 0.3 : 0.2,
                ease: "easeOut",
              }}
              className="h-full"
            >
              <ChatWindow
                chat={selectedChat}
                onConversationUpdated={handleConversationUpdated}
                isMobile={isMobile}
                isTablet={isTablet}
                deviceType={deviceType}
                onBackClick={() => setSelectedChat(null)}
              />
            </motion.div>
          ) : (
            <EmptyState
              title={
                deviceType === "phone"
                  ? "Welcome to Chat"
                  : deviceType === "tablet"
                  ? "Select a Conversation"
                  : "Select a conversation"
              }
              description={
                deviceType === "phone"
                  ? "Tap the menu button to view your conversations"
                  : deviceType === "tablet"
                  ? "Choose a chat from the sidebar to start messaging"
                  : "Choose a chat from the sidebar or start a new conversation"
              }
            />
          )}
        </div>
      </Tabs.Root>
    </div>
  );
}
