"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { NotificationAvatar } from "@/components/ui/Avatar";
import { motion } from "framer-motion";
import { FaUserPlus, FaUserCheck, FaTimes, FaCheck, FaTrash } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";
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

interface NotificationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationSidebar({
  isOpen,
  onClose,
}: NotificationSidebarProps) {
  const router = useRouter();
  const { notifications, clearAllNotifications, markAllAsRead } = useNotifications();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [filteredNotifications, setFilteredNotifications] = useState<
    Notification[]
  >([]);
  const [processedNotifications, setProcessedNotifications] = useState<
    Set<string>
  >(new Set());
  const [feedbackMessages, setFeedbackMessages] = useState<{
    [key: string]: { message: string; type: "success" | "error" };
  }>({});

  // Auto-mark all notifications as read when sidebar opens
  useEffect(() => {
    if (isOpen) {
      markAllAsRead();
    }
  }, [isOpen]);

  // Auto-hide notifications after 1 minute
  useEffect(() => {
    const hideNotifications = async () => {
      const now = new Date();
      const expiredNotifications = notifications.filter((notification) => {
        if (notification.type === "group_invitation") {
          const createdAt = new Date(notification.created_at);
          const diffInMinutes =
            (now.getTime() - createdAt.getTime()) / (1000 * 60);
          return diffInMinutes >= 1; // Find notifications older than 1 minute
        }
        return false;
      });

      if (expiredNotifications.length > 0) {
        // Call backend to delete expired notifications from database
        try {
          const backendUrl =
            process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
          await fetch(`${backendUrl}/api/notifications/cleanup-expired`, {
            method: "POST",
            credentials: "include",
          });
        } catch (error) {
          console.error("Error cleaning up expired notifications:", error);
        }
      }
    };

    const interval = setInterval(hideNotifications, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [notifications]);

  // Show feedback message temporarily
  const showFeedback = (
    notificationId: string,
    message: string,
    type: "success" | "error"
  ) => {
    setFeedbackMessages((prev) => ({
      ...prev,
      [notificationId]: { message, type },
    }));

    // Hide feedback after 3 seconds
    setTimeout(() => {
      setFeedbackMessages((prev) => {
        const newMessages = { ...prev };
        delete newMessages[notificationId];
        return newMessages;
      });
    }, 3000);
  };

  // Refresh functionality removed - notifications are automatically updated

  // Filtered notifications based on active filter
  const displayedNotifications = notifications.filter((notification) => {
    if (activeFilter === "all") return true;
    return notification.type === activeFilter;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins}m`;
    } else if (diffHours < 24) {
      return `${diffHours}h`;
    } else if (diffDays < 7) {
      return `${diffDays}d`;
    } else {
      return `${diffDays}d`;
    }
  };

  const handleAcceptFollowRequest = async (notification: Notification) => {
    try {
      if (!notification.reference_id) return;

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

      if (response.ok) {
        // Mark this notification as processed
        setProcessedNotifications(
          (prev) => new Set([...prev, notification.id])
        );
        showFeedback(notification.id, `✅ Follow request accepted!`, "success");
      }
    } catch (error) {
      console.error("Error accepting follow request:", error);
    }
  };

  const handleRejectFollowRequest = async (notification: Notification) => {
    try {
      if (!notification.reference_id) return;

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

      if (response.ok) {
        // Mark this notification as processed
        setProcessedNotifications(
          (prev) => new Set([...prev, notification.id])
        );
        showFeedback(notification.id, `❌ Follow request declined`, "success");
      }
    } catch (error) {
      console.error("Error rejecting follow request:", error);
    }
  };

  const handleAcceptGroupInvite = async (notification: Notification) => {
    try {
      if (!notification.reference_id) return;

      // Check if this notification has already been processed
      if (processedNotifications.has(notification.id)) {
        console.log("Notification already processed:", notification.id);
        return;
      }

      // Mark as processed immediately to prevent duplicate processing
      setProcessedNotifications((prev) => new Set([...prev, notification.id]));

      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      // First get the user's invitations to find the invitation ID for this group
      const invitationsResponse = await fetch(`${backendUrl}/api/invitations`, {
        method: "GET",
        credentials: "include",
      });

      if (!invitationsResponse.ok) {
        console.error("Failed to get invitations:", invitationsResponse.status);
        showFeedback(
          notification.id,
          "Failed to load invitation details",
          "error"
        );
        return;
      }

      const invitationsData = await invitationsResponse.json();
      const invitation = invitationsData.invitations?.find(
        (inv: any) => inv.group_id === notification.reference_id
      );

      if (!invitation) {
        console.error(
          "Invitation not found for group:",
          notification.reference_id
        );
        // This might be normal if the invitation was already processed
        showFeedback(
          notification.id,
          "This invitation may have already been processed",
          "error"
        );
        return;
      }

      // Accept the invitation using the invitation ID
      const response = await fetch(
        `${backendUrl}/api/invitations/${invitation.id}/accept`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (response.ok) {
                    showFeedback(
              notification.id,
              `✅ Successfully joined ${invitation.group_name}!`,
              "success"
            );
      } else {
        console.error("Failed to accept invitation:", response.status);
        showFeedback(notification.id, "Failed to accept invitation", "error");
        // Remove from processed if it failed
        setProcessedNotifications((prev) => {
          const newSet = new Set(prev);
          newSet.delete(notification.id);
          return newSet;
        });
      }
    } catch (error) {
      console.error("Error accepting group invitation:", error);
      showFeedback(notification.id, "An error occurred", "error");
      // Remove from processed if it failed
      setProcessedNotifications((prev) => {
        const newSet = new Set(prev);
        newSet.delete(notification.id);
        return newSet;
      });
    }
  };

  const handleRejectGroupInvite = async (notification: Notification) => {
    try {
      if (!notification.reference_id) return;

      // Check if this notification has already been processed
      if (processedNotifications.has(notification.id)) {
        console.log("Notification already processed:", notification.id);
        return;
      }

      // Mark as processed immediately to prevent duplicate processing
      setProcessedNotifications((prev) => new Set([...prev, notification.id]));

      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      // First get the user's invitations to find the invitation ID for this group
      const invitationsResponse = await fetch(`${backendUrl}/api/invitations`, {
        method: "GET",
        credentials: "include",
      });

      if (!invitationsResponse.ok) {
        console.error("Failed to get invitations:", invitationsResponse.status);
        showFeedback(
          notification.id,
          "Failed to load invitation details",
          "error"
        );
        return;
      }

      const invitationsData = await invitationsResponse.json();
      const invitation = invitationsData.invitations?.find(
        (inv: any) => inv.group_id === notification.reference_id
      );

      if (!invitation) {
        console.error(
          "Invitation not found for group:",
          notification.reference_id
        );
        // This might be normal if the invitation was already processed
        showFeedback(
          notification.id,
          "This invitation may have already been processed",
          "error"
        );
        return;
      }

      // Reject the invitation using the invitation ID
      const response = await fetch(
        `${backendUrl}/api/invitations/${invitation.id}/reject`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (response.ok) {
                    showFeedback(
              notification.id,
              `❌ Declined invitation to ${invitation.group_name}`,
              "success"
            );
      } else {
        console.error("Failed to reject invitation:", response.status);
        showFeedback(notification.id, "Failed to decline invitation", "error");
        // Remove from processed if it failed
        setProcessedNotifications((prev) => {
          const newSet = new Set(prev);
          newSet.delete(notification.id);
          return newSet;
        });
      }
    } catch (error) {
      console.error("Error rejecting group invitation:", error);
      showFeedback(notification.id, "An error occurred", "error");
      // Remove from processed if it failed
      setProcessedNotifications((prev) => {
        const newSet = new Set(prev);
        newSet.delete(notification.id);
        return newSet;
      });
    }
  };

  const handleViewProfile = (userId: number) => {
    router.push(`/profile/${userId}`);
    onClose();
  };

  const handleViewPost = (postId: string | number) => {
    router.push(`/posts/${postId}`);
    onClose();
  };

  const handleMarkNotificationAsRead = async (
    notificationId: string,
    e: React.MouseEvent
  ) => {
    if ((e.target as Element).closest("button")) {
      return;
    }

    try {
      const notification = notifications.find((n) => n.id === notificationId);
      if (!notification) return;

      // Navigate based on notification type
      if (notification.type === "event_created") {
        router.push(`/chats`);
        onClose();
      } else if (
        notification.type === "follow_request" ||
        notification.type === "follow" ||
        notification.type === "follow_accepted"
      ) {
        if (notification.sender) {
          handleViewProfile(notification.sender.id);
        }
      } else if (
        notification.type === "post_like" ||
        notification.type === "post_comment"
      ) {
        if (notification.reference_id) {
          handleViewPost(notification.reference_id);
        }
      }

      // Mark as read if not already read
      if (!notification.is_read) {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
        await fetch(
          `${backendUrl}/api/notifications/${notificationId}/read`,
          {
            method: "POST",
            credentials: "include",
          }
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
      case "group_invitation":
      case "group_member_added":
        return (
          <div className="text-indigo-600">
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
                d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902 1.168.188 2.352.327 3.55.414.28.02.521.18.642.413l1.713 3.293a.75.75 0 001.33 0l1.713-3.293a.783.783 0 01.642-.413 41.102 41.102 0 003.55-.414c1.437-.231 2.43-1.49 2.43-2.902V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0010 2z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        );
      case "event_created":
        return (
          <div className="text-purple-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path
                fillRule="evenodd"
                d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z"
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
      case "event_created":
        return "border-purple-500";
      default:
        return "border-indigo-500";
    }
  };

  // If closed, don't render anything
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay to close when clicking outside */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Notification panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative w-full sm:w-96 h-full bg-white shadow-lg overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <div className="flex items-center">
            <h2 className="text-xl font-bold">Notifications</h2>
            {notifications.filter((n) => !n.is_read).length > 0 && (
              <span className="ml-2 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                {notifications.filter((n) => !n.is_read).length}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {notifications.length > 0 && (
              <button
                onClick={clearAllNotifications}
                className="text-gray-500 hover:text-red-600 p-1 rounded-md transition-colors"
                title="Clear all notifications"
              >
                <FaTrash size={16} />
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-1"
            >
              <IoMdClose size={24} />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        {notifications.length > 0 && (
          <div className="px-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            <div className="flex space-x-1 border-b border-gray-200 pb-1 min-w-max">
              <button
                onClick={() => setActiveFilter("all")}
                className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeFilter === "all"
                    ? "bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                All
              </button>
              {/* Show filter options for notification types that exist */}
              {notifications.some((n) => n.type === "follow_request") && (
                <button
                  onClick={() => setActiveFilter("follow_request")}
                  className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center ${
                    activeFilter === "follow_request"
                      ? "bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <FaUserPlus className="mr-1.5" size={12} />
                  Requests
                </button>
              )}
              {notifications.some((n) => n.type === "post_like") && (
                <button
                  onClick={() => setActiveFilter("post_like")}
                  className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center ${
                    activeFilter === "post_like"
                      ? "bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-3 h-3 mr-1.5"
                  >
                    <path d="M9.653 16.915l-.005-.003-.019-.01a20.759 20.759 0 01-1.162-.682 22.045 22.045 0 01-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 018-2.828A4.5 4.5 0 0118 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 01-3.744 2.582l-.019.01-.005.003h-.002a.739.739 0 01-.69.001l-.002-.001z" />
                  </svg>
                  Likes
                </button>
              )}
              {notifications.some((n) => n.type === "post_comment") && (
                <button
                  onClick={() => setActiveFilter("post_comment")}
                  className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center ${
                    activeFilter === "post_comment"
                      ? "bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-3 h-3 mr-1.5"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902 1.168.188 2.352.327 3.55.414.28.02.521.18.642.413l1.713 3.293a.75.75 0 001.33 0l1.713-3.293a.783.783 0 01.642-.413 41.102 41.102 0 003.55-.414c1.437-.231 2.43-1.49 2.43-2.902V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0010 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Comments
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
          ) : error ? (
            <div className="p-4 text-red-500 text-center">
              <p>{error}</p>
              <p className="mt-2 text-gray-500 text-sm">
                Notifications will refresh automatically
              </p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center p-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 text-indigo-500 mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              </div>
              <p className="text-gray-500">No notifications yet</p>
            </div>
          ) : displayedNotifications.length === 0 ? (
            <div className="text-center p-6">
              <p className="text-gray-500">
                No {activeFilter.replace("_", " ")} notifications
              </p>
              <button
                onClick={() => setActiveFilter("all")}
                className="mt-2 text-indigo-600 hover:text-indigo-800 text-sm"
              >
                View all notifications
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {displayedNotifications.map((notification, index) => (
                <div
                  key={`${notification.id}-${notification.type}-${index}`}
                  className={`bg-white rounded-lg ${
                    !notification.is_read
                      ? "border-l-4 " +
                        getNotificationBorderColor(notification.type)
                      : ""
                  } hover:bg-gray-50 transition-colors p-3 cursor-pointer ${
                    !notification.is_read
                      ? "shadow-sm"
                      : "border border-gray-200"
                  }`}
                  onClick={(e) =>
                    handleMarkNotificationAsRead(notification.id, e)
                  }
                >
                  <div className="flex">
                    {/* Avatar/Icon */}
                    {notification.sender ? (
                      <div className="mr-3 cursor-pointer flex-shrink-0">
                        <NotificationAvatar
                          avatar={notification.sender.avatar}
                          firstName={notification.sender.first_name}
                          lastName={notification.sender.last_name}
                          onClick={() => {
                            notification.sender &&
                              handleViewProfile(notification.sender.id);
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-100 mr-3 flex items-center justify-center flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <p
                          className={`text-sm ${
                            !notification.is_read ? "font-semibold" : ""
                          } text-gray-800 line-clamp-2`}
                        >
                          {notification.content}
                        </p>
                        <span className="text-xs text-gray-500 ml-2 whitespace-nowrap flex-shrink-0">
                          {formatDate(notification.created_at)}
                        </span>
                      </div>

                      {/* Feedback Message */}
                      {feedbackMessages[notification.id] && (
                        <div
                          className={`mt-2 p-2 rounded-md text-xs font-medium ${
                            feedbackMessages[notification.id].type === "success"
                              ? "bg-green-100 text-green-800 border border-green-200"
                              : "bg-red-100 text-red-800 border border-red-200"
                          }`}
                        >
                          {feedbackMessages[notification.id].message}
                        </div>
                      )}

                      {/* Action buttons for specific notification types - Only show if not processed and no feedback */}
                      {!processedNotifications.has(notification.id) &&
                        !feedbackMessages[notification.id] && (
                          <>
                            {notification.type === "follow_request" && (
                              <div className="mt-2 flex space-x-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAcceptFollowRequest(notification);
                                  }}
                                  className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-md text-xs font-medium"
                                >
                                  <FaCheck className="mr-1" size={10} /> Accept
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRejectFollowRequest(notification);
                                  }}
                                  className="flex items-center bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-md text-xs font-medium"
                                >
                                  <FaTimes className="mr-1" size={10} /> Decline
                                </button>
                              </div>
                            )}

                            {notification.type === "group_invitation" && (
                              <div className="mt-2 flex space-x-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAcceptGroupInvite(notification);
                                  }}
                                  className="flex items-center bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-xs font-medium"
                                >
                                  <FaCheck className="mr-1" size={10} /> Accept
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRejectGroupInvite(notification);
                                  }}
                                  className="flex items-center bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded-md text-xs font-medium"
                                >
                                  <FaTimes className="mr-1" size={10} /> Decline
                                </button>
                              </div>
                            )}
                          </>
                        )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
