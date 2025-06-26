"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
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
  refreshNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
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

        setNotifications(processedNotifications);
        setUnreadCount(
          processedNotifications.filter((n: Notification) => !n.is_read).length
        );
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  // Initial fetch and periodic refresh
  useEffect(() => {
    if (isLoggedIn) {
      fetchNotifications();

      // Set up polling every minute
      const interval = setInterval(fetchNotifications, 60000);
      return () => clearInterval(interval);
    } else {
      setNotifications([]);
      setUnreadCount(0);
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

  const refreshNotifications = async () => {
    await fetchNotifications();
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(
        `${backendUrl}/api/notifications/${notificationId}/read`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (response.ok) {
        setNotifications(
          notifications.map((n) =>
            n.id === notificationId ? { ...n, is_read: true } : n
          )
        );
        setUnreadCount((prev) => Math.max(prev - 1, 0));
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/notifications/read-all`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        setNotifications(notifications.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
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
        refreshNotifications,
        markAsRead,
        markAllAsRead,
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
