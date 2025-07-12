"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Chat } from "../page";
import { IoSend, IoInformationCircle, IoAddCircle } from "react-icons/io5";
import {
  FaSmile,
  FaUsers,
  FaCalendarAlt,
  FaTimes,
  FaUserPlus,
  FaTrash,
  FaCog,
  FaEdit,
  FaArrowLeft,
} from "react-icons/fa";
import { getImageUrl } from "@/utils/image";
import * as Dialog from "@radix-ui/react-dialog";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import Avatar, { ChatAvatar } from "@/components/ui/Avatar";

interface Comment {
  id: string | number;
  content: string;
  image_path?: string; // Backend field name
  imagePath?: string; // Frontend field name for compatibility
  authorId: number;
  authorName: string;
  authorAvatar?: string;
  created_at?: string; // Backend field name
  createdAt?: string; // Frontend field name for compatibility
  upvotes: number;
  downvotes: number;
  userVote: number;
}

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
    going_count?: number;
    not_going_count?: number;
    user_response?: string | null;
  };
}

interface ChatWindowProps {
  chat: Chat;
  onConversationUpdated: (lastMessage?: string) => Promise<void>;
  isMobile?: boolean;
  isTablet?: boolean;
  deviceType?: "phone" | "tablet" | "desktop";
  onBackClick?: () => void;
}

