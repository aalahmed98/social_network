"use client";

import { useState, useRef, useEffect } from "react";
import { Chat } from "../page";
import { IoSend, IoInformationCircle, IoAddCircle } from "react-icons/io5";
import {
  FaSmile,
  FaUsers,
  FaCalendarAlt,
  FaTimes,
  FaUserPlus,
  FaTrash,
} from "react-icons/fa";
import { getImageUrl, createAvatarFallback } from "@/utils/image";
import * as Dialog from "@radix-ui/react-dialog";
import { useAuth } from "@/context/AuthContext";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

interface Message {
  id: string;
  senderId: string | number;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: string;
  timestampRaw?: string;
  isMe: boolean;
  type?: "message" | "post" | "event"; // Add message types
  postData?: {
    imagePath?: string;
    likesCount?: number;
    commentsCount?: number;
    isLiked?: boolean;
    upvotes?: number;
    downvotes?: number;
    userVote?: number;
  };
  eventData?: {
    title?: string;
    description?: string;
    eventDate?: string;
    goingCount?: number;
    notGoingCount?: number;
    userResponse?: string;
  };
}

interface ChatWindowProps {
  chat: Chat;
  onConversationUpdated: () => Promise<void>;
}

export default function ChatWindow({
  chat,
  onConversationUpdated,
}: ChatWindowProps) {
  const { isLoggedIn } = useAuth();
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showEventsPanel, setShowEventsPanel] = useState(chat.isGroup || false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
  });
  const [newPost, setNewPost] = useState({
    content: "",
    image: null as File | null,
  });
  const [groupEvents, setGroupEvents] = useState<any[]>([]);
  const [groupPosts, setGroupPosts] = useState<any[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [groupInfo, setGroupInfo] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [followingUsers, setFollowingUsers] = useState<any[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [isLoadingFollowing, setIsLoadingFollowing] = useState(false);
  const [isAddingMembers, setIsAddingMembers] = useState(false);

  // Group post interactions
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [postComments, setPostComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Fetch current user information
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
          setCurrentUser(userData);
          console.log("Current user fetched:", userData);
        }
      } catch (error) {
        console.error("Error fetching current user:", error);
      }
    };

    fetchCurrentUser();
  }, [isLoggedIn]);

  // WebSocket connection
  useEffect(() => {
    // Close any existing socket connection
    if (socket) {
      socket.close();
    }

    // Don't attempt to connect if not authenticated
    if (!currentUser) {
      console.log("⏸️ Skipping WebSocket connection - no current user");
      return;
    }

    console.log("👤 Current user for WebSocket:", {
      id: currentUser.id,
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
    });

    let wsConnected = false;
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${backendUrl.replace(
      /^https?:\/\//,
      ""
    )}/ws/chat`;

    console.log("🔌 Attempting WebSocket connection to:", wsUrl);
    console.log("🌐 Current location:", window.location.href);
    console.log("🔒 Protocol:", window.location.protocol);

    // Test server connectivity first
    const testServerConnectivity = async () => {
      try {
        const testResponse = await fetch(`${backendUrl}/health`, {
          credentials: "include",
        });
        console.log(
          "🏥 Server health check:",
          testResponse.ok ? "✅ OK" : "❌ Failed"
        );
      } catch (error) {
        console.error("🏥 Server health check failed:", error);
      }
    };

    testServerConnectivity();

    const newSocket = new WebSocket(wsUrl);

    const connectionTimeout = setTimeout(() => {
      if (!wsConnected) {
        console.log("⏰ WebSocket connection timeout, closing socket");
        newSocket.close();
        setError("WebSocket connection timeout. Using polling instead.");
      }
    }, 5000); // 5 second timeout

    newSocket.onopen = () => {
      console.log("✅ WebSocket connection established");
      wsConnected = true;
      clearTimeout(connectionTimeout);
      setError(null);
      // Register for this conversation
      if (newSocket.readyState === WebSocket.OPEN) {
        console.log("📝 Registering for conversation:", chat.id);
        newSocket.send(
          JSON.stringify({
            type: "register",
            conversation_id: parseInt(chat.id),
          })
        );
      }
    };

    newSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("📨 Received WebSocket message:", data.type);

        // Handle different message types
        if (data.type === "registered") {
          console.log(
            "✅ Successfully registered for conversation:",
            data.conversation_id
          );
        } else if (data.type === "connected") {
          console.log("🔗 WebSocket connected:", data.status);
        } else if (
          data.type === "chat_message" &&
          data.conversation_id.toString() === chat.id
        ) {
          // Format incoming message
          const newMessage: Message = {
            id: data.id || Date.now().toString(),
            senderId: data.sender_id,
            senderName: data.sender_name || "Unknown",
            senderAvatar: data.sender_avatar,
            content: data.content,
            timestamp: formatTimestamp(
              data.timestamp || new Date().toISOString()
            ),
            timestampRaw: data.timestamp,
            isMe:
              String(data.sender_id) === String(currentUser?.id) ||
              Number(data.sender_id) === Number(currentUser?.id),
          };

          setMessages((prev) => {
            // Check for duplicates by ID and content+timestamp combination
            const isDuplicate = prev.some(
              (existingMsg) =>
                existingMsg.id === newMessage.id ||
                (existingMsg.senderId === newMessage.senderId &&
                  existingMsg.content === newMessage.content &&
                  Math.abs(
                    new Date(
                      existingMsg.timestampRaw || existingMsg.timestamp
                    ).getTime() -
                      new Date(
                        newMessage.timestampRaw || newMessage.timestamp
                      ).getTime()
                  ) < 5000) // Within 5 seconds
            );

            if (isDuplicate) {
              return prev; // Don't add duplicate
            }

            // Add new message and sort all messages by timestamp
            const allMessages = [...prev, newMessage];
            allMessages.sort((a, b) => {
              const timeA = new Date(a.timestampRaw || a.timestamp).getTime();
              const timeB = new Date(b.timestampRaw || b.timestamp).getTime();
              return timeA - timeB;
            });
            return allMessages;
          });

          // Notify parent component that there's a new message (updates conversation list)
          onConversationUpdated();
        }
      } catch (error) {
        console.error("❌ Error parsing WebSocket message:", error);
      }
    };

    newSocket.onerror = (error) => {
      console.error("❌ WebSocket error occurred:");
      console.error("- Error event:", error);
      console.error("- Socket state:", newSocket.readyState);
      console.error("- Socket URL:", wsUrl);

      setError(
        "WebSocket connection failed. Check if the server is running. Falling back to polling."
      );
      wsConnected = false;
      clearTimeout(connectionTimeout);
    };

    newSocket.onclose = (event) => {
      console.log("🔌 WebSocket connection closed");
      console.log("- Code:", event.code);
      console.log("- Reason:", event.reason);
      console.log("- Clean close:", event.wasClean);
      wsConnected = false;
      clearTimeout(connectionTimeout);

      // Show error message if connection was closed unexpectedly
      if (!event.wasClean && event.code !== 1000) {
        setError(
          `WebSocket connection lost (${event.code}). Using polling instead.`
        );
      }
    };

    setSocket(newSocket);

    // Polling fallback if WebSocket fails
    let pollingInterval: NodeJS.Timeout | null = null;

    const startPolling = () => {
      // Only start polling if WebSocket is not connected
      if (!wsConnected) {
        console.log("🔄 Starting polling fallback");
        // Poll every 3 seconds
        pollingInterval = setInterval(fetchLatestMessages, 3000);
      }
    };

    // Give WebSocket 3 seconds to connect, then start polling if needed
    const pollingTimeout = setTimeout(() => {
      if (!wsConnected) {
        console.log("⏰ WebSocket didn't connect in time, starting polling");
        startPolling();
      }
    }, 3000);

    // Cleanup function
    return () => {
      console.log("🧹 Cleaning up WebSocket connection");
      clearTimeout(connectionTimeout);
      clearTimeout(pollingTimeout);
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      if (newSocket && newSocket.readyState === WebSocket.OPEN) {
        newSocket.close(1000, "Component unmounting");
      }
    };
  }, [chat.id, currentUser]);

  // Function to fetch the latest messages
  const fetchLatestMessages = async () => {
    if (!chat.id || !currentUser) return;

    try {
      // Use the same combined function for consistency
      await fetchMessagesWithPosts();
    } catch (error) {
      console.error("Error polling messages:", error);
    }
  };

  // Function to fetch and combine messages with posts for group chats
  const fetchMessagesWithPosts = async () => {
    if (!chat.id || !currentUser) return;

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      // Fetch regular messages
      const messagesResponse = await fetch(
        `${backendUrl}/api/conversations/${chat.id}/messages`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      let allMessages: Message[] = [];

      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json();

        if (messagesData.messages && Array.isArray(messagesData.messages)) {
          const formattedMessages: Message[] = messagesData.messages.map(
            (msg: any) => {
              const isCurrentUser =
                String(msg.sender.id) === String(currentUser?.id) ||
                Number(msg.sender.id) === Number(currentUser?.id);

              return {
                id: `msg-${msg.id}`,
                senderId: msg.sender.id,
                senderName: `${msg.sender.first_name} ${msg.sender.last_name}`,
                senderAvatar: msg.sender.avatar,
                content: msg.content,
                timestamp: formatTimestamp(msg.created_at),
                timestampRaw: msg.created_at,
                isMe: isCurrentUser,
                type: "message" as const,
              };
            }
          );

          allMessages = [...formattedMessages];
        }
      }

      // If it's a group chat, also fetch posts
      if (chat.isGroup && chat.groupId) {
        const postsResponse = await fetch(
          `${backendUrl}/api/groups/${chat.groupId}/posts`,
          {
            credentials: "include",
          }
        );

        if (postsResponse.ok) {
          const postsData = await postsResponse.json();

          if (postsData.posts && Array.isArray(postsData.posts)) {
            const formattedPosts: Message[] = postsData.posts.map(
              (post: any) => {
                const isCurrentUser =
                  String(post.author_id) === String(currentUser?.id) ||
                  Number(post.author_id) === Number(currentUser?.id);

                return {
                  id: `post-${post.id}`,
                  senderId: post.author_id,
                  senderName: post.author_name,
                  senderAvatar: post.author_avatar,
                  content: post.content,
                  timestamp: formatTimestamp(post.created_at),
                  timestampRaw: post.created_at,
                  isMe: isCurrentUser,
                  type: "post" as const,
                  postData: {
                    imagePath: post.image_path,
                    likesCount: post.likes_count || 0,
                    commentsCount: post.comments_count || 0,
                    isLiked: post.is_liked || false,
                    upvotes: post.upvotes || 0,
                    downvotes: post.downvotes || 0,
                    userVote: post.user_vote || 0,
                  },
                };
              }
            );

            allMessages = [...allMessages, ...formattedPosts];
          }
        }
      }

      // Sort all messages by timestamp (oldest first)
      allMessages.sort((a, b) => {
        const timeA = new Date(a.timestampRaw || a.timestamp).getTime();
        const timeB = new Date(b.timestampRaw || b.timestamp).getTime();
        return timeA - timeB;
      });

      setMessages(allMessages);
    } catch (error) {
      console.error("Error fetching messages with posts:", error);
      setError("Failed to load messages. Please try again later.");
    }
  };

  // Load messages for the current conversation
  useEffect(() => {
    const fetchMessages = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Use the new function that combines messages and posts for group chats
        await fetchMessagesWithPosts();
      } catch (error) {
        console.error("Error fetching messages:", error);
        setError("Failed to load messages. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    if (chat.id) {
      fetchMessages();
    }
  }, [chat.id, currentUser]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);

      // Check if date is valid
      if (isNaN(date.getTime())) {
        return new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      }

      const now = new Date();

      if (date.toDateString() === now.toDateString()) {
        // Today - show time
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      } else {
        // Not today - show date and time
        return (
          date.toLocaleDateString([], {
            month: "short",
            day: "numeric",
          }) +
          " " +
          date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        );
      }
    } catch (error) {
      // Fallback to current time if parsing fails
      return new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    const messageContent = message.trim();
    setMessage("");

    console.log(
      "💬 Attempting to send message:",
      messageContent.substring(0, 50)
    );
    console.log("🔌 WebSocket state:", socket?.readyState);
    console.log("🔗 Socket available:", !!socket);

    // Try to send via WebSocket first
    if (socket && socket.readyState === WebSocket.OPEN) {
      console.log("📤 Sending via WebSocket");
      const messageData = {
        type: "chat_message",
        conversation_id: parseInt(chat.id),
        content: messageContent,
      };
      socket.send(JSON.stringify(messageData));
      console.log("✅ Message sent via WebSocket");
      // Don't add optimistic message for WebSocket - wait for server response
      return;
    }

    console.log("📤 Sending via REST API (WebSocket not available)");
    // Fallback to REST API
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(
        `${backendUrl}/api/conversations/${chat.id}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            content: messageContent,
          }),
        }
      );
      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status}`);
      }
      console.log("✅ Message sent via REST API");
      // For REST API, add optimistic message and refresh
      const tempMessage = {
        id: `temp-${Date.now()}`,
        senderId: currentUser?.id || 0,
        senderName:
          currentUser?.firstName && currentUser?.lastName
            ? `${currentUser.firstName} ${currentUser.lastName}`
            : "You",
        content: messageContent,
        timestamp: formatTimestamp(new Date().toISOString()),
        timestampRaw: new Date().toISOString(),
        isMe: true,
      };
      setMessages((prev) => {
        // Add new message and sort all messages by timestamp
        const allMessages = [...prev, tempMessage];
        allMessages.sort((a, b) => {
          const timeA = new Date(a.timestampRaw || a.timestamp).getTime();
          const timeB = new Date(b.timestampRaw || b.timestamp).getTime();
          return timeA - timeB;
        });
        return allMessages;
      });
      setTimeout(fetchLatestMessages, 500);
    } catch (error) {
      console.error("❌ Error sending message via API:", error);
      setError("Failed to send message. Please try again.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCreateEvent = async () => {
    if (!newEvent.title.trim() || !newEvent.date || !newEvent.time) return;

    // Debug logging
    console.log("=== CREATE EVENT DEBUG ===");
    console.log("chat object:", JSON.stringify(chat, null, 2));
    console.log("chat.groupId:", chat.groupId);
    console.log("chat.isGroup:", chat.isGroup);
    console.log("typeof chat.groupId:", typeof chat.groupId);
    console.log("========================");

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      // Use group ID for API call
      const groupIdForEvent = chat.groupId;
      if (!groupIdForEvent) {
        console.error("No group ID available for creating event");
        console.error("Full chat object:", chat);
        alert(
          "Error: Cannot create event. Please refresh the page and try again."
        );
        return;
      }

      const requestData = {
        title: newEvent.title.trim(),
        description: newEvent.description.trim(),
        date: newEvent.date,
        time: newEvent.time,
      };

      console.log(
        "Request URL:",
        `${backendUrl}/api/groups/${groupIdForEvent}/events`
      );
      console.log("Request data:", requestData);

      const response = await fetch(
        `${backendUrl}/api/groups/${groupIdForEvent}/events`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestData),
          credentials: "include",
        }
      );

      console.log("Response status:", response.status);
      console.log("Response headers:", [...response.headers.entries()]);

      if (response.ok) {
        setShowEventModal(false);
        setNewEvent({ title: "", description: "", date: "", time: "" });
        // Reload events to show the new one
        loadGroupEvents();

        // Send event creation notification to chat
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: "chat_message",
              conversation_id: parseInt(chat.id),
              content: `📅 Event created: "${newEvent.title}" on ${newEvent.date} at ${newEvent.time}`,
            })
          );
        }
      } else {
        const errorText = await response.text();
        console.error("Failed to create event - Status:", response.status);
        console.error("Error response:", errorText);

        let errorMessage = "Failed to create event. Please try again.";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          // If not JSON, use the raw text
          if (errorText) {
            errorMessage = errorText;
          }
        }

        alert(`Error creating event: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Error creating event:", error);
      alert(
        "Network error creating event. Please check your connection and try again."
      );
    }
  };

  const loadGroupEvents = async () => {
    if (!chat.isGroup) return;

    setIsLoadingEvents(true);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      // Use group ID for API call
      const groupIdForEvents = chat.groupId;
      if (!groupIdForEvents) {
        console.error("No group ID available for loading events");
        setIsLoadingEvents(false);
        return;
      }

      const response = await fetch(
        `${backendUrl}/api/groups/${groupIdForEvents}/events`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        setGroupEvents(data.events || []);
      }
    } catch (error) {
      console.error("Error loading group events:", error);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const loadGroupPosts = async () => {
    if (!chat.isGroup) return;

    console.log("=== LOAD GROUP POSTS DEBUG ===");
    console.log("chat.isGroup:", chat.isGroup);
    console.log("chat.groupId:", chat.groupId);
    console.log("================================");

    setIsLoadingPosts(true);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      // Use group ID for API call
      const groupIdForPosts = chat.groupId;
      if (!groupIdForPosts) {
        console.error("No group ID available for loading posts");
        setIsLoadingPosts(false);
        return;
      }

      console.log("Loading posts for group ID:", groupIdForPosts);
      console.log(
        "API URL:",
        `${backendUrl}/api/groups/${groupIdForPosts}/posts`
      );

      const response = await fetch(
        `${backendUrl}/api/groups/${groupIdForPosts}/posts`,
        {
          credentials: "include",
        }
      );

      console.log("Posts API response status:", response.status);
      console.log("Posts API response ok:", response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log("Posts API response data:", data);
        console.log("Posts count:", data.posts ? data.posts.length : 0);
        console.log("Posts data:", data.posts);

        setGroupPosts(data.posts || []);
        console.log(
          "Group posts state updated with:",
          data.posts?.length || 0,
          "posts"
        );
      } else {
        const errorText = await response.text();
        console.error("Failed to load posts:", response.status, errorText);
      }
    } catch (error) {
      console.error("Error loading group posts:", error);
    } finally {
      setIsLoadingPosts(false);
      console.log("=== LOAD GROUP POSTS END ===");
    }
  };

  const handleCreatePost = async () => {
    if (!newPost.content.trim()) return;

    // Debug logging
    console.log("=== CREATE POST DEBUG ===");
    console.log("chat object:", JSON.stringify(chat, null, 2));
    console.log("chat.groupId:", chat.groupId);
    console.log("chat.isGroup:", chat.isGroup);
    console.log("typeof chat.groupId:", typeof chat.groupId);
    console.log("=========================");

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const formData = new FormData();
      formData.append("content", newPost.content.trim());
      if (newPost.image) {
        formData.append("image", newPost.image);
      }

      // Use group ID for API call
      const groupIdForPost = chat.groupId;
      if (!groupIdForPost) {
        console.error("No group ID available for creating post");
        console.error("Full chat object:", chat);
        alert(
          "Error: Cannot create post. Please refresh the page and try again."
        );
        return;
      }

      console.log(
        "Request URL:",
        `${backendUrl}/api/groups/${groupIdForPost}/posts`
      );
      console.log("Request data - content:", newPost.content.trim());
      console.log("Request data - has image:", !!newPost.image);
      if (newPost.image) {
        console.log("Image file details:", {
          name: newPost.image.name,
          size: newPost.image.size,
          type: newPost.image.type,
        });
      }

      const response = await fetch(
        `${backendUrl}/api/groups/${groupIdForPost}/posts`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
        }
      );

      console.log("Response status:", response.status);
      console.log("Response headers:", [...response.headers.entries()]);

      if (response.ok) {
        setShowPostModal(false);
        setNewPost({ content: "", image: null });

        // Show success message
        alert("Post created successfully! 🎉");

        // Reload posts to show the new one in the sidebar
        loadGroupPosts();

        // Reload messages with posts to show the new post in the chat
        await fetchMessagesWithPosts();

        // Send post creation notification to chat
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: "chat_message",
              conversation_id: parseInt(chat.id),
              content: `📝 New group post: "${newPost.content.substring(
                0,
                50
              )}${newPost.content.length > 50 ? "..." : ""}"`,
            })
          );
        }
      } else {
        const errorText = await response.text();
        console.error("Failed to create post - Status:", response.status);
        console.error("Error response:", errorText);

        let errorMessage = "Failed to create post. Please try again.";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          // If not JSON, use the raw text
          if (errorText) {
            errorMessage = errorText;
          }
        }

        alert(`Error creating post: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Error creating post:", error);
      alert(
        "Network error creating post. Please check your connection and try again."
      );
    }
  };

  const respondToEvent = async (
    eventId: number,
    response: "going" | "not_going"
  ) => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const res = await fetch(
        `${backendUrl}/api/groups/events/${eventId}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ response }),
          credentials: "include",
        }
      );

      if (res.ok) {
        loadGroupEvents();
      }
    } catch (error) {
      console.error("Error responding to event:", error);
    }
  };

  // Load group data when chat changes
  useEffect(() => {
    if (chat.isGroup) {
      loadGroupEvents();
      loadGroupPosts();
      loadGroupInfo();
    }
  }, [chat.id, chat.isGroup]);

  const loadGroupInfo = async () => {
    if (!chat.isGroup) return;

    // Use the group ID, not the conversation ID
    const groupIdToFetch = chat.groupId;

    if (!groupIdToFetch) {
      console.error("No group ID available to fetch group info");
      return;
    }

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      console.log(`Loading group info for group ID: ${groupIdToFetch}`);
      const response = await fetch(
        `${backendUrl}/api/groups/${groupIdToFetch}`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("Group info loaded:", data);
        setGroupInfo(data);
      } else {
        console.error(`Failed to load group info: ${response.status}`);
      }
    } catch (error) {
      console.error("Error loading group info:", error);
    }
  };

  const handleDeleteGroup = async () => {
    if (!chat.isGroup) {
      console.error("❌ Cannot delete: Chat is not a group");
      return;
    }

    // Enhanced debugging - Check all values before proceeding
    console.log("=== ENHANCED DELETE GROUP DEBUG INFO ===");
    console.log("Raw chat object:", JSON.stringify(chat, null, 2));
    console.log("chat.id (conversation ID):", chat.id);
    console.log("chat.groupId:", chat.groupId);
    console.log("typeof chat.groupId:", typeof chat.groupId);
    console.log("chat.groupId is undefined:", chat.groupId === undefined);
    console.log("chat.groupId is null:", chat.groupId === null);
    console.log("groupInfo object:", JSON.stringify(groupInfo, null, 2));
    console.log("groupInfo?.id:", groupInfo?.id);
    console.log("currentUser:", currentUser);
    console.log("=========================================");

    setIsDeleting(true);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      // COMPREHENSIVE GROUP ID RESOLUTION
      let groupIdToDelete: number | null = null;

      // Method 1: Try chat.groupId (from conversation API)
      if (
        chat.groupId &&
        typeof chat.groupId === "number" &&
        chat.groupId > 0
      ) {
        groupIdToDelete = chat.groupId;
        console.log(`✅ Using chat.groupId: ${groupIdToDelete}`);
      }
      // Method 2: Try groupInfo.id (from group API)
      else if (
        groupInfo &&
        groupInfo.id &&
        typeof groupInfo.id === "number" &&
        groupInfo.id > 0
      ) {
        groupIdToDelete = groupInfo.id;
        console.log(`✅ Using groupInfo.id: ${groupIdToDelete}`);
      }
      // Method 3: Try to extract from chat.id if it looks like a group conversation
      else if (chat.id && chat.isGroup) {
        // Last resort - try to fetch group info first
        console.log(
          "⚠️ No groupId available, attempting to load group info first..."
        );

        try {
          // Try using conversation ID to get group info via API
          const groupInfoResponse = await fetch(
            `${backendUrl}/api/conversations/${chat.id}`,
            { credentials: "include" }
          );

          if (groupInfoResponse.ok) {
            const convData = await groupInfoResponse.json();
            console.log("Conversation data:", convData);

            if (convData.group_id) {
              groupIdToDelete = convData.group_id;
              console.log(
                `✅ Found group ID from conversation API: ${groupIdToDelete}`
              );
            }
          }
        } catch (apiError) {
          console.error("Failed to fetch conversation info:", apiError);
        }
      }

      // Final validation
      if (!groupIdToDelete || groupIdToDelete <= 0) {
        console.error(
          "❌ CRITICAL ERROR: No valid group ID found for deletion"
        );
        console.error("All attempts failed:");
        console.error("- chat.groupId:", chat.groupId);
        console.error("- groupInfo?.id:", groupInfo?.id);
        console.error("- chat.id:", chat.id);
        console.error("- chat.isGroup:", chat.isGroup);

        alert(
          "Error: Cannot determine group ID for deletion.\n\n" +
            "Please try the following:\n" +
            "1. Refresh the page and try again\n" +
            "2. Close and reopen this group chat\n" +
            "3. If the problem persists, contact support\n\n" +
            `Debug info: conversation=${chat.id}, groupId=${chat.groupId}, groupInfo=${groupInfo?.id}`
        );
        return;
      }

      // Double-check the group ID is reasonable
      if (groupIdToDelete < 1 || groupIdToDelete > 999999) {
        console.error(
          `❌ Group ID ${groupIdToDelete} seems invalid (outside reasonable range)`
        );
        alert(
          `Error: Invalid group ID (${groupIdToDelete}). Please refresh and try again.`
        );
        return;
      }

      console.log(`✅ FINAL GROUP ID TO DELETE: ${groupIdToDelete}`);
      console.log(
        `✅ Making DELETE request to: ${backendUrl}/api/groups/${groupIdToDelete}`
      );

      const response = await fetch(
        `${backendUrl}/api/groups/${groupIdToDelete}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      console.log(`Delete response status: ${response.status}`);

      if (response.ok) {
        console.log("✅ Group deleted successfully");
        setShowDeleteConfirm(false);
        // Refresh the conversation list and go back to no selected chat
        onConversationUpdated();
        alert("Group deleted successfully!");
        // Redirect to chats page
        window.location.href = "/chats";
      } else {
        // Get the actual error message from the response
        let errorMessage = "Failed to delete group. Please try again.";
        try {
          const responseText = await response.text();
          console.log("Raw response text:", responseText);

          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorData.error || errorMessage;
          console.error("Delete error response:", errorData);
        } catch (e) {
          console.error("Could not parse error response:", e);
          console.error("Response was not valid JSON");
        }

        console.error(`❌ Delete failed with status: ${response.status}`);

        if (response.status === 404) {
          alert(
            `Error: Group not found (404)\n\n` +
              `The group may have already been deleted or the ID is incorrect.\n` +
              `Group ID used: ${groupIdToDelete}\n\n` +
              `Please refresh the page to see the updated group list.`
          );
        } else {
          alert(`Error: ${errorMessage}`);
        }
      }
    } catch (error) {
      console.error("❌ Network error deleting group:", error);
      alert(
        "Network error occurred while deleting group. Please check your connection and try again."
      );
    } finally {
      setIsDeleting(false);
    }
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
        // Filter out users who are already members of the group
        const currentMemberIds = new Set(chat.members?.map((m) => m.id) || []);
        const availableUsers = (data.following || []).filter(
          (user) => !currentMemberIds.has(user.id)
        );
        setFollowingUsers(availableUsers);
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

  const handleAddMembers = async () => {
    if (selectedMembers.length === 0) return;

    setIsAddingMembers(true);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      const groupIdToUse = chat.groupId || groupInfo?.id;
      if (!groupIdToUse) {
        alert("Error: Cannot determine group ID");
        return;
      }

      const response = await fetch(
        `${backendUrl}/api/groups/${groupIdToUse}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            member_ids: selectedMembers,
          }),
          credentials: "include",
        }
      );

      if (response.ok) {
        // Immediately update local chat state to add the new members to UI
        if (chat.members && selectedMembers.length > 0) {
          // Get the user details for the newly added members from followingUsers
          const newMembers = followingUsers
            .filter((user) => selectedMembers.includes(user.id))
            .map((user) => ({
              id: user.id,
              name: `${user.first_name} ${user.last_name}`,
              avatar: user.avatar,
            }));

          // Add the new members to the existing members array
          chat.members = [...chat.members, ...newMembers];
        }

        setShowAddMemberModal(false);
        setSelectedMembers([]);
        // Also refresh conversation data to ensure consistency
        onConversationUpdated();
        alert(
          `Successfully added ${selectedMembers.length} member${
            selectedMembers.length !== 1 ? "s" : ""
          } to the group!`
        );
      } else {
        const errorData = await response.json();
        alert(`Failed to add members: ${errorData.message || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error adding members:", error);
      alert("Error adding members. Please try again.");
    } finally {
      setIsAddingMembers(false);
    }
  };

  const handleRemoveMember = async (member: any) => {
    // Confirm removal
    const confirmRemoval = window.confirm(
      `Are you sure you want to remove ${member.name} from this group?`
    );

    if (!confirmRemoval) return;

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      const groupIdToUse = chat.groupId || groupInfo?.id;
      if (!groupIdToUse) {
        alert("Error: Cannot determine group ID");
        return;
      }

      const response = await fetch(
        `${backendUrl}/api/groups/${groupIdToUse}/members/${member.id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (response.ok) {
        // Immediately update local chat state to remove the member from UI
        if (chat.members) {
          chat.members = chat.members.filter((m) => m.id !== member.id);
        }

        // Also refresh conversation data to ensure consistency
        onConversationUpdated();
        alert(`${member.name} has been removed from the group.`);
      } else {
        const errorData = await response.json();
        alert(
          `Failed to remove member: ${errorData.message || "Unknown error"}`
        );
      }
    } catch (error) {
      console.error("Error removing member:", error);
      alert("Error removing member. Please try again.");
    }
  };

  // Emoji picker handler
  const handleEmojiClick = () => {
    setShowEmojiPicker(!showEmojiPicker);
  };

  const handleEmojiSelect = (emojiData: EmojiClickData) => {
    setMessage((prevMessage) => prevMessage + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  // Handle clicking outside emoji picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  // Group post interaction functions
  const handleVoteGroupPost = async (postId: number, voteType: number) => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      const response = await fetch(
        `${backendUrl}/api/groups/posts/${postId}/vote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vote_type: voteType }),
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();

        // Update the message state to reflect the vote change
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === `post-${postId}` && msg.postData) {
              return {
                ...msg,
                postData: {
                  ...msg.postData,
                  upvotes: data.upvotes,
                  downvotes: data.downvotes,
                  userVote: data.user_vote,
                },
              };
            }
            return msg;
          })
        );

        // Also update the group posts in the sidebar
        loadGroupPosts();
      } else {
        console.error("Failed to vote on post");
      }
    } catch (error) {
      console.error("Error voting on post:", error);
    }
  };

  const handleLikeGroupPost = async (postId: number) => {
    // For backward compatibility, treat like as upvote
    await handleVoteGroupPost(postId, 1);
  };

  const loadPostComments = async (postId: number) => {
    setIsLoadingComments(true);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      const response = await fetch(
        `${backendUrl}/api/groups/posts/${postId}/comments`,
        {
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPostComments(data.comments || []);
      }
    } catch (error) {
      console.error("Error loading comments:", error);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleShowComments = (postId: number) => {
    setSelectedPostId(postId);
    setShowCommentsModal(true);
    loadPostComments(postId);
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !selectedPostId) return;

    setIsSubmittingComment(true);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      const response = await fetch(
        `${backendUrl}/api/groups/posts/${selectedPostId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: newComment.trim() }),
          credentials: "include",
        }
      );

      if (response.ok) {
        setNewComment("");
        // Reload comments
        await loadPostComments(selectedPostId);

        // Update comment count in messages
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === `post-${selectedPostId}` && msg.postData) {
              return {
                ...msg,
                postData: {
                  ...msg.postData,
                  commentsCount: (msg.postData.commentsCount || 0) + 1,
                },
              };
            }
            return msg;
          })
        );

        // Also update the group posts in the sidebar
        loadGroupPosts();
      } else {
        console.error("Failed to submit comment");
        alert("Failed to submit comment. Please try again.");
      }
    } catch (error) {
      console.error("Error submitting comment:", error);
      alert("Error submitting comment. Please check your connection.");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Add function to delete comments
  const handleDeleteComment = async (commentId: number) => {
    if (!selectedPostId) return;

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      const response = await fetch(
        `${backendUrl}/api/groups/posts/${selectedPostId}/comments/${commentId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (response.ok) {
        // Reload comments
        await loadPostComments(selectedPostId);

        // Update comment count in messages
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === `post-${selectedPostId}` && msg.postData) {
              return {
                ...msg,
                postData: {
                  ...msg.postData,
                  commentsCount: Math.max(
                    0,
                    (msg.postData.commentsCount || 0) - 1
                  ),
                },
              };
            }
            return msg;
          })
        );

        // Also update the group posts in the sidebar
        loadGroupPosts();
      } else {
        const errorData = await response.text();
        alert(`Failed to delete comment: ${errorData}`);
      }
    } catch (error) {
      console.error("Error deleting comment:", error);
      alert("Error deleting comment. Please check your connection.");
    }
  };

  // Add function to vote on comments
  const handleVoteComment = async (commentId: number, voteType: number) => {
    if (!selectedPostId) return;

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      const response = await fetch(
        `${backendUrl}/api/groups/posts/${selectedPostId}/comments/${commentId}/vote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vote_type: voteType }),
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();

        // Update the specific comment in the postComments state with the new vote data
        setPostComments((prevComments) =>
          prevComments.map((comment) => {
            if (comment.id === commentId) {
              return {
                ...comment,
                upvotes: data.upvotes,
                downvotes: data.downvotes,
                user_vote: data.user_vote,
              };
            }
            return comment;
          })
        );
      } else {
        console.error("Failed to vote on comment");
        const errorText = await response.text();
        console.error("Vote error response:", errorText);
      }
    } catch (error) {
      console.error("Error voting on comment:", error);
    }
  };

  return (
    <div className="flex h-full bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="flex-1 flex flex-col">
        {/* Modern Chat Header */}
        <div className="px-6 py-4 bg-white/80 backdrop-blur-sm border-b border-slate-200/60 shadow-sm">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              {/* Enhanced Avatar */}
              <div className="relative">
                <div className="h-12 w-12 rounded-full overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center ring-2 ring-white shadow-lg">
                  {chat.isGroup ? (
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 h-full w-full flex items-center justify-center text-white">
                      <FaUsers size={20} />
                    </div>
                  ) : chat.avatar &&
                    chat.avatar !== "/uploads/avatars/default.jpg" ? (
                    <img
                      src={getImageUrl(chat.avatar)}
                      alt={chat.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-400 to-slate-500">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-6 h-6"
                      >
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </div>
                  )}
                </div>
                {/* Online Status Indicator */}
                <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 bg-green-500 border-2 border-white rounded-full"></div>
              </div>

              <div>
                <h2 className="font-semibold text-lg text-slate-800">
                  {chat.name}
                </h2>
                <div className="flex items-center space-x-3">
                  {chat.isGroup && chat.members && (
                    <p className="text-sm text-slate-500">
                      {chat.members.length} members
                    </p>
                  )}
                  {/* Modern Connection Status */}
                  <div className="flex items-center space-x-1.5">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        socket && socket.readyState === WebSocket.OPEN
                          ? "bg-green-500 animate-pulse"
                          : "bg-amber-500"
                      }`}
                    />
                    <span className="text-xs font-medium text-slate-600">
                      {socket && socket.readyState === WebSocket.OPEN
                        ? "Connected"
                        : "Syncing"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modern Action Buttons */}
            <div className="flex items-center space-x-2">
              {chat.isGroup && (
                <>
                  <button
                    onClick={() => setShowPostModal(true)}
                    className="p-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                    title="Create post"
                  >
                    <IoAddCircle size={18} />
                  </button>
                  <button
                    onClick={() => setShowEventModal(true)}
                    className="p-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                    title="Create event"
                  >
                    <FaCalendarAlt size={18} />
                  </button>
                  <button
                    onClick={() => setShowEventsPanel(!showEventsPanel)}
                    className={`p-2.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 ${
                      showEventsPanel
                        ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                        : "bg-white/80 hover:bg-white text-slate-600 hover:text-slate-800"
                    }`}
                    title="View events & posts"
                  >
                    <FaUsers size={18} />
                  </button>
                </>
              )}
              <button
                onClick={() => setShowInfo(!showInfo)}
                className={`p-2.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 ${
                  showInfo
                    ? "bg-gradient-to-r from-indigo-500 to-blue-500 text-white"
                    : "bg-white/80 hover:bg-white text-slate-600 hover:text-slate-800"
                }`}
                title="Chat information"
              >
                <IoInformationCircle size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Modern Messages Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-8 bg-red-50 border border-red-200 rounded-2xl shadow-lg">
                <div className="text-red-500 text-4xl mb-4">⚠️</div>
                <p className="text-red-700 font-medium">{error}</p>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-500 font-medium">
                  Loading messages...
                </p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-8 bg-white/60 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-lg">
                <div className="text-6xl mb-4">💬</div>
                <h3 className="text-xl font-semibold text-slate-700 mb-2">
                  No messages yet
                </h3>
                <p className="text-slate-500">
                  Start the conversation and make it memorable!
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, index) => {
                const showAvatar =
                  !msg.isMe &&
                  (index === 0 ||
                    messages[index - 1].senderId !== msg.senderId);
                const showSender = chat.isGroup && !msg.isMe && showAvatar;

                return (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.isMe ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`flex items-end max-w-[70%] ${
                        msg.isMe ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      {/* Avatar */}
                      {!msg.isMe && (
                        <div
                          className={`flex-shrink-0 mr-3 ${
                            showAvatar ? "opacity-100" : "opacity-0"
                          }`}
                        >
                          <div className="h-8 w-8 rounded-full overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300 ring-2 ring-white shadow-md">
                            {msg.senderAvatar &&
                            msg.senderAvatar !==
                              "/uploads/avatars/default.jpg" ? (
                              <img
                                src={getImageUrl(msg.senderAvatar)}
                                alt={msg.senderName}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-400 to-slate-500">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="white"
                                  strokeWidth="2"
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
                        </div>
                      )}

                      <div
                        className={`flex flex-col ${
                          msg.isMe ? "items-end" : "items-start"
                        }`}
                      >
                        {/* Sender Name */}
                        {showSender && (
                          <span className="text-xs font-medium text-slate-600 mb-1 px-3">
                            {msg.senderName}
                          </span>
                        )}

                        {/* Message or Post Content */}
                        {msg.type === "post" ? (
                          // Post message with special styling
                          <div
                            className={`relative rounded-2xl shadow-lg max-w-lg ${
                              msg.isMe
                                ? "bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200"
                                : "bg-gradient-to-br from-slate-50 to-gray-50 border-2 border-slate-200"
                            }`}
                          >
                            {/* Post Header */}
                            <div className="p-4 border-b border-slate-200">
                              <div className="flex items-center gap-2 mb-2">
                                <div
                                  className={`px-2 py-1 rounded-full text-xs font-bold ${
                                    msg.isMe
                                      ? "bg-blue-500 text-white"
                                      : "bg-slate-500 text-white"
                                  }`}
                                >
                                  📝 Group Post
                                </div>
                                <span className="text-xs text-slate-500 font-medium">
                                  {msg.timestamp}
                                </span>
                              </div>
                              <p className="text-sm text-slate-800 leading-relaxed font-medium">
                                {msg.content}
                              </p>
                            </div>

                            {/* Post Image */}
                            {msg.postData?.imagePath && (
                              <div className="px-4 pt-3">
                                <img
                                  src={`${
                                    process.env.NEXT_PUBLIC_BACKEND_URL ||
                                    "http://localhost:8080"
                                  }${msg.postData.imagePath}`}
                                  alt="Post image"
                                  className="w-full h-48 object-cover rounded-xl border border-slate-200"
                                />
                              </div>
                            )}

                            {/* Post Engagement */}
                            <div className="p-4 bg-white/80 rounded-b-2xl">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-6 text-xs">
                                  {/* Horizontal voting layout */}
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() =>
                                        handleVoteGroupPost(
                                          parseInt(msg.id.replace("post-", "")),
                                          1
                                        )
                                      }
                                      className={`flex items-center justify-center w-8 h-6 rounded-lg transition-all duration-200 hover:scale-110 ${
                                        msg.postData?.userVote === 1
                                          ? "bg-green-100 text-green-600"
                                          : "text-gray-400 hover:bg-green-50 hover:text-green-500"
                                      }`}
                                    >
                                      <span className="text-sm">👍</span>
                                    </button>
                                    <span
                                      className={`font-bold text-sm min-w-[2rem] text-center ${
                                        msg.postData?.userVote === 1
                                          ? "text-green-600"
                                          : msg.postData?.userVote === -1
                                          ? "text-red-600"
                                          : "text-gray-600"
                                      }`}
                                    >
                                      {(msg.postData?.upvotes || 0) -
                                        (msg.postData?.downvotes || 0)}
                                    </span>
                                    <button
                                      onClick={() =>
                                        handleVoteGroupPost(
                                          parseInt(msg.id.replace("post-", "")),
                                          -1
                                        )
                                      }
                                      className={`flex items-center justify-center w-8 h-6 rounded-lg transition-all duration-200 hover:scale-110 ${
                                        msg.postData?.userVote === -1
                                          ? "bg-red-100 text-red-600"
                                          : "text-gray-400 hover:bg-red-50 hover:text-red-500"
                                      }`}
                                    >
                                      <span className="text-sm">👎</span>
                                    </button>
                                  </div>
                                  <button
                                    onClick={() =>
                                      handleShowComments(
                                        parseInt(msg.id.replace("post-", ""))
                                      )
                                    }
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-cyan-600 hover:bg-cyan-50 transition-all duration-200 hover:scale-105"
                                  >
                                    <div className="h-1.5 w-1.5 bg-cyan-500 rounded-full"></div>
                                    <span className="font-semibold">
                                      💬 {msg.postData?.commentsCount || 0}
                                    </span>
                                  </button>
                                </div>
                                <div className="text-xs text-slate-500 font-medium">
                                  Posted by {msg.senderName}
                                </div>
                              </div>
                            </div>

                            {/* Post Tail */}
                            <div
                              className={`absolute top-6 ${
                                msg.isMe
                                  ? "right-0 transform translate-x-full"
                                  : "left-0 transform -translate-x-full"
                              }`}
                            >
                              <div
                                className={`w-0 h-0 ${
                                  msg.isMe
                                    ? "border-l-8 border-l-blue-200 border-t-8 border-t-transparent border-b-8 border-b-transparent"
                                    : "border-r-8 border-r-slate-200 border-t-8 border-t-transparent border-b-8 border-b-transparent"
                                }`}
                              />
                            </div>
                          </div>
                        ) : (
                          // Regular message bubble
                          <div
                            className={`relative px-4 py-3 rounded-2xl shadow-md max-w-sm break-words ${
                              msg.isMe
                                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-br-md"
                                : "bg-white text-slate-800 rounded-bl-md border border-slate-200"
                            }`}
                          >
                            <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">
                              {msg.content}
                            </p>

                            <div
                              className={`text-xs mt-2 font-medium ${
                                msg.isMe ? "text-blue-100" : "text-slate-500"
                              }`}
                            >
                              {msg.timestamp}
                            </div>

                            {/* Message Tail */}
                            <div
                              className={`absolute top-3 ${
                                msg.isMe
                                  ? "right-0 transform translate-x-full"
                                  : "left-0 transform -translate-x-full"
                              }`}
                            >
                              <div
                                className={`w-0 h-0 ${
                                  msg.isMe
                                    ? "border-l-8 border-l-blue-500 border-t-8 border-t-transparent border-b-8 border-b-transparent"
                                    : "border-r-8 border-r-white border-t-8 border-t-transparent border-b-8 border-b-transparent"
                                }`}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {msg.isMe && (
                        <div className="flex-shrink-0 ml-3">
                          {/* Spacer for alignment */}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Modern Message Input */}
        <div className="p-6 bg-white/80 backdrop-blur-sm border-t border-slate-200/60">
          <div className="flex items-end space-x-4 bg-white rounded-2xl shadow-lg border border-slate-200 p-4">
            <button
              type="button"
              className="flex-shrink-0 p-2 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 text-white shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
              title="Add emoji"
              onClick={handleEmojiClick}
            >
              <FaSmile size={20} />
            </button>

            <div className="flex-1 relative">
              <textarea
                className="w-full resize-none border-0 rounded-xl px-4 py-3 text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 placeholder-slate-400 font-medium"
                rows={1}
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  minHeight: 44,
                  maxHeight: 120,
                }}
              />
            </div>

            <button
              type="button"
              className={`flex-shrink-0 p-3 rounded-xl shadow-lg transition-all duration-200 transform ${
                message.trim()
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white hover:scale-105 hover:shadow-xl"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
              onClick={handleSendMessage}
              disabled={!message.trim()}
              title="Send message"
            >
              <IoSend size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Modern Info Sidebar */}
      {showInfo && (
        <div className="w-80 bg-white/90 backdrop-blur-sm border-l border-slate-200/60 overflow-y-auto shadow-xl">
          <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-xl text-slate-800">Chat Details</h3>
              <button
                onClick={() => setShowInfo(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all duration-200 transform hover:scale-105"
              >
                <FaTimes size={16} />
              </button>
            </div>

            {/* Profile Section */}
            <div className="flex flex-col items-center mb-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 shadow-md">
              <div className="relative mb-4">
                <div className="h-24 w-24 rounded-full overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center ring-4 ring-white shadow-xl">
                  {chat.isGroup ? (
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 h-full w-full flex items-center justify-center text-white">
                      <FaUsers size={40} />
                    </div>
                  ) : chat.avatar &&
                    chat.avatar !== "/uploads/avatars/default.jpg" ? (
                    <img
                      src={getImageUrl(chat.avatar)}
                      alt={chat.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-400 to-slate-500">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-8 h-8"
                      >
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-green-500 border-3 border-white rounded-full flex items-center justify-center">
                  <div className="h-2 w-2 bg-white rounded-full"></div>
                </div>
              </div>
              <h2 className="font-bold text-2xl text-center text-slate-800 mb-2">
                {chat.name}
              </h2>
              {chat.isGroup && (
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 rounded-full">
                  <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                  <p className="text-sm font-medium text-blue-700">
                    Created January 2023
                  </p>
                </div>
              )}
            </div>

            {chat.isGroup && (
              <>
                {/* Members Section */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wide flex items-center gap-2">
                      <div className="h-2 w-2 bg-indigo-500 rounded-full"></div>
                      Members ({chat.members?.length || 0})
                    </h4>
                    <button
                      onClick={() => {
                        setShowAddMemberModal(true);
                        loadFollowingUsers();
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-sm font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                      title="Add members from people you follow"
                    >
                      <FaUserPlus size={14} />
                      <span>Add</span>
                    </button>
                  </div>

                  <div className="p-1 bg-gradient-to-br from-slate-50 to-gray-50 rounded-2xl border border-slate-200">
                    <div className="space-y-1">
                      {chat.members?.map((member, index) => (
                        <div
                          key={index}
                          className="flex items-center p-3 hover:bg-white/80 rounded-xl transition-all duration-200 group"
                        >
                          <div className="h-10 w-10 rounded-full overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300 mr-3 flex items-center justify-center ring-2 ring-white shadow-md">
                            {member.avatar &&
                            member.avatar !== "/uploads/avatars/default.jpg" ? (
                              <img
                                src={getImageUrl(member.avatar)}
                                alt={member.name}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-400 to-slate-500">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="white"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="w-5 h-5"
                                >
                                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                  <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-800">
                              {member.name}
                            </p>
                            {index === 0 && (
                              <div className="flex items-center gap-1 mt-1">
                                <div className="h-1.5 w-1.5 bg-amber-500 rounded-full"></div>
                                <p className="text-xs font-medium text-amber-600">
                                  Group Creator
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Remove Member Button */}
                          {currentUser && (
                            <>
                              {/* Check if current user is creator using groupInfo */}
                              {groupInfo &&
                                groupInfo.creator_id === currentUser.id &&
                                index !== 0 && (
                                  <button
                                    onClick={() => handleRemoveMember(member)}
                                    className="ml-2 p-2 bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 rounded-xl transition-all duration-200 transform hover:scale-105 opacity-0 group-hover:opacity-100"
                                    title={`Remove ${member.name} from group`}
                                  >
                                    <FaTrash size={12} />
                                  </button>
                                )}

                              {/* Fallback check if groupInfo is not available */}
                              {!groupInfo &&
                                chat.members &&
                                chat.members.length > 0 &&
                                (chat.members[0].id === currentUser.id ||
                                  chat.members[0].id === currentUser.userId) &&
                                index !== 0 && (
                                  <button
                                    onClick={() => handleRemoveMember(member)}
                                    className="ml-2 p-2 bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 rounded-xl transition-all duration-200 transform hover:scale-105 opacity-0 group-hover:opacity-100"
                                    title={`Remove ${member.name} from group`}
                                  >
                                    <FaTrash size={12} />
                                  </button>
                                )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Delete Group Section */}
                {chat.isGroup && currentUser && (
                  <div className="pt-6 border-t border-slate-200">
                    {groupInfo ? (
                      groupInfo.creator_id === currentUser.id ? (
                        <div className="space-y-4">
                          <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-2"
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
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                            Delete Group Forever
                          </button>
                        </div>
                      ) : (
                        <div className="p-4 bg-gradient-to-br from-slate-50 to-gray-50 border border-slate-200 rounded-2xl text-center">
                          <div className="text-slate-400 text-2xl mb-2">🔒</div>
                          <p className="text-sm text-slate-600 font-medium">
                            Only the group creator can delete this group
                          </p>
                        </div>
                      )
                    ) : chat.members &&
                      chat.members.length > 0 &&
                      (chat.members[0].id === currentUser.id ||
                        chat.members[0].id === currentUser.userId) ? (
                      <div className="space-y-4">
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-2"
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
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                          Delete Group Forever
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 bg-gradient-to-br from-slate-50 to-gray-50 border border-slate-200 rounded-2xl text-center">
                        <div className="text-slate-400 text-2xl mb-2">🔒</div>
                        <p className="text-sm text-slate-600 font-medium">
                          Only the group creator can delete this group
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {!chat.isGroup && (
              <div className="p-5 bg-gradient-to-br from-slate-50 to-gray-50 rounded-2xl border border-slate-200">
                <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
                  <div className="h-2 w-2 bg-slate-400 rounded-full"></div>
                  About
                </h4>
                <p className="text-slate-600 leading-relaxed">
                  This conversation started in January 2023. Enjoy your private
                  chat!
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      <Dialog.Root open={showEventModal} onOpenChange={setShowEventModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 w-full max-w-md z-50">
            <Dialog.Title className="text-xl font-semibold mb-4">
              Create Group Event
            </Dialog.Title>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="eventTitle"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Event Title
                </label>
                <input
                  id="eventTitle"
                  type="text"
                  value={newEvent.title}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, title: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter event title"
                />
              </div>

              <div>
                <label
                  htmlFor="eventDescription"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Description
                </label>
                <textarea
                  id="eventDescription"
                  value={newEvent.description}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter event description"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label
                    htmlFor="eventDate"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Date
                  </label>
                  <input
                    id="eventDate"
                    type="date"
                    value={newEvent.date}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, date: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <label
                    htmlFor="eventTime"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Time
                  </label>
                  <input
                    id="eventTime"
                    type="time"
                    value={newEvent.time}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, time: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowEventModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEvent}
                disabled={
                  !newEvent.title.trim() || !newEvent.date || !newEvent.time
                }
                className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                  newEvent.title.trim() && newEvent.date && newEvent.time
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-blue-400 cursor-not-allowed"
                }`}
              >
                Create Event
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Create Post Modal */}
      <Dialog.Root open={showPostModal} onOpenChange={setShowPostModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 w-full max-w-md z-50">
            <Dialog.Title className="text-xl font-semibold mb-4">
              Create Group Post
            </Dialog.Title>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="postContent"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Post Content
                </label>
                <textarea
                  id="postContent"
                  value={newPost.content}
                  onChange={(e) =>
                    setNewPost({ ...newPost, content: e.target.value })
                  }
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="What do you want to share with the group?"
                />
              </div>

              <div>
                <label
                  htmlFor="postImage"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Image (optional)
                </label>
                <input
                  id="postImage"
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setNewPost({
                      ...newPost,
                      image: e.target.files?.[0] || null,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowPostModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePost}
                disabled={!newPost.content.trim()}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                  newPost.content.trim()
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-blue-400 cursor-not-allowed"
                }`}
              >
                Create Post
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modern Events & Posts Panel */}
      {showEventsPanel && chat.isGroup && (
        <div className="w-80 bg-white/90 backdrop-blur-sm border-l border-slate-200/60 flex flex-col shadow-xl">
          <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-slate-200/60">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-xl text-slate-800">
                Group Activity
              </h3>
              <button
                onClick={() => setShowEventsPanel(false)}
                className="p-2 rounded-xl bg-white/80 hover:bg-white text-slate-600 hover:text-slate-800 transition-all duration-200 transform hover:scale-105 shadow-md"
              >
                <FaTimes size={16} />
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPostModal(true)}
                className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                ✨ Create Post
              </button>
              <button
                onClick={() => setShowEventModal(true)}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                📅 Create Event
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-blue-50">
            {/* Modern Events Section */}
            <div className="p-6 border-b border-slate-200/60">
              <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
                <div className="h-2 w-2 bg-purple-500 rounded-full"></div>
                <FaCalendarAlt size={16} />
                Events ({groupEvents.length})
              </h4>

              {isLoadingEvents ? (
                <div className="flex justify-center py-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-3 border-purple-200 border-t-purple-600 mx-auto mb-3"></div>
                    <p className="text-slate-500 text-sm font-medium">
                      Loading events...
                    </p>
                  </div>
                </div>
              ) : groupEvents.length > 0 ? (
                <div className="space-y-4">
                  {groupEvents.map((event) => (
                    <div
                      key={event.id}
                      className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl p-4 shadow-md hover:shadow-lg transition-all duration-200"
                    >
                      <h5 className="font-bold text-slate-800 mb-2">
                        {event.title}
                      </h5>
                      <p className="text-sm text-slate-600 mb-3 leading-relaxed">
                        {event.description}
                      </p>
                      <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
                        <div className="h-1.5 w-1.5 bg-blue-500 rounded-full"></div>
                        <span className="font-medium">
                          {new Date(event.event_date).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs">
                          <div className="flex items-center gap-1">
                            <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                            <span className="text-green-700 font-medium">
                              {event.going_count || 0} going
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="h-2 w-2 bg-red-500 rounded-full"></div>
                            <span className="text-red-700 font-medium">
                              {event.not_going_count || 0} not going
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => respondToEvent(event.id, "going")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                              event.user_response === "going"
                                ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md"
                                : "bg-slate-100 text-slate-700 hover:bg-green-100 hover:text-green-700"
                            }`}
                          >
                            ✅ Going
                          </button>
                          <button
                            onClick={() =>
                              respondToEvent(event.id, "not_going")
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                              event.user_response === "not_going"
                                ? "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-md"
                                : "bg-slate-100 text-slate-700 hover:bg-red-100 hover:text-red-700"
                            }`}
                          >
                            ❌ Not Going
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">📅</div>
                  <p className="text-slate-500 font-medium">No events yet</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Create your first event to get started!
                  </p>
                </div>
              )}
            </div>

            {/* Modern Posts Section */}
            <div className="p-6">
              <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                <IoAddCircle size={16} />
                Posts ({groupPosts.length})
              </h4>

              {(() => {
                console.log("=== POSTS RENDER DEBUG ===");
                console.log("isLoadingPosts:", isLoadingPosts);
                console.log("groupPosts.length:", groupPosts.length);
                console.log("groupPosts:", groupPosts);
                console.log("==========================");
                return null;
              })()}

              {isLoadingPosts ? (
                <div className="flex justify-center py-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-200 border-t-blue-600 mx-auto mb-3"></div>
                    <p className="text-slate-500 text-sm font-medium">
                      Loading posts...
                    </p>
                  </div>
                </div>
              ) : groupPosts.length > 0 ? (
                <div className="space-y-4">
                  {groupPosts.map((post) => {
                    console.log("Rendering post:", post);
                    return (
                      <div
                        key={post.id}
                        className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-2xl p-4 shadow-md hover:shadow-lg transition-all duration-200"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <span className="font-bold text-slate-800">
                            {post.author_name}
                          </span>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <div className="h-1.5 w-1.5 bg-slate-400 rounded-full"></div>
                            <span className="font-medium">
                              {new Date(post.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-slate-700 mb-3 leading-relaxed">
                          {post.content}
                        </p>
                        {post.image_path && (
                          <img
                            src={`${
                              process.env.NEXT_PUBLIC_BACKEND_URL ||
                              "http://localhost:8080"
                            }${post.image_path}`}
                            alt="Post image"
                            className="w-full h-32 object-cover rounded-xl mb-3 border border-slate-200"
                          />
                        )}
                        <div className="flex items-center gap-4 text-xs">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleVoteGroupPost(post.id, 1)}
                              className={`flex items-center justify-center w-7 h-6 rounded-lg transition-all duration-200 hover:scale-110 ${
                                post.user_vote === 1
                                  ? "bg-green-100 text-green-600"
                                  : "text-gray-400 hover:bg-green-50 hover:text-green-500"
                              }`}
                            >
                              <span className="text-sm">👍</span>
                            </button>
                            <span
                              className={`font-bold text-sm min-w-[2rem] text-center ${
                                post.user_vote === 1
                                  ? "text-green-600"
                                  : post.user_vote === -1
                                  ? "text-red-600"
                                  : "text-gray-600"
                              }`}
                            >
                              {(post.upvotes || 0) - (post.downvotes || 0)}
                            </span>
                            <button
                              onClick={() => handleVoteGroupPost(post.id, -1)}
                              className={`flex items-center justify-center w-7 h-6 rounded-lg transition-all duration-200 hover:scale-110 ${
                                post.user_vote === -1
                                  ? "bg-red-100 text-red-600"
                                  : "text-gray-400 hover:bg-red-50 hover:text-red-500"
                              }`}
                            >
                              <span className="text-sm">👎</span>
                            </button>
                          </div>
                          <button
                            onClick={() => handleShowComments(post.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-cyan-600 hover:bg-cyan-50 transition-all duration-200 hover:scale-105"
                          >
                            <div className="h-1.5 w-1.5 bg-cyan-500 rounded-full"></div>
                            <span className="font-medium">
                              💬 {post.comments_count || 0} comment
                              {(post.comments_count || 0) !== 1 ? "s" : ""}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">📝</div>
                  <p className="text-slate-500 font-medium">No posts yet</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Share something with your group!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Confirmation Modal */}
      <Dialog.Root open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-md z-50 border border-red-200">
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
                  Permanently delete <strong>"{chat.name}"</strong> and all its
                  content?
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-gray-700 text-sm">
                  • All messages, posts, and files will be lost
                  <br />• All {chat.members?.length || 0} members will lose
                  access immediately
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                }}
                className="w-full px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors border border-gray-300"
                disabled={isDeleting}
              >
                ✅ Cancel - Keep Group Safe
              </button>
              <button
                onClick={handleDeleteGroup}
                disabled={isDeleting}
                className={`w-full px-4 py-3 text-sm font-bold rounded-md flex items-center justify-center gap-2 transition-colors ${
                  isDeleting
                    ? "bg-red-300 text-red-100 cursor-not-allowed"
                    : "bg-red-600 hover:bg-red-700 text-white border-2 border-red-800"
                }`}
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Deleting Permanently...
                  </>
                ) : (
                  <>
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    🗑️ YES, DELETE FOREVER
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center mt-4">
              Only group creators can perform this action. This deletion is
              immediate and irreversible.
            </p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Add Member Modal */}
      <Dialog.Root
        open={showAddMemberModal}
        onOpenChange={setShowAddMemberModal}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-md z-50 max-h-[70vh] overflow-y-auto">
            <Dialog.Title className="text-xl font-bold mb-4 text-blue-600 flex items-center gap-2">
              <FaUserPlus className="w-5 h-5" />
              Add Members to Group
            </Dialog.Title>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                Select people you follow to add to{" "}
                <strong>"{chat.name}"</strong>
              </p>

              {isLoadingFollowing ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : followingUsers.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-md">
                  {followingUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        id={`add-member-${user.id}`}
                        checked={selectedMembers.includes(user.id)}
                        onChange={() => handleMemberToggle(user.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div className="ml-3 flex items-center flex-1">
                        <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-200 mr-3 flex items-center justify-center">
                          {user.avatar ? (
                            <img
                              src={getImageUrl(user.avatar)}
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
                          htmlFor={`add-member-${user.id}`}
                          className="text-sm font-medium text-gray-900 cursor-pointer flex-1"
                        >
                          {user.first_name} {user.last_name}
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FaUsers className="mx-auto mb-2 text-gray-400" size={24} />
                  <p className="text-sm">No followers available to add</p>
                  <p className="text-xs text-gray-400 mt-1">
                    All your followers are already members or you don't follow
                    anyone
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

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowAddMemberModal(false);
                  setSelectedMembers([]);
                }}
                className="w-full px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors border border-gray-300"
                disabled={isAddingMembers}
              >
                Cancel
              </button>
              <button
                onClick={handleAddMembers}
                disabled={selectedMembers.length === 0 || isAddingMembers}
                className={`w-full px-4 py-3 text-sm font-bold rounded-md flex items-center justify-center gap-2 transition-colors ${
                  selectedMembers.length > 0 && !isAddingMembers
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-blue-300 text-blue-100 cursor-not-allowed"
                }`}
              >
                {isAddingMembers ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Adding Members...
                  </>
                ) : (
                  <>
                    <FaUserPlus size={14} />
                    Add{" "}
                    {selectedMembers.length > 0
                      ? selectedMembers.length
                      : ""}{" "}
                    Member{selectedMembers.length !== 1 ? "s" : ""}
                  </>
                )}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div ref={emojiPickerRef} className="absolute bottom-20 left-4 z-50">
          <EmojiPicker
            onEmojiClick={handleEmojiSelect}
            width={300}
            height={400}
          />
        </div>
      )}

      {/* Comments Modal */}
      <Dialog.Root open={showCommentsModal} onOpenChange={setShowCommentsModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-md z-50 max-h-[80vh] flex flex-col">
            <Dialog.Title className="text-xl font-bold mb-4 text-slate-800 flex items-center gap-2">
              💬 Post Comments
              <div className="ml-auto text-sm font-normal text-slate-500">
                {postComments.length} comment
                {postComments.length !== 1 ? "s" : ""}
              </div>
            </Dialog.Title>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto mb-4 min-h-0">
              {isLoadingComments ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : postComments.length > 0 ? (
                <div className="space-y-3">
                  {postComments.map((comment) => (
                    <div
                      key={comment.id}
                      className="bg-slate-50 rounded-lg p-3 border border-slate-200"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                          {comment.author_avatar &&
                          comment.author_avatar !==
                            "/uploads/avatars/default.jpg" ? (
                            <img
                              src={getImageUrl(comment.author_avatar)}
                              alt={comment.author_name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-400 to-slate-500">
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
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-slate-800">
                                {comment.author_name}
                              </span>
                              <span className="text-xs text-slate-500">
                                {new Date(
                                  comment.created_at
                                ).toLocaleDateString()}
                              </span>
                            </div>
                            {/* Delete button - shown if user is comment author or post owner */}
                            {(comment.author_id === currentUser?.id ||
                              messages.find(
                                (msg) => msg.id === `post-${selectedPostId}`
                              )?.senderId === currentUser?.id) && (
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="p-1 rounded text-red-500 hover:bg-red-50 transition-colors"
                                title="Delete comment"
                              >
                                <FaTimes size={12} />
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed mb-2">
                            {comment.content}
                          </p>

                          {/* Comment voting buttons */}
                          <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleVoteComment(comment.id, 1)}
                                className={`flex items-center justify-center w-6 h-5 rounded-lg transition-all duration-200 hover:scale-110 ${
                                  comment.user_vote === 1
                                    ? "bg-green-100 text-green-600"
                                    : "text-gray-400 hover:bg-green-50 hover:text-green-500"
                                }`}
                              >
                                <span className="text-xs">👍</span>
                              </button>
                              <span
                                className={`font-bold text-xs min-w-[1.5rem] text-center ${
                                  comment.user_vote === 1
                                    ? "text-green-600"
                                    : comment.user_vote === -1
                                    ? "text-red-600"
                                    : "text-gray-600"
                                }`}
                              >
                                {(comment.upvotes || 0) -
                                  (comment.downvotes || 0)}
                              </span>
                              <button
                                onClick={() =>
                                  handleVoteComment(comment.id, -1)
                                }
                                className={`flex items-center justify-center w-6 h-5 rounded-lg transition-all duration-200 hover:scale-110 ${
                                  comment.user_vote === -1
                                    ? "bg-red-100 text-red-600"
                                    : "text-gray-400 hover:bg-red-50 hover:text-red-500"
                                }`}
                              >
                                <span className="text-xs">👎</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <div className="text-4xl mb-2">💬</div>
                  <p className="text-sm">No comments yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Be the first to comment!
                  </p>
                </div>
              )}
            </div>

            {/* Add Comment Form */}
            <div className="border-t border-slate-200 pt-4">
              <div className="flex gap-3">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  rows={2}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  disabled={isSubmittingComment}
                />
                <button
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim() || isSubmittingComment}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    newComment.trim() && !isSubmittingComment
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  {isSubmittingComment ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    "Post"
                  )}
                </button>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => {
                setShowCommentsModal(false);
                setSelectedPostId(null);
                setPostComments([]);
                setNewComment("");
              }}
              className="absolute top-4 right-4 p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all duration-200"
            >
              <FaTimes size={14} />
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
