"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getImageUrl, createAvatarFallback } from "@/utils/image";
import { FaUserPlus, FaUserCheck, FaTimes, FaCheck } from "react-icons/fa";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { motion } from "framer-motion";
import { useNotifications } from "@/context/NotificationContext";

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

export default function NotificationsPage() {
  const router = useRouter();
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const { openNotificationSidebar } = useNotifications();

  // Fetch all notifications
  const fetchNotifications = async () => {
    if (!isLoggedIn) return;

    setIsLoading(true);
    setError(null);

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      // First check authentication to ensure the session is valid
      const authCheckResponse = await fetch(`${backendUrl}/api/auth/check`, {
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!authCheckResponse.ok) {
        throw new Error(
          "Authentication check failed. Please refresh the page and try again."
        );
      }

      const authData = await authCheckResponse.json();
      if (!authData.authenticated) {
        throw new Error("Authentication invalid. Please log in again.");
      }

      // Now fetch notifications with the confirmed session
      const response = await fetch(`${backendUrl}/api/notifications`, {
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch notifications: ${response.status} ${errorText}`
        );
      }

      const data = await response.json();
              if (process.env.NODE_ENV === 'development') {
          console.log("Notifications data:", data); // Debug log
        }

      // Process notifications to ensure all fields are properly structured
      const processedNotifications = (data.notifications || []).map(
        (notification: any) => {
          return {
            ...notification,
            reference_id:
              notification.reference_id ||
              notification.follower_id ||
              notification.post_id ||
              notification.conversation_id ||
              notification.group_id,
            is_read: Boolean(notification.is_read),
            sender: notification.sender || null,
          };
        }
      );

      setNotifications(processedNotifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      setError("Failed to load notifications. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch notifications if user is logged in
    if (isLoggedIn && !authLoading) {
      fetchNotifications();

      // Set up automatic refresh of notifications every 30 seconds
      const refreshInterval = setInterval(() => {
        fetchNotifications();
      }, 30000);

      return () => clearInterval(refreshInterval);
    } else if (!authLoading && !isLoggedIn) {
      setIsLoading(false); // Stop loading if not logged in
    }
    // Return undefined explicitly for other cases
    return undefined;
  }, [isLoggedIn, authLoading]);

  useEffect(() => {
    // Open the notification sidebar
    openNotificationSidebar();

    // Redirect to the homepage
    router.push("/");
  }, [router, openNotificationSidebar]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleAcceptFollowRequest = async (notification: Notification) => {
    try {
      if (!notification.reference_id) {
        console.error("Missing reference_id in notification:", notification);
        return;
      }

      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(
        `${backendUrl}/api/follow/request/${notification.reference_id}/accept`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to accept follow request: ${response.status} ${errorText}`
        );
      }

      // Refresh notifications after accepting
      fetchNotifications();
    } catch (error) {
      console.error("Error accepting follow request:", error);
      setError("Failed to accept follow request. Please try again.");
      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleRejectFollowRequest = async (notification: Notification) => {
    try {
      if (!notification.reference_id) {
        console.error("Missing reference_id in notification:", notification);
        setError("Invalid notification data. Please refresh and try again.");
        setTimeout(() => setError(null), 3000);
        return;
      }

      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(
        `${backendUrl}/api/follow/request/${notification.reference_id}/reject`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        // Special handling for already processed requests
        if (
          response.status === 404 ||
          data.message === "Follow request already processed"
        ) {
          console.log(
            "Follow request already processed:",
            notification.reference_id
          );
          // Remove this notification from state
          setNotifications(
            notifications.filter(
              (n) =>
                // Keep if it's not a follow request or has a different reference_id
                n.type !== "follow_request" ||
                n.reference_id !== notification.reference_id
            )
          );
          return;
        }

        throw new Error(
          `Failed to reject follow request: ${response.status} ${JSON.stringify(
            data
          )}`
        );
      }

      // Refresh notifications after rejecting
      fetchNotifications();
    } catch (error) {
      console.error("Error rejecting follow request:", error);
      setError("Failed to reject follow request. Please try again.");
      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleViewProfile = (userId: number) => {
    router.push(`/profile/${userId}`);
  };

  const handleViewPost = (postId: string | number) => {
    router.push(`/posts/${postId}`);
  };

  const handleMarkAllAsRead = async () => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/notifications/read-all`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        // Update all notifications to read
        setNotifications(
          notifications.map((notification) => ({
            ...notification,
            is_read: true,
          }))
        );
      }
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    }
  };

  // Function to mark a single notification as read
  const markNotificationAsRead = async (
    notificationId: string,
    e: React.MouseEvent
  ) => {
    // Prevent triggering other click handlers (like viewing profile)
    if ((e.target as Element).closest("button")) {
      return; // Don't mark as read if a button inside was clicked
    }

    try {
      // Only mark if it's not already read
      const notification = notifications.find((n) => n.id === notificationId);
      if (!notification || notification.is_read) return;

      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(
        `${backendUrl}/api/notifications/${notificationId}/read`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        // Update the notification in state
        setNotifications(
          notifications.map((n) =>
            n.id === notificationId ? { ...n, is_read: true } : n
          )
        );
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "follow_request":
        return (
          <div className="text-indigo-600">
            <FaUserPlus size={16} />
          </div>
        );
      case "follow_accepted":
        return (
          <div className="text-green-600">
            <FaUserCheck size={16} />
          </div>
        );
      case "follow":
        return (
          <div className="text-blue-600">
            <FaUserCheck size={16} />
          </div>
        );
      case "post_like":
        return (
          <div className="text-pink-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M9.653 16.915l-.005-.003-.019-.01a20.759 20.759 0 01-1.162-.682 22.045 22.045 0 01-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 018-2.828A4.5 4.5 0 0118 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 01-3.744 2.582l-.019.01-.005.003h-.002a.739.739 0 01-.69.001l-.002-.001z" />
            </svg>
          </div>
        );
      case "post_comment":
        return (
          <div className="text-orange-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path
                fillRule="evenodd"
                d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902 1.168.188 2.352.327 3.55.414.28.02.521.18.642.413l1.713 3.293a.75.75 0 001.33 0l1.713-3.293a.783.783 0 01.642-.413 41.102 41.102 0 003.55-.414c1.437-.231 2.43-1.49 2.43-2.902V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0010 2zM6.75 6a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 2.5a.75.75 0 000 1.5h3.5a.75.75 0 000-1.5h-3.5z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        );
      case "group_invitation":
        return (
          <div className="text-purple-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
            </svg>
          </div>
        );
      case "message":
        return (
          <div className="text-sky-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
            </svg>
          </div>
        );
      case "system":
        return (
          <div className="text-gray-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        );
      default:
        return (
          <div className="text-indigo-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M4 5h12v7H4V5z" />
              <path
                fillRule="evenodd"
                d="M1 3.5A1.5 1.5 0 012.5 2h15A1.5 1.5 0 0119 3.5v10a1.5 1.5 0 01-1.5 1.5H12v1.5h3.25a.75.75 0 010 1.5H4.75a.75.75 0 010-1.5H8V15H2.5A1.5 1.5 0 011 13.5v-10zm16.5 0h-15v10h15v-10z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        );
    }
  };

  // Filtered notifications based on active filter
  const filteredNotifications = notifications.filter((notification) => {
    if (activeFilter === "all") return true;
    return notification.type === activeFilter;
  });

  // If not logged in and not loading auth status, show login prompt
  if (!authLoading && !isLoggedIn) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Notifications</h1>
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className="text-gray-700 mb-4">
            You need to be logged in to view notifications
          </div>
          <Link
            href="/login"
            className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
          >
            Log In
          </Link>
        </div>
      </div>
    );
  }

  // If still loading auth status
  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Notifications</h1>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
  }

  // If loading notifications
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Notifications</h1>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
  }

  // If there was an error loading notifications
  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Notifications</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
        <div className="flex justify-center">
          <button
            onClick={() => fetchNotifications()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return null; // No content needed as we're redirecting
}

// Add the new function for notification border colors
const getNotificationBorderColor = (type: Notification["type"]) => {
  switch (type) {
    case "follow_request":
      return "border-indigo-500";
    case "follow":
    case "follow_accepted":
      return "border-blue-500";
    case "post_like":
      return "border-pink-500";
    case "post_comment":
      return "border-orange-500";
    case "message":
      return "border-sky-500";
    case "group_invitation":
      return "border-purple-500";
    case "system":
      return "border-gray-500";
    default:
      return "border-indigo-500";
  }
};