export default function ChatWindow({
  chat,
  onConversationUpdated,
  isMobile = false,
  isTablet = false,
  deviceType = "desktop",
  onBackClick,
}: ChatWindowProps) {
  const { isLoggedIn } = useAuth();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const [currentUser, setCurrentUser] = useState<{
    id: number | string;
    firstName: string;
    lastName: string;
    email?: string;
    avatar?: string;
  } | null>(null);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showEventsPanel, setShowEventsPanel] = useState(false);
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
  const [groupEvents, setGroupEvents] = useState<
    {
      id: number;
      title: string;
      description: string;
      eventDate: string;
      createdAt: string;
      creator_id: number;
      going_count?: number;
      not_going_count?: number;
      user_response?: string | null;
    }[]
  >([]);
  const [groupPosts, setGroupPosts] = useState<
    {
      id: number;
      content: string;
      imagePath?: string;
      createdAt: string;
      authorId: number;
      authorName: string;
      authorAvatar?: string;
      likesCount?: number;
      commentsCount?: number;
      isLiked?: boolean;
      upvotes?: number;
      downvotes?: number;
      userVote?: number;
    }[]
  >([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [groupInfo, setGroupInfo] = useState<{
    id: number;
    name: string;
    description?: string;
    creatorId: number;
    members: {
      id: number;
      firstName: string;
      lastName: string;
      email?: string;
      avatar?: string;
    }[];
    memberCount: number;
    isPrivate: boolean;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [followingUsers, setFollowingUsers] = useState<
    {
      id: number;
      firstName: string;
      lastName: string;
      email?: string;
      avatar?: string;
    }[]
  >([]);
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [isLoadingFollowing, setIsLoadingFollowing] = useState(false);
  const [isAddingMembers, setIsAddingMembers] = useState(false);

  // Group post interactions
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [postComments, setPostComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [newCommentImage, setNewCommentImage] = useState<File | null>(null);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Reset events panel when chat changes
  useEffect(() => {
    setShowEventsPanel(false);
  }, [chat.id]);

  // Helper function to create toast notifications
  const createNotification = (message: string, color: string) => {
    const notification = document.createElement("div");
    notification.className = `fixed top-4 right-4 ${color} text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 3000);
  };

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
          if (process.env.NODE_ENV === 'development') {
          console.log("Current user fetched:", userData);
        }
        }
      } catch (error) {
        console.error("Error fetching current user:", error);
      }
    };

    fetchCurrentUser();
  }, [isLoggedIn]);

  // WebSocket connection with race condition prevention
  useEffect(() => {
    // Connection state tracking
    let wsConnected = false;
    let connectionCancelled = false;
    let connectionTimeout: NodeJS.Timeout | null = null;
    let pollingInterval: NodeJS.Timeout | null = null;
    let pollingTimeout: NodeJS.Timeout | null = null;

    // Close any existing socket connection with proper cleanup
    if (socket) {
      if (process.env.NODE_ENV === 'development') {
        console.log("🔌 Closing existing WebSocket connection");
      }
      socket.close(1000, "Chat switched");
      setSocket(null);
    }

    // Don't attempt to connect if not authenticated
    if (!currentUser) {
      if (process.env.NODE_ENV === 'development') {
        console.log("⏸️ Skipping WebSocket connection - no current user");
      }
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log("👤 Current user for WebSocket:", {
        id: currentUser.id,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
      });
    }

    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${backendUrl.replace(
      /^https?:\/\//,
      ""
    )}/ws/chat`;

    if (process.env.NODE_ENV === 'development') {
      console.log("🔌 Attempting WebSocket connection to:", wsUrl);
    }

    const newSocket = new WebSocket(wsUrl);

    connectionTimeout = setTimeout(() => {
      if (!wsConnected && !connectionCancelled) {
        if (process.env.NODE_ENV === 'development') {
          console.log("⏰ WebSocket connection timeout, closing socket");
        }
        connectionCancelled = true;
        newSocket.close();
        setError("WebSocket connection timeout. Using polling instead.");
      }
    }, 5000); // 5 second timeout

    newSocket.onopen = () => {
      if (connectionCancelled) {
        if (process.env.NODE_ENV === 'development') {
          console.log("⏸️ WebSocket connection cancelled, closing");
        }
        newSocket.close();
        return;
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log("✅ WebSocket connection established");
      }
      wsConnected = true;
      if (connectionTimeout) clearTimeout(connectionTimeout);
      setError(null);
      
      // Register for this conversation
      if (newSocket.readyState === WebSocket.OPEN) {
        if (process.env.NODE_ENV === 'development') {
          console.log("📝 Registering for conversation:", chat.id);
        }
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
        if (process.env.NODE_ENV === 'development') {
          console.log("📨 Received WebSocket message:", data.type);
        }

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
          const isMeCheck1 = String(data.sender_id) === String(currentUser?.id);
          const isMeCheck2 = Number(data.sender_id) === Number(currentUser?.id);
          const finalIsMe = isMeCheck1 || isMeCheck2;

          console.log("📨 Formatting incoming WebSocket message:", {
            messageId: data.id,
            senderIdFromWS: data.sender_id,
            senderIdType: typeof data.sender_id,
            currentUserId: currentUser?.id,
            currentUserIdType: typeof currentUser?.id,
            stringComparison: `"${String(data.sender_id)}" === "${String(
              currentUser?.id
            )}" = ${isMeCheck1}`,
            numberComparison: `${Number(data.sender_id)} === ${Number(
              currentUser?.id
            )} = ${isMeCheck2}`,
            finalIsMe,
            content: data.content?.substring(0, 50),
          });

          const newMessage: Message = {
            id: data.id || `ws-${Date.now()}`,
            senderId: data.sender_id,
            senderName: data.sender_name || "Unknown",
            senderAvatar: data.sender_avatar,
            content: data.content,
            timestamp: formatTimestamp(
              data.timestamp || new Date().toISOString()
            ),
            timestampRaw: data.timestamp,
            isMe: finalIsMe,
          };

          // Smart message merging - avoid full refresh and handle optimistic updates
          setMessages((prev) => {
            console.log("🔄 Processing WebSocket message:", {
              newMessage: {
                id: newMessage.id,
                senderId: newMessage.senderId,
                content: newMessage.content?.substring(0, 50),
                isMe: newMessage.isMe,
              },
              currentUser: currentUser?.id,
              existingMessageCount: prev.length,
            });

            // Check for duplicates ONLY by message ID (true network duplicates)
            // Don't block repeated message content - users should be able to send the same message multiple times
            const isDuplicate = prev.some(
              (existingMsg) => existingMsg.id === newMessage.id
            );

            if (isDuplicate) {
              console.log(
                "🔄 Skipping duplicate message (same ID):",
                newMessage.id
              );
              return prev; // Don't add duplicate
            }

            // Check if this is the real message for an optimistic message
            const optimisticMessages = prev.filter(
              (msg) => typeof msg.id === "string" && msg.id.startsWith("temp-")
            );

            console.log("🔍 Looking for optimistic message to replace:", {
              optimisticCount: optimisticMessages.length,
              optimisticMessages: optimisticMessages.map((msg) => ({
                id: msg.id,
                content: msg.content?.substring(0, 30),
                senderId: msg.senderId,
                senderIdType: typeof msg.senderId,
                isMe: msg.isMe,
              })),
              newMessageContent: newMessage.content?.substring(0, 30),
              newMessageSenderId: newMessage.senderId,
              newMessageSenderIdType: typeof newMessage.senderId,
              newMessageIsMe: newMessage.isMe,
            });

            // Try to find matching optimistic message with detailed debugging
            let optimisticIndex = -1;
            for (let i = 0; i < prev.length; i++) {
              const msg = prev[i];
              if (typeof msg.id === "string" && msg.id.startsWith("temp-")) {
                const contentMatch = msg.content === newMessage.content;
                const senderIdMatch =
                  String(msg.senderId) === String(newMessage.senderId);

                console.log(`🔍 Checking optimistic message ${i}:`, {
                  optimisticId: msg.id,
                  optimisticContent: `"${msg.content?.substring(0, 30)}"`,
                  optimisticSenderId: msg.senderId,
                  optimisticSenderIdStr: `"${String(msg.senderId)}"`,
                  newMessageContent: `"${newMessage.content?.substring(
                    0,
                    30
                  )}"`,
                  newMessageSenderId: newMessage.senderId,
                  newMessageSenderIdStr: `"${String(newMessage.senderId)}"`,
                  contentMatch,
                  senderIdMatch,
                  WILL_MATCH: contentMatch && senderIdMatch,
                });

                if (contentMatch && senderIdMatch) {
                  optimisticIndex = i;
                  console.log(`🎯 PERFECT MATCH FOUND at index ${i}!`);
                  break;
                }
              }
            }

            if (optimisticIndex !== -1) {
              console.log(
                "✅ Found optimistic message to replace at index:",
                optimisticIndex
              );

              // Clear the timeout for the optimistic message
              const optimisticMsg = prev[optimisticIndex] as any;
              if (optimisticMsg.timeoutId) {
                clearTimeout(optimisticMsg.timeoutId);
                console.log(
                  "✅ Cleared optimistic message timeout - real message arrived"
                );
              }

              // Replace optimistic message with real message
              const updatedMessages = [...prev];
              updatedMessages[optimisticIndex] = newMessage;
              console.log(
                "✅ Successfully replaced optimistic message with real message"
              );
              return updatedMessages;
            }

            console.log(
              "❌ NO OPTIMISTIC MESSAGE MATCH FOUND - Adding as new message (this may cause issues)"
            );

            // Add new message efficiently
            const updatedMessages = [...prev, newMessage];

            // Only sort if needed (if new message is not at the end chronologically)
            const needsSort =
              prev.length > 0 &&
              new Date(
                newMessage.timestampRaw || newMessage.timestamp
              ).getTime() <
                new Date(
                  prev[prev.length - 1].timestampRaw ||
                    prev[prev.length - 1].timestamp
                ).getTime();

            if (needsSort) {
              updatedMessages.sort((a, b) => {
                const timeA = new Date(a.timestampRaw || a.timestamp).getTime();
                const timeB = new Date(b.timestampRaw || b.timestamp).getTime();
                return timeA - timeB;
              });
            }

            if (process.env.NODE_ENV === 'development') {
              console.log(
                "✅ Message processing complete, total messages:",
                updatedMessages.length
              );
            }
            return updatedMessages;
          });

          // Note: Notifications are now handled by the global WebSocket in NotificationContext

          // Notify parent component that there's a new message (updates conversation list)
          onConversationUpdated(newMessage.content);
        } else if (
          data.type === "post_deleted" &&
          data.group_id === chat.groupId
        ) {
          // Handle post deletion notification - optimistic update
          if (process.env.NODE_ENV === 'development') {
            console.log("🗑️ Post deleted:", data.post_id);
          }

          // Remove from posts list without refresh
          setGroupPosts((prevPosts) =>
            prevPosts.filter((post) => post.id !== data.post_id)
          );

          // Remove from messages if it's displayed there
          setMessages((prevMessages) =>
            prevMessages.filter((msg) => msg.id !== `post-${data.post_id}`)
          );

          // Close comments modal if it's open for this post
          if (selectedPostId === data.post_id) {
            setShowCommentsModal(false);
            setSelectedPostId(null);
            setPostComments([]);
            createNotification("This post was deleted", "bg-red-500");
          }

          // Show notification to user (if they weren't the one who deleted it)
          if (data.deleted_by !== currentUser?.id) {
            createNotification("🗑️ A post was deleted", "bg-red-500");
          }
        } else if (
          data.type === "event_deleted" &&
          data.group_id === chat.groupId
        ) {
          // Handle event deletion notification - optimistic update
          console.log("🗑️ Event deleted:", data.event_id);

          // Remove from events list without refresh
          setGroupEvents((prevEvents) =>
            prevEvents.filter((event) => event.id !== data.event_id)
          );

          // Show notification to user (if they weren't the one who deleted it)
          if (data.deleted_by !== currentUser?.id) {
            createNotification("🗑️ An event was deleted", "bg-red-500");
          }
        } else if (
          data.type === "comment_deleted" &&
          data.group_id === chat.groupId
        ) {
          // Handle comment deletion notification - comprehensive update
          console.log(
            "🗑️ Comment deleted:",
            data.comment_id,
            "from post:",
            data.post_id
          );

          // Remove comment from current view if comments modal is open
          if (showCommentsModal && selectedPostId === data.post_id) {
            setPostComments((prevComments) =>
              prevComments.filter((comment) => comment.id !== data.comment_id)
            );
          }

          // Immediately update comment count for all affected posts (optimistic + server sync)
          if (data.post_id) {
            // Optimistic count update first
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id === `post-${data.post_id}` && msg.postData) {
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

            setGroupPosts((prev) =>
              prev.map((post) => {
                if (post.id === data.post_id) {
                  return {
                    ...post,
                    commentsCount: Math.max(0, (post.commentsCount || 0) - 1),
                  };
                }
                return post;
              })
            );

            // Then sync with server for accuracy
            setTimeout(() => loadPostCommentsCount(data.post_id), 100);
          }

          // Show notification to user (if they weren't the one who deleted it)
          if (data.deleted_by !== currentUser?.id) {
            createNotification("🗑️ A comment was deleted", "bg-orange-500");
          }
        } else if (
          data.type === "post_created" &&
          data.group_id === chat.groupId
        ) {
          // Handle new post notification - add to state without full refresh
          console.log("📝 New post created:", data.post_id);

          if (data.created_by !== currentUser?.id) {
            // Add new post optimistically instead of full refresh
            if (data.post_data) {
              const newPost = {
                id: data.post_id,
                content: data.post_data.content,
                createdAt:
                  data.post_data.created_at || new Date().toISOString(),
                authorId: data.post_data.author_id,
                authorName: data.post_data.author_name,
                authorAvatar: data.post_data.author_avatar,
                imagePath: data.post_data.image_path,
                upvotes: data.post_data.upvotes || 0,
                downvotes: data.post_data.downvotes || 0,
                userVote: data.post_data.user_vote || 0,
                commentsCount: 0,
              };

              setGroupPosts((prevPosts) => [newPost, ...prevPosts]);

              // Add post to messages
              const postMessage: Message = {
                id: `post-${data.post_id}`,
                senderId: data.post_data.author_id,
                senderName: data.post_data.author_name,
                senderAvatar: data.post_data.author_avatar,
                content: data.post_data.content,
                timestamp: formatTimestamp(data.post_data.created_at),
                timestampRaw: data.post_data.created_at,
                isMe: false,
                type: "post" as const,
                postData: {
                  imagePath: data.post_data.image_path,
                  upvotes: data.post_data.upvotes || 0,
                  downvotes: data.post_data.downvotes || 0,
                  userVote: data.post_data.user_vote || 0,
                  commentsCount: 0,
                },
              };

              setMessages((prev) =>
                [...prev, postMessage].sort((a, b) => {
                  const timeA = new Date(
                    a.timestampRaw || a.timestamp
                  ).getTime();
                  const timeB = new Date(
                    b.timestampRaw || b.timestamp
                  ).getTime();
                  return timeA - timeB;
                })
              );
            }

            // Note: Notifications are now handled by the global WebSocket in NotificationContext
            createNotification("📝 New post added", "bg-green-500");
          }
        } else if (
          data.type === "event_created" &&
          data.group_id === chat.groupId
        ) {
          // Handle new event notification - add to state without full refresh
          console.log("📅 New event created:", data.event_id);

          if (data.created_by !== currentUser?.id) {
            // Add new event optimistically instead of full refresh
            if (data.event_data) {
              setGroupEvents((prevEvents) => [data.event_data, ...prevEvents]);
            }

            // Note: Notifications are now handled by the global WebSocket in NotificationContext
            createNotification("📅 New event added", "bg-blue-500");
          }
        } else if (
          data.type === "comment_created" &&
          data.group_id === chat.groupId
        ) {
          // Handle new comment notification - comprehensive update
          console.log(
            "💬 New comment created:",
            data.comment_id,
            "on post:",
            data.post_id
          );

          if (data.created_by !== currentUser?.id) {
            // Update comments if the modal is open for this post
            if (
              showCommentsModal &&
              selectedPostId === data.post_id &&
              data.comment_data
            ) {
              setPostComments((prevComments) => [
                ...prevComments,
                data.comment_data,
              ]);
            }

            // Immediately update comment count for all affected posts (optimistic + server sync)
            if (data.post_id) {
              // Optimistic count update first
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id === `post-${data.post_id}` && msg.postData) {
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

              setGroupPosts((prev) =>
                prev.map((post) => {
                  if (post.id === data.post_id) {
                    return {
                      ...post,
                      commentsCount: (post.commentsCount || 0) + 1,
                    };
                  }
                  return post;
                })
              );

              // Then sync with server for accuracy
              setTimeout(() => loadPostCommentsCount(data.post_id), 100);
            }

            // Note: Notifications are now handled by the global WebSocket in NotificationContext
            createNotification("💬 New comment added", "bg-purple-500");
          }
        }
      } catch (error) {
        console.error("❌ Error parsing WebSocket message:", error);
      }
    };

    newSocket.onerror = (error) => {
      if (connectionCancelled) return;
      
      console.error("❌ WebSocket error occurred:", error);
      setError(
        "WebSocket connection failed. Check if the server is running. Falling back to polling."
      );
      wsConnected = false;
      if (connectionTimeout) clearTimeout(connectionTimeout);
    };

    newSocket.onclose = (event) => {
      if (process.env.NODE_ENV === 'development') {
        console.log("🔌 WebSocket connection closed");
      }
      wsConnected = false;
      if (connectionTimeout) clearTimeout(connectionTimeout);

      // Show error message if connection was closed unexpectedly (but not if cancelled)
      if (!event.wasClean && event.code !== 1000 && !connectionCancelled) {
        setError(
          `WebSocket connection lost (${event.code}). Using polling instead.`
        );
      }
    };

    setSocket(newSocket);

    // Polling fallback - much less aggressive
    const startPolling = () => {
      // Only start polling if WebSocket is not connected and not cancelled
      if (!wsConnected && !connectionCancelled) {
        if (process.env.NODE_ENV === 'development') {
          console.log("🔄 Starting polling fallback");
        }
        // Poll every 10 seconds (reduced from 3 seconds)
        pollingInterval = setInterval(() => {
          // Only poll if window is visible and connection not cancelled
          if (!document.hidden && !connectionCancelled) {
            fetchLatestMessagesQuietly();
          }
        }, 10000);
      }
    };

    // Give WebSocket 5 seconds to connect, then start polling if needed
    pollingTimeout = setTimeout(() => {
      if (!wsConnected && !connectionCancelled) {
        if (process.env.NODE_ENV === 'development') {
          console.log("⏰ WebSocket didn't connect in time, starting polling");
        }
        startPolling();
      }
    }, 5000);

    // Cleanup function
    return () => {
      if (process.env.NODE_ENV === 'development') {
        console.log("🧹 Cleaning up WebSocket connection");
      }
      
      // Cancel connection to prevent race conditions
      connectionCancelled = true;
      
      // Clear all timeouts and intervals
      if (connectionTimeout) clearTimeout(connectionTimeout);
      if (pollingTimeout) clearTimeout(pollingTimeout);
      if (pollingInterval) clearInterval(pollingInterval);
      
      // Close socket if open
      if (newSocket && newSocket.readyState === WebSocket.OPEN) {
        newSocket.close(1000, "Component unmounting");
      }
    };
  }, [chat.id, currentUser]);

  // Quiet polling function that doesn't cause visible refreshes
  const fetchLatestMessagesQuietly = async () => {
    if (!chat.id || !currentUser) return;

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      // Only fetch new messages, not all messages
      const lastMessage = messages[messages.length - 1];
      const lastTimestamp = lastMessage?.timestampRaw || lastMessage?.timestamp;

      const response = await fetch(
        `${backendUrl}/api/conversations/${chat.id}/messages${
          lastTimestamp ? `?after=${encodeURIComponent(lastTimestamp)}` : ""
        }`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();

        if (data.messages && data.messages.length > 0) {
          const newMessages = data.messages.map((msg: any) => ({
            id: `msg-${msg.id}`,
            senderId: msg.sender.id,
            senderName: `${msg.sender.first_name} ${msg.sender.last_name}`,
            senderAvatar: msg.sender.avatar,
            content: msg.content,
            timestamp: formatTimestamp(msg.created_at),
            timestampRaw: msg.created_at,
            isMe:
              String(msg.sender.id) === String(currentUser?.id) ||
              Number(msg.sender.id) === Number(currentUser?.id),
            type: "message" as const,
          }));

          // Only add truly new messages
          setMessages((prev) => {
            const filteredNewMessages = newMessages.filter(
              (newMsg: Message) =>
                !prev.some((existingMsg) => existingMsg.id === newMsg.id)
            );

            if (filteredNewMessages.length === 0) return prev;

            return [...prev, ...filteredNewMessages].sort((a, b) => {
              const timeA = new Date(a.timestampRaw || a.timestamp).getTime();
              const timeB = new Date(b.timestampRaw || b.timestamp).getTime();
              return timeA - timeB;
            });
          });

          // Update conversation list only if there are new messages
          if (newMessages.length > 0) {
            const lastMessage = newMessages[newMessages.length - 1];
            onConversationUpdated(lastMessage.content);
          }
        }
      }
    } catch (error) {
      console.error("Error polling messages quietly:", error);
    }
  };

  // Function to fetch the latest messages (deprecated - replaced by fetchLatestMessagesQuietly)
  const fetchLatestMessages = async () => {
    if (!chat.id || !currentUser) return;
    // This function is now deprecated to prevent visible refreshes
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        "fetchLatestMessages is deprecated - using quiet polling instead"
      );
    }
  };

  // Function to fetch and combine messages with posts for group chats (initial load only)
  const fetchMessagesWithPosts = async (isInitialLoad = false) => {
    if (!chat.id || !currentUser) {
      if (process.env.NODE_ENV === 'development') {
        console.log("❌ fetchMessagesWithPosts: Missing chat.id or currentUser", { chatId: chat.id, currentUser: currentUser?.id });
      }
      return;
    }

    // Only do full reload on initial load, otherwise use smart merging
    if (!isInitialLoad && messages.length > 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log("Skipping full reload - use smart updates instead");
      }
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log("🔍 fetchMessagesWithPosts: Starting initial load for chat", chat.id);
    }

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      console.log("📡 fetchMessagesWithPosts: Fetching messages from API", `${backendUrl}/api/conversations/${chat.id}/messages`);

      // Fetch regular messages
      const messagesResponse = await fetch(
        `${backendUrl}/api/conversations/${chat.id}/messages`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      console.log("📡 fetchMessagesWithPosts: API response received", {
        status: messagesResponse.status,
        statusText: messagesResponse.statusText,
        ok: messagesResponse.ok,
        url: `${backendUrl}/api/conversations/${chat.id}/messages`
      });

      let allMessages: Message[] = [];

      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json();
        console.log("📡 fetchMessagesWithPosts: Messages data received", {
          hasMessages: !!messagesData.messages,
          messagesCount: messagesData.messages?.length || 0,
          messagesData: messagesData
        });

        if (messagesData.messages && Array.isArray(messagesData.messages)) {
          const formattedMessages: Message[] = messagesData.messages.map(
            (msg: any) => {
              const isCurrentUser =
                String(msg.sender.id) === String(currentUser?.id) ||
                Number(msg.sender.id) === Number(currentUser?.id);

              console.log("🔍 fetchMessagesWithPosts: Processing message", {
                messageId: msg.id,
                senderId: msg.sender.id,
                content: msg.content?.substring(0, 50),
                isCurrentUser,
                currentUserId: currentUser?.id
              });

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
          console.log("✅ fetchMessagesWithPosts: Formatted messages", { count: formattedMessages.length });
        } else {
          console.log("❌ fetchMessagesWithPosts: No messages in response or not an array");
        }
      } else {
        console.error("❌ fetchMessagesWithPosts: API response not ok", {
          status: messagesResponse.status,
          statusText: messagesResponse.statusText,
          url: `${backendUrl}/api/conversations/${chat.id}/messages`,
          chatId: chat.id,
          currentUserId: currentUser?.id
        });
        // Try to get error details
        try {
          const errorData = await messagesResponse.text();
          console.error("❌ fetchMessagesWithPosts: Error response body", errorData);
        } catch (e) {
          console.error("❌ fetchMessagesWithPosts: Could not read error response", e);
        }
      }

      // If it's a group chat, also fetch posts
      if (chat.isGroup && chat.groupId) {
        console.log("🔍 fetchMessagesWithPosts: Fetching group posts for group", chat.groupId);
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
            console.log("✅ fetchMessagesWithPosts: Added group posts", { postsCount: formattedPosts.length });
          }
        }
      }

      // Sort all messages by timestamp (oldest first)
      allMessages.sort((a, b) => {
        const timeA = new Date(a.timestampRaw || a.timestamp).getTime();
        const timeB = new Date(b.timestampRaw || b.timestamp).getTime();
        return timeA - timeB;
      });

      console.log("✅ fetchMessagesWithPosts: Final message count", { totalMessages: allMessages.length });
      setMessages(allMessages);
    } catch (error) {
      console.error("❌ fetchMessagesWithPosts: Exception occurred", error);
      setError("Failed to load messages. Please try again later.");
    }
  };

  // Load messages for the current conversation
  useEffect(() => {
    const loadInitialData = async () => {
      if (!chat.id) return;

      setIsLoading(true);
      setError(null);

      try {
        await fetchMessagesWithPosts(true); // Mark as initial load
      } catch (error) {
        console.error("Error fetching messages:", error);
        setError("Failed to load messages. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
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

    // Generate unique ID with more precision to avoid collisions in rapid sending
    const optimisticId = `temp-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Add optimistic message immediately for better UX
    const optimisticMessage: Message = {
      id: optimisticId,
      senderId: currentUser?.id || 0,
      senderName:
        currentUser?.firstName && currentUser?.lastName
          ? `${currentUser.firstName} ${currentUser.lastName}`
          : "You",
      senderAvatar: currentUser?.avatar,
      content: messageContent,
      timestamp: formatTimestamp(new Date().toISOString()),
      timestampRaw: new Date().toISOString(),
      isMe: true,
      type: "message" as const,
    };

    console.log("📤 Creating optimistic message (SPAM-SAFE):", {
      id: optimisticMessage.id,
      senderId: optimisticMessage.senderId,
      content: `"${optimisticMessage.content}"`,
      currentUserId: currentUser?.id,
      timestamp: new Date().toISOString(),
    });

    // Add optimistic message to UI immediately
    setMessages((prev) => {
      console.log(
        "➕ Adding optimistic message to UI, total messages will be:",
        prev.length + 1,
        `Content: "${messageContent}"`
      );
      return [...prev, optimisticMessage];
    });

    try {
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

        // Set a timeout to convert optimistic message to permanent if WebSocket doesn't echo back
        const optimisticTimeout = setTimeout(() => {
          setMessages((prev) => {
            // Check if the optimistic message still exists
            const optimisticIndex = prev.findIndex(
              (msg) => msg.id === optimisticMessage.id
            );

            if (optimisticIndex !== -1) {
              console.log(
                "⏰ TIMEOUT: Converting optimistic message to permanent (WebSocket didn't echo back)",
                {
                  optimisticId: optimisticMessage.id,
                  optimisticContent: optimisticMessage.content?.substring(
                    0,
                    30
                  ),
                  optimisticSenderId: optimisticMessage.senderId,
                  totalMessages: prev.length,
                }
              );

              // Convert optimistic message to permanent by changing its ID
              const updatedMessages = [...prev];
              updatedMessages[optimisticIndex] = {
                ...optimisticMessage,
                id: `permanent-${Date.now()}`, // Change from temp- to permanent-
              };

              return updatedMessages;
            }

            console.log(
              "✅ TIMEOUT: Optimistic message was already replaced, no action needed"
            );
            return prev;
          });
        }, 3000); // Give 3 seconds for WebSocket echo, then make it permanent

        // Store the timeout ID for potential cleanup
        (optimisticMessage as any).timeoutId = optimisticTimeout;

        return;
      }

      console.log("📤 Sending via REST API (WebSocket not available)");
      // Fallback to REST API
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

      const result = await response.json();
      console.log("✅ Message sent via REST API");

      // Replace optimistic message with real message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === optimisticMessage.id
            ? {
                ...optimisticMessage,
                id: `msg-${result.id || Date.now()}`,
              }
            : msg
        )
      );

      // Update conversation list
      onConversationUpdated(messageContent);
    } catch (error) {
      console.error("❌ Error sending message via API:", error);
      setError("Failed to send message. Please try again.");

      // Remove optimistic message on error
      setMessages((prev) =>
        prev.filter((msg) => msg.id !== optimisticMessage.id)
      );
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

    // Validate date and time
    if (!newEvent.date || !newEvent.time) {
      showWarning(
        "Event Details Required",
        "Please select both date and time for the event."
      );
      return;
    }

    // Create date object and validate it's in the future
    const selectedDate = new Date(newEvent.date + "T" + newEvent.time);
    const currentDate = new Date();

    // Check if the date is valid
    if (isNaN(selectedDate.getTime())) {
      showError("Invalid Date", "Please enter a valid date and time.");
      return;
    }

    // Check if the selected date is in the future (at least 1 minute from now)
    if (selectedDate <= currentDate) {
      showWarning(
        "Future Date Required",
        "Event must be scheduled in the future. Please select a later date and time."
      );
      return;
    }

    // Debug logging
    console.log("=== CREATE EVENT DEBUG ===");
    console.log("chat object:", JSON.stringify(chat, null, 2));
    console.log("chat.groupId:", chat.groupId);
    console.log("chat.isGroup:", chat.isGroup);
    console.log("typeof chat.groupId:", typeof chat.groupId);
    console.log("Raw date:", newEvent.date);
    console.log("Raw time:", newEvent.time);
    console.log("Selected date:", selectedDate);
    console.log("Current date:", currentDate);
    console.log("Is future date:", selectedDate >= currentDate);
    console.log("========================");

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      // Use group ID for API call
      const groupIdForEvent = chat.groupId;
      if (!groupIdForEvent) {
        console.error("No group ID available for creating event");
        console.error("Full chat object:", chat);
        showError(
          "Event Creation Error",
          "Cannot create event. Please refresh the page and try again."
        );
        return;
      }

      // Format date and time for backend
      const formattedDate = selectedDate.toISOString().split("T")[0]; // YYYY-MM-DD
      const formattedTime = newEvent.time; // Keep user's time input as-is

      const requestData = {
        title: newEvent.title.trim(),
        description: newEvent.description.trim(),
        date: formattedDate,
        time: formattedTime,
      };

      console.log(
        "Request URL:",
        `${backendUrl}/api/groups/${groupIdForEvent}/events`
      );
      console.log("Request data:", requestData);
      console.log("Formatted date:", formattedDate);
      console.log("Formatted time:", formattedTime);

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
        const createdEvent = await response.json();
        console.log("Event created successfully:", createdEvent);

        // Add the new event to the list immediately (optimistic update)
        setGroupEvents((prevEvents) => [...prevEvents, createdEvent]);

        setShowEventModal(false);
        setNewEvent({ title: "", description: "", date: "", time: "" });
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

        showError(
          "Event Creation Failed",
          `Error creating event: ${errorMessage}`
        );
      }
    } catch (error) {
      console.error("Error creating event:", error);
      showError(
        "Network Error",
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
        console.log("=== EVENTS API RESPONSE ===");
        console.log("Events data:", data);
        console.log("Events array:", data.events);
        console.log("============================");
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
        showError(
          "Post Creation Error",
          "Cannot create post. Please refresh the page and try again."
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
        createNotification("Post created successfully! 🎉", "bg-green-500");

        // Get the response data
        const responseData = await response.json();

        // Add new post optimistically to local state
        const createdPost = {
          id: responseData.id || Date.now(),
          content: newPost.content,
          createdAt: new Date().toISOString(),
          authorId: Number(currentUser?.id) || 0,
          authorName:
            currentUser?.firstName && currentUser?.lastName
              ? `${currentUser.firstName} ${currentUser.lastName}`
              : "You",
          authorAvatar: currentUser?.avatar,
          imagePath: responseData.image_path,
          upvotes: 0,
          downvotes: 0,
          userVote: 0,
          commentsCount: 0,
        };

        // Add to posts list
        setGroupPosts((prev) => [createdPost, ...prev]);

        // Add to messages
        const postMessage: Message = {
          id: `post-${createdPost.id}`,
          senderId: createdPost.authorId,
          senderName: createdPost.authorName,
          senderAvatar: createdPost.authorAvatar,
          content: createdPost.content,
          timestamp: formatTimestamp(createdPost.createdAt),
          timestampRaw: createdPost.createdAt,
          isMe: true,
          type: "post" as const,
          postData: {
            imagePath: createdPost.imagePath,
            upvotes: createdPost.upvotes,
            downvotes: createdPost.downvotes,
            userVote: createdPost.userVote,
            commentsCount: createdPost.commentsCount,
          },
        };

        setMessages((prev) =>
          [...prev, postMessage].sort((a, b) => {
            const timeA = new Date(a.timestampRaw || a.timestamp).getTime();
            const timeB = new Date(b.timestampRaw || b.timestamp).getTime();
            return timeA - timeB;
          })
        );
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

        showError(
          "Post Creation Failed",
          `Error creating post: ${errorMessage}`
        );
      }
    } catch (error) {
      console.error("Error creating post:", error);
      showError(
        "Network Error",
        "Network error creating post. Please check your connection and try again."
      );
    }
  };

  const handleDeletePost = async (postId: number) => {
    if (!confirm("Are you sure you want to delete this post?")) {
      return;
    }

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      const res = await fetch(`${backendUrl}/api/groups/posts/${postId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.ok) {
        console.log("Post deleted successfully");

        // Remove post from the list immediately (optimistic update)
        setGroupPosts((prevPosts) =>
          prevPosts.filter((post) => post.id !== postId)
        );
        setMessages((prevMessages) =>
          prevMessages.filter((msg) => msg.id !== `post-${postId}`)
        );

        // Send WebSocket notification to other users in the group
        if (socket && socket.readyState === WebSocket.OPEN && chat.groupId) {
          socket.send(
            JSON.stringify({
              type: "post_deleted",
              group_id: chat.groupId,
              post_id: postId,
              deleted_by: currentUser?.id,
            })
          );
        }
      } else {
        const errorText = await res.text();
        console.error("Failed to delete post:", res.status, errorText);
        showError("Delete Failed", "Failed to delete post. Please try again.");
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      showError(
        "Delete Error",
        "Error deleting post. Please check your connection."
      );
    }
  };

  const handleDeleteEvent = async (eventId: number) => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      console.log("Deleting event:", eventId);

      const res = await fetch(`${backendUrl}/api/groups/events/${eventId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (res.ok) {
        console.log("Event deleted successfully");

        // Remove event from the list immediately (optimistic update)
        setGroupEvents((prevEvents) =>
          prevEvents.filter((event) => event.id !== eventId)
        );

        // Send WebSocket notification to other users in the group
        if (socket && socket.readyState === WebSocket.OPEN && chat.groupId) {
          socket.send(
            JSON.stringify({
              type: "event_deleted",
              group_id: chat.groupId,
              event_id: eventId,
              deleted_by: currentUser?.id,
            })
          );
        }
      } else {
        const errorText = await res.text();
        console.error("Failed to delete event:", res.status, errorText);
        showError(
          "Delete Failed",
          "Failed to delete event. You may not have permission."
        );
      }
    } catch (error) {
      console.error("Error deleting event:", error);
      showError("Delete Error", "Error deleting event. Please try again.");
    }
  };

  const respondToEvent = async (
    eventId: number,
    response: "going" | "not_going"
  ) => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      console.log("Responding to event:", eventId, "with response:", response);

      // Optimistic update - update UI immediately
      setGroupEvents((prevEvents) =>
        prevEvents.map((event) => {
          if (event.id === eventId) {
            const updatedEvent = { ...event };

            // Update user response
            const oldResponse = updatedEvent.user_response;
            // Only update user_response if we're not removing the vote
            if (!(oldResponse === response)) {
              updatedEvent.user_response = response;
            }

            // Update counts optimistically - handle single choice logic
            if (oldResponse && oldResponse !== response) {
              // User is changing their vote - remove old vote first
              if (oldResponse === "going") {
                updatedEvent.going_count = Math.max(
                  0,
                  (updatedEvent.going_count || 0) - 1
                );
              } else if (oldResponse === "not_going") {
                updatedEvent.not_going_count = Math.max(
                  0,
                  (updatedEvent.not_going_count || 0) - 1
                );
              }

              // Add new vote
              if (response === "going") {
                updatedEvent.going_count = (updatedEvent.going_count || 0) + 1;
              } else if (response === "not_going") {
                updatedEvent.not_going_count =
                  (updatedEvent.not_going_count || 0) + 1;
              }
            } else if (oldResponse === response) {
              // User is clicking the same option - remove their vote (toggle off)
              if (response === "going") {
                updatedEvent.going_count = Math.max(
                  0,
                  (updatedEvent.going_count || 0) - 1
                );
              } else if (response === "not_going") {
                updatedEvent.not_going_count = Math.max(
                  0,
                  (updatedEvent.not_going_count || 0) - 1
                );
              }
              updatedEvent.user_response = null; // Remove their response
            } else if (!oldResponse) {
              // User is voting for the first time
              if (response === "going") {
                updatedEvent.going_count = (updatedEvent.going_count || 0) + 1;
              } else if (response === "not_going") {
                updatedEvent.not_going_count =
                  (updatedEvent.not_going_count || 0) + 1;
              }
            }

            return updatedEvent;
          }
          return event;
        })
      );

      // Determine what to send to backend
      const eventToUpdate = groupEvents.find((e) => e.id === eventId);
      const actualResponse =
        eventToUpdate?.user_response === response ? "remove" : response;

      const res = await fetch(
        `${backendUrl}/api/groups/events/${eventId}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ response: actualResponse }),
          credentials: "include",
        }
      );

      if (res.ok) {
        const updatedEvent = await res.json();
        console.log(
          "Response successful, updating with server data:",
          updatedEvent
        );

        // Update with actual server data
        setGroupEvents((prevEvents) =>
          prevEvents.map((event) =>
            event.id === eventId ? updatedEvent : event
          )
        );
      } else {
        const errorText = await res.text();
        console.error("Failed to respond to event:", res.status, errorText);

        // Check if it's a "not found" error (event was deleted)
        if (res.status === 404) {
          // Remove the event from local state
          setGroupEvents((prevEvents) =>
            prevEvents.filter((event) => event.id !== eventId)
          );

          // Notify other users via WebSocket
          if (socket && socket.readyState === WebSocket.OPEN && chat.groupId) {
            socket.send(
              JSON.stringify({
                type: "content_error",
                content_type: "event",
                content_id: eventId,
                group_id: chat.groupId,
                message: "Event no longer exists",
              })
            );
          }

          showError(
            "Event Unavailable",
            "This event has been deleted and is no longer available."
          );
        } else {
          // Revert optimistic update on other errors
          await loadGroupEvents();
        }
      }
    } catch (error) {
      console.error("Error responding to event:", error);
      // Revert optimistic update on error
      await loadGroupEvents();
    }
  };

  // Load group data when chat changes
  useEffect(() => {
    if (chat.isGroup) {
      loadGroupEvents();
      loadGroupPosts();
      loadGroupInfo();
    }
  }, [chat.id, chat.isGroup, chat.groupId]);

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
        // If we can't load group info, we'll rely on fallback logic
        // but let's at least log this for debugging
        if (response.status === 403) {
          console.warn(
            "Permission denied when loading group info - user might not be a member"
          );
        } else if (response.status === 404) {
          console.warn("Group not found - it might have been deleted");
        }
      }
    } catch (error) {
      console.error("Error loading group info:", error);
    }
  };

  const handleDeleteGroup = async () => {
    console.log("=== Starting Group Deletion Process ===");
    console.log("Initial state:", {
      chatId: chat.id,
      chatGroupId: chat.groupId,
      groupInfoId: groupInfo?.id,
      isGroup: chat.isGroup,
    });

    if (!chat.isGroup) {
      console.error("❌ Cannot delete: Not a group chat");
      showWarning("Not a Group", "This is not a group chat. Cannot delete.");
      return;
    }

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
          } else {
            console.error(
              "Failed to fetch conversation info:",
              await groupInfoResponse.text()
            );
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

        showError(
          "Cannot Delete Group",
          "Cannot determine group ID for deletion. Please refresh the page and try again."
        );
        return;
      }

      // Double-check the group ID is reasonable
      if (groupIdToDelete < 1 || groupIdToDelete > 999999) {
        console.error(
          `❌ Group ID ${groupIdToDelete} seems invalid (outside reasonable range)`
        );
        showError(
          "Invalid Group ID",
          `Invalid group ID (${groupIdToDelete}). Please refresh and try again.`
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
      const responseText = await response.text();
      console.log("Raw response text:", responseText);

      if (response.ok) {
        console.log("✅ Group deleted successfully");
        setShowDeleteConfirm(false);
        // Refresh the conversation list and go back to no selected chat
        onConversationUpdated();
        showSuccess("Group Deleted", "Group deleted successfully!");
        // Redirect to chats page
        window.location.href = "/chats";
      } else {
        // Get the actual error message from the response
        let errorMessage = "Failed to delete group. Please try again.";
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorData.error || errorMessage;
          console.error("Delete error response:", errorData);
        } catch (e) {
          console.error("Could not parse error response:", e);
          console.error("Response was not valid JSON");
        }

        console.error(`❌ Delete failed with status: ${response.status}`);

        if (response.status === 404) {
          showError(
            "Group Not Found",
            "The group may have already been deleted or the ID is incorrect. Please refresh the page to see the updated group list."
          );
        } else if (response.status === 403) {
          showError(
            "Permission Denied",
            "You don't have permission to delete this group. Only the group creator can delete the group."
          );
        } else {
          showError("Delete Failed", `Error: ${errorMessage}`);
        }
      }
    } catch (error) {
      console.error("❌ Network error deleting group:", error);
      showError(
        "Network Error",
        "Network error occurred while deleting group. Please check your connection and try again."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLeaveGroup = async () => {
    console.log("=== Starting Group Leave Process ===");

    if (!chat.isGroup) {
      console.error("❌ Cannot leave: Not a group chat");
      showWarning("Not a Group", "This is not a group chat. Cannot leave.");
      return;
    }

    setIsDeleting(true);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      // Get group ID using the same logic as delete
      let groupIdToLeave: number | null = null;

      if (
        chat.groupId &&
        typeof chat.groupId === "number" &&
        chat.groupId > 0
      ) {
        groupIdToLeave = chat.groupId;
      } else if (
        groupInfo &&
        groupInfo.id &&
        typeof groupInfo.id === "number" &&
        groupInfo.id > 0
      ) {
        groupIdToLeave = groupInfo.id;
      }

      if (!groupIdToLeave || groupIdToLeave <= 0) {
        showError(
          "Cannot Leave Group",
          "Cannot determine group ID for leaving. Please refresh and try again."
        );
        return;
      }

      console.log(`✅ Leaving group with ID: ${groupIdToLeave}`);

      const response = await fetch(
        `${backendUrl}/api/groups/${groupIdToLeave}/leave`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (response.ok) {
        console.log("✅ Left group successfully");
        setShowLeaveConfirm(false);
        onConversationUpdated();
        showSuccess("Left Group", "You have left the group successfully!");
        // Redirect to chats page
        window.location.href = "/chats";
      } else {
        const responseText = await response.text();
        let errorMessage = "Failed to leave group. Please try again.";

        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          // Response was not JSON, use default message
        }

        console.error(`❌ Leave failed with status: ${response.status}`);
        showError("Leave Failed", `Error: ${errorMessage}`);
      }
    } catch (error) {
      console.error("❌ Network error leaving group:", error);
      showError(
        "Network Error",
        "Network error occurred while leaving group. Please check your connection and try again."
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
          (user: { id: number }) => !currentMemberIds.has(user.id)
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
        showError("Group ID Error", "Cannot determine group ID");
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
        // For private groups, don't add members to UI immediately since they need to accept invitations
        // For public groups, add members immediately
        if (chat.members && selectedMembers.length > 0) {
          const responseData = await response.json();

          // Only add to UI if they were actually added as members (not just invited)
          if (
            responseData.added_members &&
            responseData.added_members.length > 0
          ) {
            // Get the user details for the newly added members from followingUsers
            const newMembers = followingUsers
              .filter((user) => responseData.added_members.includes(user.id))
              .map((user) => ({
                id: user.id,
                name: `${user.firstName} ${user.lastName}`,
                avatar: user.avatar,
                status: "active",
              }));

            // Add the new members to the existing members array
            chat.members = [...chat.members, ...newMembers];
          }
        }

        setShowAddMemberModal(false);
        setSelectedMembers([]);
        // Also refresh conversation data to ensure consistency
        onConversationUpdated();

        // Show appropriate success message based on response
        showSuccess("Members Added", "Operation completed successfully!");
      } else {
        const errorData = await response.json();
        showError(
          "Add Members Failed",
          `Failed to add members: ${errorData.message || "Unknown error"}`
        );
      }
    } catch (error) {
      console.error("Error adding members:", error);
      showError("Add Members Error", "Error adding members. Please try again.");
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
        showError("Group ID Error", "Cannot determine group ID");
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
        showSuccess(
          "Member Removed",
          `${member.name} has been removed from the group.`
        );
      } else {
        const errorData = await response.json();
        showError(
          "Remove Member Failed",
          `Failed to remove member: ${errorData.message || "Unknown error"}`
        );
      }
    } catch (error) {
      console.error("Error removing member:", error);
      showError(
        "Remove Member Error",
        "Error removing member. Please try again."
      );
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
      // Optimistic update first - both in messages and posts
      const updateVote = (
        currentVote: number,
        upvotes: number,
        downvotes: number
      ) => {
        const newVote = currentVote === voteType ? 0 : voteType;

        let newUpvotes = upvotes;
        let newDownvotes = downvotes;

        // Remove old vote
        if (currentVote === 1) newUpvotes--;
        if (currentVote === -1) newDownvotes--;

        // Add new vote
        if (newVote === 1) newUpvotes++;
        if (newVote === -1) newDownvotes++;

        return { newVote, newUpvotes, newDownvotes };
      };

      // Update messages optimistically
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === `post-${postId}` && msg.postData) {
            const { newVote, newUpvotes, newDownvotes } = updateVote(
              msg.postData.userVote || 0,
              msg.postData.upvotes || 0,
              msg.postData.downvotes || 0
            );

            return {
              ...msg,
              postData: {
                ...msg.postData,
                upvotes: newUpvotes,
                downvotes: newDownvotes,
                userVote: newVote,
              },
            };
          }
          return msg;
        })
      );

      // Update posts list optimistically
      setGroupPosts((prev) =>
        prev.map((post) => {
          if (post.id === postId) {
            const { newVote, newUpvotes, newDownvotes } = updateVote(
              post.userVote || 0,
              post.upvotes || 0,
              post.downvotes || 0
            );

            return {
              ...post,
              user_vote: newVote,
              upvotes: newUpvotes,
              downvotes: newDownvotes,
            };
          }
          return post;
        })
      );

      // Send request to server
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

        // Update with server response (in case of any discrepancies)
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

        setGroupPosts((prev) =>
          prev.map((post) => {
            if (post.id === postId) {
              return {
                ...post,
                user_vote: data.user_vote,
                upvotes: data.upvotes,
                downvotes: data.downvotes,
              };
            }
            return post;
          })
        );

        console.log(`Post ${postId} vote updated successfully`);
      } else {
        console.error("Failed to vote on post");

        // Check if it's a "not found" error (post was deleted)
        if (response.status === 404) {
          // Remove the post from local state
          setGroupPosts((prevPosts) =>
            prevPosts.filter((post) => post.id !== postId)
          );
          setMessages((prevMessages) =>
            prevMessages.filter((msg) => msg.id !== `post-${postId}`)
          );

          createNotification("This post was deleted", "bg-red-500");
        } else {
          // Revert optimistic update on other errors
          // We could implement a more sophisticated revert here
          console.warn("Vote failed, optimistic update may be incorrect");
        }
      }
    } catch (error) {
      console.error("Error voting on post:", error);
      // Could revert optimistic update here
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
    // Also sync the comment count when opening the modal
    loadPostCommentsCount(postId);
  };

  const handleSubmitComment = async () => {
    // Allow either text content or image, but require at least one
    if ((!newComment.trim() && !newCommentImage) || !selectedPostId) return;

    const commentContent = newComment.trim();
    const commentImage = newCommentImage;
    setNewComment("");
    setNewCommentImage(null);
    setIsSubmittingComment(true);

    // Generate unique optimistic ID
    const optimisticId = `temp-comment-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Optimistic comment addition
    const optimisticComment: Comment = {
      id: optimisticId, // Use string ID for optimistic comment
      content: commentContent || "",
      image_path: commentImage ? URL.createObjectURL(commentImage) : undefined, // Backend field name
      imagePath: commentImage ? URL.createObjectURL(commentImage) : undefined, // Compatibility
      authorId: Number(currentUser?.id) || 0,
      authorName:
        currentUser?.firstName && currentUser?.lastName
          ? `${currentUser.firstName} ${currentUser.lastName}`
          : "You",
      authorAvatar: currentUser?.avatar,
      created_at: new Date().toISOString(), // Use backend field name
      createdAt: new Date().toISOString(), // Also keep frontend format for compatibility
      upvotes: 0,
      downvotes: 0,
      userVote: 0,
    };

    console.log("🔄 Creating optimistic comment:", {
      id: optimisticId,
      content: commentContent || "[image only]",
      hasImage: !!commentImage,
      imagePath: optimisticComment.imagePath,
    });

    // Add comment optimistically to the UI
    setPostComments((prev) => [...prev, optimisticComment]);

    // Update comment count optimistically
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

    setGroupPosts((prev) =>
      prev.map((post) => {
        if (post.id === selectedPostId) {
          return {
            ...post,
            commentsCount: (post.commentsCount || 0) + 1,
          };
        }
        return post;
      })
    );

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      // Use FormData if there's an image, otherwise use JSON
      let requestOptions: RequestInit;

      if (commentImage) {
        const formData = new FormData();
        if (commentContent) formData.append("content", commentContent);
        formData.append("image", commentImage);

        requestOptions = {
          method: "POST",
          body: formData,
          credentials: "include",
        };

        console.log("📤 Sending comment with image via FormData");
      } else {
        requestOptions = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: commentContent }),
          credentials: "include",
        };

        console.log("📤 Sending text-only comment via JSON");
      }

      const response = await fetch(
        `${backendUrl}/api/groups/posts/${selectedPostId}/comments`,
        requestOptions
      );

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Comment submitted successfully:", result);
        console.log("🔍 Comment fields:", {
          id: result.id,
          content: result.content,
          image_path: result.image_path,
          imagePath: result.imagePath,
          created_at: result.created_at,
          createdAt: result.createdAt,
        });

        // Clean up blob URL
        const blobUrl =
          optimisticComment.image_path || optimisticComment.imagePath;
        if (blobUrl && blobUrl.startsWith("blob:")) {
          URL.revokeObjectURL(blobUrl);
        }

        // Replace optimistic comment with real comment from server
        setPostComments((prev) =>
          prev.map((comment) =>
            comment.id === optimisticId ? result : comment
          )
        );

        // Reload comment count to ensure accuracy
        await loadPostCommentsCount(selectedPostId);

        console.log("💬 Comment submitted successfully");
      } else {
        console.error("❌ Failed to submit comment - Status:", response.status);

        let errorText = "";
        try {
          errorText = await response.text();
          console.error("❌ Error response:", errorText);
        } catch (e) {
          console.error("❌ Failed to read error response:", e);
          errorText = "Unknown server error";
        }

        // Clean up blob URL and remove optimistic comment on error
        const blobUrl =
          optimisticComment.image_path || optimisticComment.imagePath;
        if (blobUrl && blobUrl.startsWith("blob:")) {
          URL.revokeObjectURL(blobUrl);
        }

        setPostComments((prev) =>
          prev.filter((comment) => comment.id !== optimisticId)
        );

        // Revert comment count
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

        setGroupPosts((prev) =>
          prev.map((post) => {
            if (post.id === selectedPostId) {
              return {
                ...post,
                commentsCount: Math.max(0, (post.commentsCount || 0) - 1),
              };
            }
            return post;
          })
        );

        // Check if it's a "not found" error (post was deleted)
        if (response.status === 404) {
          setGroupPosts((prevPosts) =>
            prevPosts.filter((post) => post.id !== selectedPostId)
          );
          setMessages((prevMessages) =>
            prevMessages.filter((msg) => msg.id !== `post-${selectedPostId}`)
          );
          setShowCommentsModal(false);
          createNotification("This post was deleted", "bg-red-500");
        } else {
          // Parse error message for better user feedback with better error handling
          let errorMessage = "Failed to submit comment";

          if (errorText) {
            try {
              const errorData = JSON.parse(errorText);
              errorMessage =
                errorData.message || errorData.error || errorMessage;
            } catch (e) {
              // If JSON parsing fails, use the raw error text
              errorMessage = errorText.includes("error")
                ? errorText
                : `${errorMessage}: ${errorText}`;
            }
          }

          // Add specific handling for common image upload errors
          if (
            errorText.includes("file too large") ||
            errorText.includes("10MB")
          ) {
            errorMessage =
              "Image file is too large. Please use an image smaller than 10MB.";
          } else if (
            errorText.includes("invalid file type") ||
            errorText.includes("JPEG") ||
            errorText.includes("PNG")
          ) {
            errorMessage =
              "Invalid image format. Please use JPEG, PNG, or GIF images only.";
          } else if (
            errorText.includes("multipart") ||
            errorText.includes("form")
          ) {
            errorMessage =
              "Image upload failed. Please try selecting the image again.";
          }

          console.error("📝 Showing error to user:", errorMessage);
          createNotification(errorMessage, "bg-red-500");
        }
      }
    } catch (error) {
      console.error("❌ Error submitting comment:", error);

      // Clean up blob URL and remove optimistic comment on error
      const blobUrl =
        optimisticComment.image_path || optimisticComment.imagePath;
      if (blobUrl && blobUrl.startsWith("blob:")) {
        URL.revokeObjectURL(blobUrl);
      }

      setPostComments((prev) =>
        prev.filter((comment) => comment.id !== optimisticId)
      );

      // Revert comment count
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

      setGroupPosts((prev) =>
        prev.map((post) => {
          if (post.id === selectedPostId) {
            return {
              ...post,
              commentsCount: Math.max(0, (post.commentsCount || 0) - 1),
            };
          }
          return post;
        })
      );

      createNotification("Error submitting comment", "bg-red-500");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Add function to load comment count specifically
  const loadPostCommentsCount = async (postId: number) => {
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
        const actualCommentCount = data.comments ? data.comments.length : 0;

        console.log("🔢 Syncing comment count:", {
          postId,
          actualCount: actualCommentCount,
        });

        // Update comment count in messages and groupPosts to match actual count
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === `post-${postId}` && msg.postData) {
              return {
                ...msg,
                postData: {
                  ...msg.postData,
                  commentsCount: actualCommentCount,
                },
              };
            }
            return msg;
          })
        );

        setGroupPosts((prev) =>
          prev.map((post) => {
            if (post.id === postId) {
              return {
                ...post,
                commentsCount: actualCommentCount,
              };
            }
            return post;
          })
        );
      }
    } catch (error) {
      console.error("Error loading comment count:", error);
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
        // Reload comments to reflect the deletion
        await loadPostComments(selectedPostId);

        // Reload comment count to ensure accuracy after deletion
        await loadPostCommentsCount(selectedPostId);

        console.log("✅ Comment deleted successfully and counts updated");

        // Send WebSocket notification to other users in the group
        if (socket && socket.readyState === WebSocket.OPEN && chat.groupId) {
          socket.send(
            JSON.stringify({
              type: "comment_deleted",
              comment_id: commentId,
              post_id: selectedPostId,
              group_id: chat.groupId,
              deleted_by: currentUser?.id,
            })
          );
        }
      } else {
        const errorData = await response.text();
        console.error("Failed to delete comment:", response.status, errorData);

        // Check if it's a "not found" error (comment was deleted by someone else)
        if (response.status === 404) {
          // Remove the comment from local state
          setPostComments((prevComments) =>
            prevComments.filter((comment) => comment.id !== commentId)
          );

          showError(
            "Comment Unavailable",
            "This comment has been deleted and is no longer available."
          );
        } else {
          showError(
            "Delete Comment Failed",
            `Failed to delete comment: ${errorData}`
          );
        }
      }
    } catch (error) {
      console.error("Error deleting comment:", error);
      showError(
        "Delete Comment Error",
        "Error deleting comment. Please check your connection."
      );
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

        // Check if it's a "not found" error (comment was deleted)
        if (response.status === 404) {
          // Remove the comment from local state
          setPostComments((prevComments) =>
            prevComments.filter((comment) => comment.id !== commentId)
          );

          showError(
            "Comment Unavailable",
            "This comment has been deleted and is no longer available."
          );
        }
      }
    } catch (error) {
      console.error("Error voting on comment:", error);
    }
  };

  return (
    <div
      className={`flex h-full bg-gradient-to-br from-slate-50 to-blue-50 ${
        isMobile ? "flex-col" : ""
      }`}
    >
      <div className="flex-1 flex flex-col min-h-0">
        {/* Enhanced Chat Header - Device Specific */}
        <div
          className={`${
            deviceType === "phone"
              ? "px-3 py-2.5"
              : deviceType === "tablet"
              ? "px-5 py-3.5"
              : "px-6 py-4"
          } bg-white/80 backdrop-blur-sm border-b border-slate-200/60 shadow-sm`}
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              {/* Back Button for Mobile/Tablet */}
              {(isMobile || isTablet) && (
                <button
                  onClick={onBackClick}
                  className={`rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all duration-200 transform hover:scale-105 active:scale-95 mr-2 ${
                    deviceType === "phone" ? "p-1.5" : "p-2"
                  }`}
                  title="Back to chat list"
                >
                  <FaArrowLeft size={deviceType === "phone" ? 14 : 16} />
                </button>
              )}

              {/* Enhanced Avatar - Device Responsive */}
              <div className="relative">
                <div
                  className={`${
                    deviceType === "phone"
                      ? "h-9 w-9"
                      : deviceType === "tablet"
                      ? "h-11 w-11"
                      : "h-12 w-12"
                  } rounded-full overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center ring-2 ring-white shadow-lg`}
                >
                  <ChatAvatar
                    avatar={chat.avatar}
                    fullName={chat.name}
                    size={
                      deviceType === "phone"
                        ? "sm"
                        : deviceType === "tablet"
                        ? "md"
                        : "lg"
                    }
                    className="w-full h-full"
                    fallbackIcon={
                      chat.isGroup ? (
                        <FaUsers
                          size={
                            deviceType === "phone"
                              ? 14
                              : deviceType === "tablet"
                              ? 16
                              : 20
                          }
                        />
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={
                            deviceType === "phone"
                              ? "w-4 h-4"
                              : deviceType === "tablet"
                              ? "w-5 h-5"
                              : "w-6 h-6"
                          }
                        >
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                      )
                    }
                  />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h2
                  className={`font-semibold text-slate-800 truncate ${
                    deviceType === "phone"
                      ? "text-sm"
                      : deviceType === "tablet"
                      ? "text-base"
                      : "text-lg"
                  }`}
                >
                  {chat.name}
                </h2>
                <div className="flex items-center space-x-3">
                  {chat.isGroup && chat.members && (
                    <p
                      className={`text-slate-500 ${
                        deviceType === "phone" ? "text-xs" : "text-sm"
                      }`}
                    >
                      {chat.members.length} members
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Enhanced Action Buttons - Device Responsive */}
            <div
              className={`flex items-center ${
                deviceType === "phone"
                  ? chat.isGroup
                    ? "space-x-0.5" // Tighter spacing for phone group chats (more buttons)
                    : "space-x-1"
                  : "space-x-2"
              }`}
            >
              {chat.isGroup && (
                <>
                  {deviceType === "desktop" && (
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
                      <button
                        onClick={() => setShowChatInfo(!showChatInfo)}
                        className={`p-2.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 ${
                          showChatInfo
                            ? "bg-gradient-to-r from-indigo-500 to-blue-500 text-white"
                            : "bg-white/80 hover:bg-white text-slate-600 hover:text-slate-800"
                        }`}
                        title="Chat Details"
                      >
                        <IoInformationCircle size={18} />
                      </button>
                    </>
                  )}
                  {deviceType === "tablet" && (
                    <>
                      <button
                        onClick={() => setShowPostModal(true)}
                        className="p-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
                        title="Create post"
                      >
                        <IoAddCircle size={16} />
                      </button>
                      <button
                        onClick={() => setShowEventModal(true)}
                        className="p-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
                        title="Create event"
                      >
                        <FaCalendarAlt size={16} />
                      </button>
                      <button
                        onClick={() => setShowEventsPanel(!showEventsPanel)}
                        className={`p-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                          showEventsPanel
                            ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                            : "bg-white/80 hover:bg-white text-slate-600 hover:text-slate-800"
                        }`}
                        title="View events & posts"
                      >
                        <FaUsers size={16} />
                      </button>
                      <button
                        onClick={() => setShowChatInfo(!showChatInfo)}
                        className={`p-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                          showChatInfo
                            ? "bg-gradient-to-r from-indigo-500 to-blue-500 text-white"
                            : "bg-white/80 hover:bg-white text-slate-600 hover:text-slate-800"
                        }`}
                        title="More options"
                      >
                        <IoInformationCircle size={16} />
                      </button>
                    </>
                  )}
                  {deviceType === "phone" && (
                    <>
                      <button
                        onClick={() => setShowPostModal(true)}
                        className="p-1.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
                        title="Create post"
                      >
                        <IoAddCircle size={14} />
                      </button>
                      <button
                        onClick={() => setShowEventModal(true)}
                        className="p-1.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
                        title="Create event"
                      >
                        <FaCalendarAlt size={14} />
                      </button>
                      <button
                        onClick={() => setShowEventsPanel(!showEventsPanel)}
                        className={`p-1.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                          showEventsPanel
                            ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                            : "bg-white/80 hover:bg-white text-slate-600 hover:text-slate-800"
                        }`}
                        title="View events & posts"
                      >
                        <FaUsers size={14} />
                      </button>
                      <button
                        onClick={() => setShowChatInfo(!showChatInfo)}
                        className={`p-1.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                          showChatInfo
                            ? "bg-gradient-to-r from-indigo-500 to-blue-500 text-white"
                            : "bg-white/80 hover:bg-white text-slate-600 hover:text-slate-800"
                        }`}
                        title="More options"
                      >
                        <IoInformationCircle size={14} />
                      </button>
                    </>
                  )}
                </>
              )}
              {!chat.isGroup && deviceType === "desktop" && (
                <button
                  onClick={() => setShowChatInfo(!showChatInfo)}
                  className={`p-2.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 ${
                    showChatInfo
                      ? "bg-gradient-to-r from-indigo-500 to-blue-500 text-white"
                      : "bg-white/80 hover:bg-white text-slate-600 hover:text-slate-800"
                  }`}
                  title="Chat information"
                >
                  <IoInformationCircle size={20} />
                </button>
              )}
              {!chat.isGroup &&
                (deviceType === "phone" || deviceType === "tablet") && (
                  <button
                    onClick={() => setShowChatInfo(!showChatInfo)}
                    className={`p-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                      showChatInfo
                        ? "bg-gradient-to-r from-indigo-500 to-blue-500 text-white"
                        : "bg-white/80 hover:bg-white text-slate-600 hover:text-slate-800"
                    }`}
                    title="Chat information"
                  >
                    <IoInformationCircle
                      size={deviceType === "phone" ? 14 : 16}
                    />
                  </button>
                )}
            </div>
          </div>
        </div>

        {/* Modern Messages Container - Responsive */}
        <div
          className={`flex-1 overflow-y-auto min-h-0 ${
            isMobile ? "p-4 space-y-4" : "p-6 space-y-6"
          }`}
        >
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
                      className={`flex items-end ${
                        deviceType === "phone"
                          ? "max-w-[90%]"
                          : deviceType === "tablet"
                          ? "max-w-[80%]"
                          : "max-w-[70%]"
                      } ${msg.isMe ? "flex-row-reverse" : "flex-row"}`}
                    >
                      {/* Avatar */}
                      {!msg.isMe && (
                        <div
                          className={`flex-shrink-0 mr-3 ${
                            showAvatar ? "opacity-100" : "opacity-0"
                          }`}
                        >
                          <ChatAvatar
                            avatar={msg.senderAvatar}
                            fullName={msg.senderName}
                            size="sm"
                            className="ring-2 ring-white shadow-md"
                          />
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
                            <div className="p-4 border-b border-slate-200 relative">
                              {/* Delete Button - Only show for post author or group admin */}
                              {currentUser &&
                                (msg.isMe ||
                                  (groupInfo &&
                                    groupInfo.creatorId ===
                                      currentUser.id)) && (
                                  <button
                                    onClick={() => {
                                      if (
                                        confirm(
                                          "Are you sure you want to delete this post?"
                                        )
                                      ) {
                                        handleDeletePost(
                                          parseInt(msg.id.replace("post-", ""))
                                        );
                                      }
                                    }}
                                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-700 transition-colors duration-200 flex items-center justify-center text-sm font-bold shadow-sm hover:shadow-md"
                                    title="Delete post"
                                  >
                                    🗑️
                                  </button>
                                )}

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
                            className={`relative rounded-2xl shadow-md break-words ${
                              deviceType === "phone"
                                ? "px-3 py-2.5 max-w-xs"
                                : deviceType === "tablet"
                                ? "px-3.5 py-3 max-w-sm"
                                : "px-4 py-3 max-w-sm"
                            } ${
                              msg.isMe
                                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-br-md"
                                : "bg-white text-slate-800 rounded-bl-md border border-slate-200"
                            }`}
                          >
                            <p
                              className={`leading-relaxed whitespace-pre-wrap font-medium ${
                                deviceType === "phone" ? "text-sm" : "text-sm"
                              }`}
                            >
                              {msg.content}
                            </p>

                            <div
                              className={`mt-2 font-medium ${
                                deviceType === "phone" ? "text-xs" : "text-xs"
                              } ${
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

        {/* Enhanced Message Input - Device Responsive */}
        <div
          className={`bg-white/80 backdrop-blur-sm border-t border-slate-200/60 ${
            deviceType === "phone"
              ? "p-3"
              : deviceType === "tablet"
              ? "p-4"
              : "p-6"
          }`}
        >
          <div
            className={`flex items-end bg-white rounded-2xl shadow-lg border border-slate-200 ${
              deviceType === "phone"
                ? "space-x-2 p-2.5"
                : deviceType === "tablet"
                ? "space-x-3 p-3.5"
                : "space-x-4 p-4"
            }`}
          >
            <button
              type="button"
              className={`flex-shrink-0 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 text-white shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                deviceType === "phone" ? "p-1.5" : "p-2"
              }`}
              title="Add emoji"
              onClick={handleEmojiClick}
            >
              <FaSmile size={deviceType === "phone" ? 18 : 20} />
            </button>

            <div className="flex-1 relative">
              <textarea
                className={`w-full resize-none border-0 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 placeholder-slate-400 font-medium ${
                  deviceType === "phone"
                    ? "px-3 py-2.5 text-sm"
                    : deviceType === "tablet"
                    ? "px-3.5 py-3 text-sm"
                    : "px-4 py-3 text-sm"
                }`}
                rows={1}
                placeholder={
                  deviceType === "phone" ? "Message..." : "Type your message..."
                }
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  minHeight: deviceType === "phone" ? 38 : 44,
                  maxHeight: deviceType === "phone" ? 100 : 120,
                }}
              />
            </div>

            <button
              type="button"
              className={`flex-shrink-0 rounded-xl shadow-lg transition-all duration-200 transform active:scale-95 ${
                deviceType === "phone" ? "p-2.5" : "p-3"
              } ${
                message.trim()
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white hover:scale-105 hover:shadow-xl"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
              onClick={handleSendMessage}
              disabled={!message.trim()}
              title="Send message"
            >
              <IoSend size={deviceType === "phone" ? 18 : 20} />
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Info Sidebar - Device Responsive */}
      {showChatInfo && (
        <div
          className={`${
            deviceType === "phone"
              ? "fixed inset-0 z-50 bg-white"
              : deviceType === "tablet"
              ? "fixed inset-0 z-50 bg-white"
              : "w-80 bg-white/90 backdrop-blur-sm border-l border-slate-200/60 shadow-xl"
          } overflow-y-auto`}
        >
          <div
            className={`${
              deviceType === "phone"
                ? "p-4"
                : deviceType === "tablet"
                ? "p-5"
                : "p-6"
            }`}
          >
            {/* Header - Device Responsive */}
            <div
              className={`flex justify-between items-center mb-6 ${
                isMobile || isTablet ? "pt-4" : ""
              }`}
            >
              {(isMobile || isTablet) && (
                <button
                  onClick={() => setShowChatInfo(false)}
                  className={`rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all duration-200 transform hover:scale-105 active:scale-95 mr-3 ${
                    deviceType === "phone" ? "p-1.5" : "p-2"
                  }`}
                >
                  <FaArrowLeft size={deviceType === "phone" ? 14 : 16} />
                </button>
              )}
              <h3
                className={`font-bold text-slate-800 ${
                  deviceType === "phone"
                    ? "text-lg"
                    : deviceType === "tablet"
                    ? "text-xl"
                    : "text-xl"
                }`}
              >
                Chat Details
              </h3>
              {deviceType === "desktop" && (
                <button
                  onClick={() => setShowChatInfo(false)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all duration-200 transform hover:scale-105"
                >
                  <FaTimes size={16} />
                </button>
              )}
            </div>

            {/* Profile Section */}
            <div className="flex flex-col items-center mb-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 shadow-md">
              <div className="relative mb-4">
                <div className="h-24 w-24 rounded-full overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center ring-4 ring-white shadow-xl">
                  {chat.isGroup ? (
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 h-full w-full flex items-center justify-center text-white">
                      <FaUsers size={40} />
                    </div>
                  ) : (
                    <Avatar
                      avatar={chat.avatar}
                      fullName={chat.name}
                      size="xl"
                      className="w-full h-full"
                      fallbackIcon={
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-10 h-10"
                        >
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                      }
                    />
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
                            <ChatAvatar
                              avatar={member.avatar}
                              fullName={member.name}
                              size="md"
                              className="w-full h-full"
                              fallbackIcon={
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
                              }
                            />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-800">
                              {member.name || "Unknown User"}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {index === 0 && (
                                <div className="flex items-center gap-1">
                                  <div className="h-1.5 w-1.5 bg-amber-500 rounded-full"></div>
                                  <p className="text-xs font-medium text-amber-600">
                                    Group Creator
                                  </p>
                                </div>
                              )}
                              {/* Show pending status for invited members */}
                              {member.status === "pending" && (
                                <div className="flex items-center gap-1">
                                  <div className="h-1.5 w-1.5 bg-orange-500 rounded-full"></div>
                                  <p className="text-xs font-medium text-orange-600">
                                    Invitation Pending
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Remove Member Button */}
                          {currentUser && (
                            <>
                              {/* Check if current user is creator using groupInfo */}
                              {groupInfo &&
                                groupInfo.creatorId === currentUser.id &&
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
                                  chat.members[0].id === currentUser.id) &&
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

                {/* Group Actions Section */}
                {chat.isGroup && currentUser && (
                  <div className="pt-6 border-t border-slate-200">
                    {(() => {
                      // Determine if current user is the group creator
                      let isCreator = false;

                      // Primary method: Use groupInfo.creatorId if available
                      if (groupInfo && groupInfo.creatorId) {
                        isCreator = groupInfo.creatorId === currentUser.id;
                      }
                      // Fallback method: Check if user is first member AND has creator-like privileges
                      // This is a backup when groupInfo isn't loaded yet
                      else if (chat.members && chat.members.length > 0) {
                        // Assume first member might be creator, but this is just a fallback
                        isCreator = chat.members[0].id === currentUser.id;
                      }

                      return isCreator ? (
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
                        <div className="space-y-4">
                          <button
                            onClick={() => setShowLeaveConfirm(true)}
                            className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-4 py-3 rounded-xl text-sm font-bold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-2"
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
                                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                              />
                            </svg>
                            Leave Group
                          </button>
                        </div>
                      );
                    })()}
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
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gradient-to-br from-white to-purple-50 rounded-3xl shadow-2xl p-8 w-full max-w-lg z-50 border border-purple-200">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <FaCalendarAlt className="text-white" size={24} />
              </div>
              <Dialog.Title className="text-2xl font-bold text-slate-800 mb-2">
                Create Group Event
              </Dialog.Title>
              <p className="text-slate-600 text-sm">
                Plan something amazing for your group!
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label
                  htmlFor="eventTitle"
                  className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2"
                >
                  <span className="text-purple-500">✨</span>
                  Event Title
                </label>
                <input
                  id="eventTitle"
                  type="text"
                  value={newEvent.title}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, title: e.target.value })
                  }
                  className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
                  placeholder="What's the event called?"
                />
              </div>

              <div>
                <label
                  htmlFor="eventDescription"
                  className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2"
                >
                  <span className="text-purple-500">📝</span>
                  Description
                </label>
                <textarea
                  id="eventDescription"
                  value={newEvent.description}
                  onChange={(e) =>
                    setNewEvent({ ...newEvent, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 resize-none"
                  placeholder="Tell everyone what this event is about..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="eventDate"
                    className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2"
                  >
                    <span className="text-purple-500">📅</span>
                    Date
                  </label>
                  <input
                    id="eventDate"
                    type="date"
                    value={newEvent.date}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => {
                      setNewEvent({ ...newEvent, date: e.target.value });
                    }}
                    className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
                  />
                </div>
                <div>
                  <label
                    htmlFor="eventTime"
                    className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2"
                  >
                    <span className="text-purple-500">⏰</span>
                    Time
                  </label>
                  <input
                    id="eventTime"
                    type="time"
                    value={newEvent.time}
                    onChange={(e) => {
                      const selectedTime = e.target.value;
                      setNewEvent({ ...newEvent, time: selectedTime });

                      // If date is today, validate that time is in the future
                      if (newEvent.date) {
                        const today = new Date().toISOString().split("T")[0];
                        if (newEvent.date === today) {
                          const currentTime = new Date()
                            .toTimeString()
                            .slice(0, 5);
                          if (selectedTime <= currentTime) {
                            // Don't show alert immediately, just note it for form submission
                            console.log(
                              "Time must be in the future for today's date"
                            );
                          }
                        }
                      }
                    }}
                    className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200"
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setShowEventModal(false)}
                className="flex-1 px-6 py-3 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all duration-200 transform hover:scale-105"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEvent}
                disabled={
                  !newEvent.title.trim() || !newEvent.date || !newEvent.time
                }
                className={`flex-1 px-6 py-3 text-sm font-semibold text-white rounded-xl transition-all duration-200 transform hover:scale-105 ${
                  newEvent.title.trim() && newEvent.date && newEvent.time
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg hover:shadow-xl"
                    : "bg-gray-400 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span>🎉</span>
                  <span>Create Event</span>
                </div>
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

      {/* Enhanced Group Activity Panel - Device Responsive */}
      {showEventsPanel && chat.isGroup && (
        <div
          className={`${
            deviceType === "phone"
              ? "fixed inset-0 z-50 bg-white"
              : deviceType === "tablet"
              ? "fixed inset-0 z-50 bg-white"
              : "w-80 bg-white/90 backdrop-blur-sm border-l border-slate-200/60 shadow-xl"
          } flex flex-col overflow-y-auto`}
        >
          <div
            className={`bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-slate-200/60 ${
              deviceType === "phone"
                ? "p-4"
                : deviceType === "tablet"
                ? "p-5"
                : "p-6"
            }`}
          >
            {/* Header - Device Responsive */}
            <div
              className={`flex justify-between items-center mb-6 ${
                isMobile || isTablet ? "pt-4" : ""
              }`}
            >
              {(isMobile || isTablet) && (
                <button
                  onClick={() => setShowEventsPanel(false)}
                  className={`rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all duration-200 transform hover:scale-105 active:scale-95 mr-3 ${
                    deviceType === "phone" ? "p-1.5" : "p-2"
                  }`}
                >
                  <FaArrowLeft size={deviceType === "phone" ? 14 : 16} />
                </button>
              )}
              <h3
                className={`font-bold text-slate-800 ${
                  deviceType === "phone"
                    ? "text-lg"
                    : deviceType === "tablet"
                    ? "text-xl"
                    : "text-xl"
                }`}
              >
                Group Activity
              </h3>
              {deviceType === "desktop" && (
                <button
                  onClick={() => setShowEventsPanel(false)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all duration-200 transform hover:scale-105"
                >
                  <FaTimes size={16} />
                </button>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div
              className={`flex ${deviceType === "phone" ? "gap-2" : "gap-3"}`}
            >
              <button
                onClick={() => setShowPostModal(true)}
                className={`flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                  deviceType === "phone"
                    ? "px-3 py-2.5 text-xs"
                    : "px-4 py-3 text-sm"
                }`}
              >
                ✨ {deviceType === "phone" ? "Post" : "Create Post"}
              </button>
              <button
                onClick={() => setShowEventModal(true)}
                className={`flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                  deviceType === "phone"
                    ? "px-3 py-2.5 text-xs"
                    : "px-4 py-3 text-sm"
                }`}
              >
                📅 {deviceType === "phone" ? "Event" : "Create Event"}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-blue-50">
            {/* Enhanced Events Section */}
            <div
              className={`border-b border-slate-200/60 ${
                deviceType === "phone"
                  ? "p-4"
                  : deviceType === "tablet"
                  ? "p-5"
                  : "p-6"
              }`}
            >
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
                  {groupEvents.map((event) => {
                    // Debug: Log event data to see what we're receiving
                    console.log("Event data:", event);
                    console.log("Delete button check:", {
                      currentUser: currentUser,
                      eventCreatorId: event.creator_id,
                      currentUserId: currentUser?.id,
                      isEventCreator: event.creator_id === currentUser?.id,
                      groupInfo: groupInfo,
                      groupCreatorId: groupInfo?.creatorId,
                      isGroupAdmin:
                        groupInfo && groupInfo.creatorId === currentUser?.id,
                      shouldShowButton:
                        currentUser &&
                        (event.creator_id === currentUser.id ||
                          (groupInfo &&
                            groupInfo.creatorId === currentUser.id)),
                    });

                    // Improved date parsing for time display
                    let timeDisplay = "Time not set";
                    try {
                      console.log(
                        "Raw event date:",
                        event.eventDate,
                        typeof event.eventDate
                      );

                      if (event.eventDate) {
                        let eventDate: Date;

                        // Handle different date formats from backend
                        if (typeof event.eventDate === "string") {
                          // Try parsing ISO string or other formats
                          eventDate = new Date(event.eventDate);

                          // If that fails, try parsing with specific formats
                          if (isNaN(eventDate.getTime())) {
                            // Try parsing "YYYY-MM-DD HH:MM" format
                            const parts = event.eventDate.match(
                              /(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/
                            );
                            if (parts) {
                              eventDate = new Date(
                                parseInt(parts[1]), // year
                                parseInt(parts[2]) - 1, // month (0-based)
                                parseInt(parts[3]), // day
                                parseInt(parts[4]), // hour
                                parseInt(parts[5]) // minute
                              );
                            }
                          }
                        } else {
                          eventDate = new Date(event.eventDate);
                        }

                        console.log(
                          "Parsed event date:",
                          eventDate,
                          "Valid:",
                          !isNaN(eventDate.getTime())
                        );

                        if (eventDate && !isNaN(eventDate.getTime())) {
                          timeDisplay = eventDate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          });
                        }
                      }
                    } catch (error) {
                      console.log(
                        "Date parsing error for event:",
                        event.id,
                        "Error:",
                        error,
                        "Raw date:",
                        event.eventDate
                      );
                      timeDisplay = "Time not set";
                    }

                    return (
                      <div
                        key={event.id}
                        className="bg-gradient-to-br from-white to-purple-50/30 rounded-xl border border-purple-200/40 p-4 hover:shadow-lg hover:border-purple-300/60 transition-all duration-300 relative group overflow-hidden"
                      >
                        {/* Background Pattern */}
                        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-purple-100/40 to-pink-100/40 rounded-full -translate-y-10 translate-x-10 group-hover:scale-110 transition-transform duration-500"></div>

                        {/* Delete Button - Only show for event creator or group admin */}
                        {currentUser &&
                          (event.creator_id === currentUser.id ||
                            (groupInfo &&
                              groupInfo.creatorId === currentUser.id)) && (
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    "Are you sure you want to delete this event?"
                                  )
                                ) {
                                  handleDeleteEvent(event.id);
                                }
                              }}
                              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-700 transition-all duration-200 flex items-center justify-center text-sm font-bold shadow-md hover:shadow-lg transform hover:scale-105 z-10"
                              title="Delete event"
                            >
                              <FaTimes size={12} />
                            </button>
                          )}

                        {/* Event Header */}
                        <div className="relative z-10 mb-4">
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                              <FaCalendarAlt size={20} />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold text-slate-800 text-base mb-1 leading-tight">
                                {event.title}
                              </h4>
                              <div className="flex items-center gap-2 text-xs text-purple-600 font-medium">
                                <div className="h-1.5 w-1.5 bg-purple-500 rounded-full"></div>
                                <span>📅 {timeDisplay}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        {event.description && (
                          <div className="relative z-10 mb-4">
                            <p className="text-slate-600 text-sm leading-relaxed bg-white/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-purple-100/50">
                              {event.description}
                            </p>
                          </div>
                        )}

                        {/* Enhanced Action Buttons with Better Styling */}
                        <div className="relative z-10 flex gap-3">
                          <button
                            onClick={() => respondToEvent(event.id, "going")}
                            className={`flex-1 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-md hover:shadow-lg transform hover:scale-[1.02] ${
                              event.user_response === "going"
                                ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                                : "bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 hover:from-green-100 hover:to-emerald-100 border border-green-200"
                            }`}
                          >
                            <div className="flex items-center gap-1">
                              <span className="text-lg">✅</span>
                              <span>Going</span>
                            </div>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-bold ${
                                event.user_response === "going"
                                  ? "bg-green-600 text-white"
                                  : "bg-green-200 text-green-800"
                              }`}
                            >
                              {event.going_count || 0}
                            </span>
                          </button>

                          <button
                            onClick={() =>
                              respondToEvent(event.id, "not_going")
                            }
                            className={`flex-1 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-md hover:shadow-lg transform hover:scale-[1.02] ${
                              event.user_response === "not_going"
                                ? "bg-gradient-to-r from-red-500 to-rose-500 text-white"
                                : "bg-gradient-to-r from-red-50 to-rose-50 text-red-700 hover:from-red-100 hover:to-rose-100 border border-red-200"
                            }`}
                          >
                            <div className="flex items-center gap-1">
                              <span className="text-lg">❌</span>
                              <span>Not Going</span>
                            </div>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-bold ${
                                event.user_response === "not_going"
                                  ? "bg-red-600 text-white"
                                  : "bg-red-200 text-red-800"
                              }`}
                            >
                              {event.not_going_count || 0}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  className={`text-center ${
                    deviceType === "phone" ? "py-8" : "py-12"
                  }`}
                >
                  <div
                    className={`bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl mx-auto mb-6 flex items-center justify-center relative overflow-hidden ${
                      deviceType === "phone" ? "w-20 h-20" : "w-24 h-24"
                    }`}
                  >
                    <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-br from-purple-200/40 to-pink-200/40 rounded-full -translate-y-4 translate-x-4"></div>
                    <FaCalendarAlt
                      className="text-purple-600 relative z-10"
                      size={deviceType === "phone" ? 28 : 36}
                    />
                  </div>
                  <h4
                    className={`font-bold text-slate-800 mb-3 ${
                      deviceType === "phone" ? "text-lg" : "text-xl"
                    }`}
                  >
                    No events yet
                  </h4>
                  <p
                    className={`text-slate-600 mb-6 max-w-xs mx-auto leading-relaxed ${
                      deviceType === "phone" ? "text-sm" : "text-base"
                    }`}
                  >
                    Create your first group event to bring everyone together!
                  </p>
                  <button
                    onClick={() => setShowEventModal(true)}
                    className={`bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 ${
                      deviceType === "phone"
                        ? "px-6 py-3 text-sm"
                        : "px-8 py-3.5 text-base"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FaCalendarAlt size={16} />
                      <span>Create Event</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Enhanced Posts Section */}
            <div
              className={`${
                deviceType === "phone"
                  ? "p-4"
                  : deviceType === "tablet"
                  ? "p-5"
                  : "p-6"
              }`}
            >
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

                    // Enhanced date parsing
                    let dateDisplay = "Just now";
                    try {
                      const postDate =
                        (post as any).created_at || post.createdAt;
                      console.log("Post date fields:", {
                        created_at: (post as any).created_at,
                        createdAt: post.createdAt,
                        using: postDate,
                      });

                      if (postDate) {
                        const date = new Date(postDate);
                        if (!isNaN(date.getTime())) {
                          const now = new Date();
                          const diffTime = now.getTime() - date.getTime();
                          const diffDays = Math.floor(
                            diffTime / (1000 * 60 * 60 * 24)
                          );

                          if (diffDays === 0) {
                            dateDisplay = date.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            });
                          } else if (diffDays === 1) {
                            dateDisplay = "Yesterday";
                          } else if (diffDays < 7) {
                            dateDisplay = `${diffDays} days ago`;
                          } else {
                            dateDisplay = date.toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            });
                          }
                        }
                      }
                    } catch (error) {
                      console.error(
                        "Date parsing error for post:",
                        post.id,
                        error
                      );
                      dateDisplay = "Just now";
                    }

                    return (
                      <div
                        key={post.id}
                        className="bg-gradient-to-br from-white to-blue-50/30 rounded-xl border border-blue-200/40 p-5 hover:shadow-xl hover:border-blue-300/60 transition-all duration-300 relative group overflow-hidden"
                      >
                        {/* Background Pattern */}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-100/30 to-cyan-100/30 rounded-full -translate-y-12 translate-x-12 group-hover:scale-110 transition-transform duration-500"></div>

                        {/* Post Header */}
                        <div className="relative z-10 flex items-start gap-3 mb-4">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                            <IoAddCircle size={18} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-slate-800 text-base">
                                {post.authorName}
                              </h4>
                              <div className="flex items-center gap-2 text-xs text-blue-600 font-medium">
                                <div className="h-1.5 w-1.5 bg-blue-500 rounded-full"></div>
                                <span>{dateDisplay}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Post Content */}
                        <div className="relative z-10 mb-4">
                          <p className="text-slate-700 text-sm leading-relaxed bg-white/60 backdrop-blur-sm rounded-lg px-4 py-3 border border-blue-100/50">
                            {post.content}
                          </p>
                        </div>

                        {/* Post Image */}
                        {(post.imagePath || (post as any).image_path) && (
                          <div className="relative z-10 mb-4">
                            <img
                              src={getImageUrl(
                                post.imagePath || (post as any).image_path
                              )}
                              alt="Post image"
                              className="w-full h-40 object-cover rounded-xl border border-blue-200/50 shadow-md"
                              onError={(e) => {
                                console.error("Failed to load post image:", {
                                  imagePath: post.imagePath,
                                  image_path: (post as any).image_path,
                                  src: e.currentTarget.src,
                                });
                              }}
                            />
                          </div>
                        )}

                        {/* Enhanced Action Bar */}
                        <div className="relative z-10 flex items-center justify-between">
                          {/* Voting Section */}
                          <div className="flex items-center gap-1 bg-white/70 backdrop-blur-sm rounded-full px-3 py-2 border border-slate-200/50 shadow-sm">
                            <button
                              onClick={() => handleVoteGroupPost(post.id, 1)}
                              className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 hover:scale-110 ${
                                post.userVote === 1
                                  ? "bg-green-500 text-white shadow-md"
                                  : "text-slate-400 hover:bg-green-100 hover:text-green-600"
                              }`}
                            >
                              <span className="text-base">👍</span>
                            </button>
                            <span
                              className={`font-bold text-sm min-w-[2.5rem] text-center px-2 ${
                                post.userVote === 1
                                  ? "text-green-600"
                                  : post.userVote === -1
                                  ? "text-red-600"
                                  : "text-slate-600"
                              }`}
                            >
                              {(post.upvotes || 0) - (post.downvotes || 0)}
                            </span>
                            <button
                              onClick={() => handleVoteGroupPost(post.id, -1)}
                              className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 hover:scale-110 ${
                                post.userVote === -1
                                  ? "bg-red-500 text-white shadow-md"
                                  : "text-slate-400 hover:bg-red-100 hover:text-red-600"
                              }`}
                            >
                              <span className="text-base">👎</span>
                            </button>
                          </div>

                          {/* Comments Section */}
                          <button
                            onClick={() => handleShowComments(post.id)}
                            className="flex items-center gap-2 bg-gradient-to-r from-cyan-50 to-blue-50 hover:from-cyan-100 hover:to-blue-100 text-cyan-700 px-4 py-2 rounded-full border border-cyan-200/50 transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md"
                          >
                            <span className="text-base">💬</span>
                            <span className="font-semibold text-sm">
                              {post.commentsCount || 0}
                            </span>
                            <span className="text-xs font-medium">
                              {(post.commentsCount || 0) === 1
                                ? "comment"
                                : "comments"}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  className={`text-center ${
                    deviceType === "phone" ? "py-8" : "py-12"
                  }`}
                >
                  <div
                    className={`bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl mx-auto mb-6 flex items-center justify-center relative overflow-hidden ${
                      deviceType === "phone" ? "w-20 h-20" : "w-24 h-24"
                    }`}
                  >
                    <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-br from-blue-200/40 to-cyan-200/40 rounded-full -translate-y-4 translate-x-4"></div>
                    <IoAddCircle
                      className="text-blue-600 relative z-10"
                      size={deviceType === "phone" ? 28 : 36}
                    />
                  </div>
                  <h4
                    className={`font-bold text-slate-800 mb-3 ${
                      deviceType === "phone" ? "text-lg" : "text-xl"
                    }`}
                  >
                    No posts yet
                  </h4>
                  <p
                    className={`text-slate-600 mb-6 max-w-xs mx-auto leading-relaxed ${
                      deviceType === "phone" ? "text-sm" : "text-base"
                    }`}
                  >
                    Share something with your group!
                  </p>
                  <button
                    onClick={() => setShowPostModal(true)}
                    className={`bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 ${
                      deviceType === "phone"
                        ? "px-6 py-3 text-sm"
                        : "px-8 py-3.5 text-base"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <IoAddCircle size={16} />
                      <span>Create Post</span>
                    </div>
                  </button>
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
                    <span>🗑️ YES, DELETE "{chat.name}" FOREVER</span>
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

      {/* Leave Group Confirmation Modal */}
      <Dialog.Root open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-lg z-50 border border-orange-200">
            <Dialog.Title className="text-xl font-bold mb-4 text-orange-600 flex items-center gap-2">
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
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Leave Group
            </Dialog.Title>

            <div className="mb-6 space-y-3">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-orange-800 font-semibold mb-1">
                  Are you sure you want to leave this group?
                </p>
                <p className="text-orange-700 text-sm">
                  You will no longer receive messages from{" "}
                  <strong>"{chat.name}"</strong>
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-gray-700 text-sm">
                  • You will lose access to all group messages and content
                  <br />• You can be re-invited by any group member later
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowLeaveConfirm(false);
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
                Cancel - Stay in Group
              </button>
              <button
                onClick={handleLeaveGroup}
                disabled={isDeleting}
                className={`w-full px-4 py-3 text-sm font-bold rounded-md flex items-center justify-center gap-2 transition-all duration-200 ${
                  isDeleting
                    ? "bg-orange-300 text-orange-100 cursor-not-allowed"
                    : "bg-orange-600 hover:bg-orange-700 text-white border-2 border-orange-800 hover:shadow-lg"
                }`}
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Leaving Group...</span>
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
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    <span>Yes, Leave "{chat.name}"</span>
                  </>
                )}
              </button>
            </div>

            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                You can be re-invited to join this group again
              </p>
            </div>
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
                              alt={user.firstName}
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
                          {user.firstName} {user.lastName}
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

      {/* Enhanced Emoji Picker - Device Responsive */}
      {showEmojiPicker && (
        <div
          ref={emojiPickerRef}
          className={`absolute z-50 ${
            deviceType === "phone"
              ? "bottom-16 left-1/2 transform -translate-x-1/2"
              : deviceType === "tablet"
              ? "bottom-20 left-1/2 transform -translate-x-1/2"
              : "bottom-20 left-4"
          }`}
        >
          <div
            className={
              deviceType === "phone"
                ? "scale-75 origin-bottom"
                : deviceType === "tablet"
                ? "scale-90 origin-bottom"
                : ""
            }
          >
            <EmojiPicker
              onEmojiClick={handleEmojiSelect}
              width={
                deviceType === "phone"
                  ? 280
                  : deviceType === "tablet"
                  ? 320
                  : 300
              }
              height={
                deviceType === "phone"
                  ? 350
                  : deviceType === "tablet"
                  ? 380
                  : 400
              }
            />
          </div>
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
                          {comment.authorAvatar &&
                          comment.authorAvatar !==
                            "/uploads/avatars/default.jpg" ? (
                            <img
                              src={getImageUrl(comment.authorAvatar)}
                              alt={comment.authorName}
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
                                {comment.authorName}
                              </span>
                              <span className="text-xs text-slate-500">
                                {(() => {
                                  try {
                                    const date = new Date(
                                      (comment as any).created_at ||
                                        comment.createdAt
                                    );
                                    return isNaN(date.getTime())
                                      ? "Just now"
                                      : date.toLocaleDateString();
                                  } catch (error) {
                                    return "Just now";
                                  }
                                })()}
                              </span>
                            </div>
                            {/* Delete button - shown if user is comment author or post owner */}
                            {(comment.authorId === currentUser?.id ||
                              messages.find(
                                (msg) => msg.id === `post-${selectedPostId}`
                              )?.senderId === currentUser?.id) && (
                              <button
                                onClick={() =>
                                  handleDeleteComment(Number(comment.id))
                                }
                                className="p-1 rounded text-red-500 hover:bg-red-50 transition-colors"
                                title="Delete comment"
                              >
                                <FaTimes size={12} />
                              </button>
                            )}
                          </div>
                          {comment.content && (
                            <p className="text-sm text-slate-700 leading-relaxed mb-2">
                              {comment.content}
                            </p>
                          )}

                          {(comment.image_path || comment.imagePath) && (
                            <div className="mb-2">
                              <img
                                src={(() => {
                                  const imagePath =
                                    comment.image_path || comment.imagePath;
                                  if (!imagePath) return "";

                                  // If it's a blob URL (optimistic), use as-is
                                  if (imagePath.startsWith("blob:")) {
                                    return imagePath;
                                  }

                                  // Use the getImageUrl utility for proper URL construction
                                  return getImageUrl(imagePath);
                                })()}
                                alt="Comment image"
                                className="max-w-full h-auto rounded-lg border border-slate-200 shadow-sm"
                                style={{ maxHeight: "200px" }}
                                onError={(e) => {
                                  console.error(
                                    "❌ Failed to load comment image:",
                                    {
                                      src: e.currentTarget.src,
                                      image_path: comment.image_path,
                                      imagePath: comment.imagePath,
                                      constructedUrl: (() => {
                                        const imagePath =
                                          comment.image_path ||
                                          comment.imagePath;
                                        return imagePath
                                          ? getImageUrl(imagePath)
                                          : "no path";
                                      })(),
                                    }
                                  );
                                }}
                              />
                            </div>
                          )}

                          {/* Comment voting buttons */}
                          <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  handleVoteComment(Number(comment.id), 1)
                                }
                                className={`flex items-center justify-center w-6 h-5 rounded-lg transition-all duration-200 hover:scale-110 ${
                                  comment.userVote === 1
                                    ? "bg-green-100 text-green-600"
                                    : "text-gray-400 hover:bg-green-50 hover:text-green-500"
                                }`}
                              >
                                <span className="text-xs">👍</span>
                              </button>
                              <span
                                className={`font-bold text-xs min-w-[1.5rem] text-center ${
                                  comment.userVote === 1
                                    ? "text-green-600"
                                    : comment.userVote === -1
                                    ? "text-red-600"
                                    : "text-gray-600"
                                }`}
                              >
                                {(comment.upvotes || 0) -
                                  (comment.downvotes || 0)}
                              </span>
                              <button
                                onClick={() =>
                                  handleVoteComment(Number(comment.id), -1)
                                }
                                className={`flex items-center justify-center w-6 h-5 rounded-lg transition-all duration-200 hover:scale-110 ${
                                  comment.userVote === -1
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
              {/* Image Preview */}
              {newCommentImage && (
                <div className="mb-3 relative">
                  <img
                    src={URL.createObjectURL(newCommentImage)}
                    alt="Comment preview"
                    className="max-w-full h-auto rounded-lg border border-slate-200 shadow-sm"
                    style={{ maxHeight: "150px" }}
                  />
                  <button
                    onClick={() => setNewCommentImage(null)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs transition-colors"
                    title="Remove image"
                  >
                    ×
                  </button>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmitComment();
                }}
                className="flex gap-3"
                noValidate
              >
                <div className="flex-1">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (
                          (newComment.trim() || newCommentImage) &&
                          !isSubmittingComment
                        ) {
                          handleSubmitComment();
                        }
                      }
                    }}
                    placeholder={
                      newCommentImage
                        ? "Add a caption (optional)..."
                        : "Write a comment, add an image, or both..."
                    }
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    disabled={isSubmittingComment}
                    required={false}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        id="comment-image-upload"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setNewCommentImage(file);
                          }
                        }}
                        className="hidden"
                        disabled={isSubmittingComment}
                      />
                      <label
                        htmlFor="comment-image-upload"
                        className={`cursor-pointer p-2 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors ${
                          isSubmittingComment
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                        title="Add image"
                      >
                        <svg
                          className="w-4 h-4 text-slate-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </label>
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={
                    (!newComment.trim() && !newCommentImage) ||
                    isSubmittingComment
                  }
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 self-start ${
                    (newComment.trim() || newCommentImage) &&
                    !isSubmittingComment
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  {isSubmittingComment ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    "Post Comment"
                  )}
                </button>
              </form>
            </div>

            {/* Close Button */}
            <button
              onClick={() => {
                // Clean up blob URL if exists
                if (newCommentImage) {
                  setNewCommentImage(null);
                }
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
