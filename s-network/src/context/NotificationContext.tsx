"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
} from "react";
import { flushSync } from "react-dom";
import { useAuth } from "./AuthContext";

interface Notification {
  id: string;
  type:
    | "group_invitation"
    | "group_member_added"
    | "follow_request"
    | "follow_accepted"
    | "follow"
    | "group_request"
    | "event_created"
    | "message"
    | "post_like"
    | "post_comment"
    | "system";
  content: string;
  sender?: {
    id: number;
    first_name: string;
    last_name: string;
    avatar?: string;
  };
  reference_id?: string | number;
  created_at: string;
  is_read: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isNotificationSidebarOpen: boolean;
  openNotificationSidebar: () => void;
  closeNotificationSidebar: () => void;
  toggleNotificationSidebar: () => void;
  addNotification: (notification: Notification) => void;
  showNotificationAlert: (
    message: string,
    type?: "info" | "success" | "warning" | "error"
  ) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationSidebarOpen, setIsNotificationSidebarOpen] =
    useState(false);
  const [currentUser, setCurrentUser] = useState<{
    id: number | string;
    firstName: string;
    lastName: string;
  } | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const fetchNotifications = async () => {
    if (!isLoggedIn) return;

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/notifications`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        const processedNotifications = (data.notifications || []).map(
          (notification: any) => ({
            ...notification,
            reference_id:
              notification.reference_id ||
              notification.follower_id ||
              notification.post_id ||
              notification.conversation_id ||
              notification.group_id,
            is_read: Boolean(notification.is_read),
            sender: notification.sender || null,
          })
        );

        if (process.env.NODE_ENV === 'development') {
          console.log(
            "🔔 Fetched notifications:",
            processedNotifications.length,
            "total"
          );
          console.log(
            "🔔 Unread count:",
            processedNotifications.filter((n: Notification) => !n.is_read).length
          );
        }

        flushSync(() => {
          setNotifications(processedNotifications);
          setUnreadCount(
            processedNotifications.filter((n: Notification) => !n.is_read)
              .length
          );
        });
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
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
          if (process.env.NODE_ENV === 'development') {
            console.log(
              "🔔 Current user loaded:",
              userData.id,
              userData.first_name
            );
          }
          setCurrentUser(userData);
        }
      } catch (error) {
        console.error("Error fetching current user:", error);
      }
    };

    fetchCurrentUser();
  }, [isLoggedIn]);

  // Global WebSocket connection for real-time notifications
  useEffect(() => {
    if (!isLoggedIn || !currentUser) {
      // Clean up existing socket if logged out
      if (socketRef.current) {
        if (process.env.NODE_ENV === 'development') {
          console.log("🔔 Cleaning up WebSocket connection");
        }
        socketRef.current.close();
        socketRef.current = null;
      }
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(
        "🔔 Setting up GLOBAL WebSocket for notifications, user:",
        currentUser.id
      );
    }

    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${backendUrl.replace(
      /^https?:\/\//,
      ""
    )}/ws/chat`;

    if (process.env.NODE_ENV === 'development') {
      console.log("🔔 Connecting to WebSocket:", wsUrl);
    }

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      if (process.env.NODE_ENV === 'development') {
        console.log("🔔 GLOBAL WebSocket notification connection established");
      }

      // Register for global notifications (not specific conversations)
      if (socket.readyState === WebSocket.OPEN) {
        const registrationMessage = {
          type: "register_global",
          user_id: currentUser.id,
        };
        if (process.env.NODE_ENV === 'development') {
          console.log("🔔 Sending global registration:", registrationMessage);
        }
        socket.send(JSON.stringify(registrationMessage));
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (process.env.NODE_ENV === 'development') {
          console.log("🔔 Received GLOBAL message:", data);
        }

        // Handle registration confirmation
        if (data.type === "registered_global") {
          if (process.env.NODE_ENV === 'development') {
            console.log(
              "✅ Global notification registration confirmed for user:",
              data.user_id
            );
          }
          return;
        }

        // Handle connection confirmation
        if (data.type === "connected") {
          if (process.env.NODE_ENV === 'development') {
            console.log("✅ WebSocket connection established:", data.status);
          }
          return;
        }

        // Handle different notification types immediately
        if (data.type === "chat_message") {
          // Only add notification if it's not from current user
          const isFromCurrentUser =
            String(data.sender_id) === String(currentUser.id) ||
            Number(data.sender_id) === Number(currentUser.id);

          if (process.env.NODE_ENV === 'development') {
            console.log(
              "🔔 Chat message received, from current user?",
              isFromCurrentUser,
              "sender:",
              data.sender_id,
              "current:",
              currentUser.id
            );
          }

          if (!isFromCurrentUser) {
            // Check if this is a group message or direct message
            const isGroupMessage = data.is_group || false;

            const notification: Notification = {
              id: `msg-${data.id}-${Date.now()}`,
              type: "message",
              content: isGroupMessage
                ? `💬 New group message`
                : `💬 ${data.sender_name} sent you a message`,
              sender: {
                id: Number(data.sender_id),
                first_name: data.sender_name.split(" ")[0] || data.sender_name,
                last_name: data.sender_name.split(" ").slice(1).join(" ") || "",
                avatar: data.sender_avatar,
              },
              reference_id: data.conversation_id,
              created_at: new Date().toISOString(),
              is_read: false,
            };

            if (process.env.NODE_ENV === 'development') {
              console.log("🔔 Adding message notification:", notification);
            }
            addNotification(notification);
            showNotificationAlert(
              isGroupMessage
                ? `💬 New group message`
                : `💬 ${data.sender_name} sent you a message`,
              "info"
            );
          }
        } else if (
          data.type === "post_created" &&
          data.created_by !== currentUser.id
        ) {
          const notification: Notification = {
            id: `post-${data.post_id}-${Date.now()}`,
            type: "post_like",
            content: `📝 ${data.post_data?.author_name} posted in a group`,
            sender: {
              id: data.post_data?.author_id,
              first_name:
                data.post_data?.author_name?.split(" ")[0] || "Group Member",
              last_name:
                data.post_data?.author_name?.split(" ").slice(1).join(" ") ||
                "",
              avatar: data.post_data?.author_avatar,
            },
            reference_id: data.group_id,
            created_at: new Date().toISOString(),
            is_read: false,
          };

          if (process.env.NODE_ENV === 'development') {
            console.log("🔔 Adding post notification:", notification);
          }
          addNotification(notification);
          showNotificationAlert("📝 New post in group", "success");
        } else if (
          data.type === "event_created" &&
          data.created_by !== currentUser.id
        ) {
          const notification: Notification = {
            id: `event-${data.event_id}-${Date.now()}`,
            type: "event_created",
            content: `📅 New event: ${data.event_data?.title}`,
            sender: {
              id: data.created_by,
              first_name: "Group Member",
              last_name: "",
              avatar: undefined,
            },
            reference_id: data.group_id,
            created_at: new Date().toISOString(),
            is_read: false,
          };

          if (process.env.NODE_ENV === 'development') {
            console.log("🔔 Adding event notification:", notification);
          }
          addNotification(notification);
          showNotificationAlert("📅 New event created", "info");
        } else if (
          data.type === "comment_created" &&
          data.created_by !== currentUser.id
        ) {
          const notification: Notification = {
            id: `comment-${data.comment_id}-${Date.now()}`,
            type: "post_comment",
            content: `💬 New comment on a post`,
            sender: {
              id: data.created_by,
              first_name:
                data.comment_data?.authorName?.split(" ")[0] || "Group Member",
              last_name:
                data.comment_data?.authorName?.split(" ").slice(1).join(" ") ||
                "",
              avatar: data.comment_data?.authorAvatar,
            },
            reference_id: data.post_id,
            created_at: new Date().toISOString(),
            is_read: false,
          };

          if (process.env.NODE_ENV === 'development') {
            console.log("🔔 Adding comment notification:", notification);
          }
          addNotification(notification);
          showNotificationAlert("💬 New comment added", "info");
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.log("🔔 Received other message type:", data.type);
          }
        }
      } catch (error) {
        console.error("Error parsing global notification message:", error);
      }
    };

    socket.onerror = (error) => {
      console.error("🔔 GLOBAL WebSocket notification error:", error);
    };

    socket.onclose = (event) => {
      console.log(
        "🔔 GLOBAL WebSocket notification connection closed, clean:",
        event.wasClean,
        "code:",
        event.code
      );
      socketRef.current = null;

      // Attempt to reconnect after 3 seconds if not a clean close
      if (!event.wasClean && isLoggedIn && currentUser) {
        setTimeout(() => {
          console.log(
            "🔔 Attempting to reconnect GLOBAL notification WebSocket"
          );
          // Trigger reconnection by updating state
          setCurrentUser((prev) => (prev ? { ...prev } : null));
        }, 3000);
      }
    };

    // Cleanup function
    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        if (process.env.NODE_ENV === 'development') {
          console.log("🔔 Closing WebSocket connection on cleanup");
        }
        socket.close(1000, "Component unmounting");
      }
    };
  }, [isLoggedIn, currentUser]);

  // Initial fetch and periodic refresh (reduced frequency since we have WebSocket)
  useEffect(() => {
    if (isLoggedIn) {
      fetchNotifications();

      // Set up polling every 10 minutes as backup (much less frequent now)
      const interval = setInterval(fetchNotifications, 600000);
      return () => clearInterval(interval);
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setCurrentUser(null);
      // Return undefined explicitly for other cases
      return undefined;
    }
  }, [isLoggedIn]);

  const openNotificationSidebar = () => {
    setIsNotificationSidebarOpen(true);
  };

  const closeNotificationSidebar = () => {
    setIsNotificationSidebarOpen(false);
  };

  const toggleNotificationSidebar = () => {
    setIsNotificationSidebarOpen((prev) => !prev);
  };

  // Functions removed - notifications are automatically marked as read when clicked

  // Add a new notification to the list
  const addNotification = (notification: Notification) => {
    if (process.env.NODE_ENV === 'development') {
      console.log("🔔 Adding notification to state, current count:", unreadCount);
    }

    // Force immediate state updates without batching
    flushSync(() => {
      setNotifications((prev) => [notification, ...prev]);

      if (!notification.is_read) {
        setUnreadCount((prev) => {
          const newCount = prev + 1;
          if (process.env.NODE_ENV === 'development') {
            console.log("🔔 Updated unread count:", newCount);
          }
          return newCount;
        });
      }
    });
  };

  // Show a visual notification alert
  const showNotificationAlert = (
    message: string,
    type: "info" | "success" | "warning" | "error" = "info"
  ) => {
    if (process.env.NODE_ENV === 'development') {
      console.log("🔔 Showing notification alert:", message);
    }

    // Create a temporary visual notification
    const notification = document.createElement("div");
    const colors = {
      info: "bg-blue-500",
      success: "bg-green-500",
      warning: "bg-yellow-500",
      error: "bg-red-500",
    };

    notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg z-[9999] animate-slide-in-right max-w-sm`;
    notification.innerHTML = `
      <div class="flex items-center">
        <div class="flex-1">
          <p class="text-sm font-medium">${message}</p>
        </div>
        <button class="ml-3 text-white hover:text-gray-200" onclick="this.parentElement.parentElement.remove()">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.classList.add("animate-slide-out-right");
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 300);
      }
    }, 5000);

    // Request notification permission if needed
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isNotificationSidebarOpen,
        openNotificationSidebar,
        closeNotificationSidebar,
        toggleNotificationSidebar,
        addNotification,
        showNotificationAlert,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider"
    );
  }
  return context;
}
