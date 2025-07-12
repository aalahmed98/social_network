"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { IoNotifications, IoCheckmark, IoClose } from "react-icons/io5";
import {
  FaUsers,
  FaUserPlus,
  FaCalendarAlt,
  FaCheck,
  FaTimes,
} from "react-icons/fa";
import { NotificationAvatar } from "@/components/ui/Avatar";

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

export default function NotificationPanel() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [processedNotifications, setProcessedNotifications] = useState<
    Set<string>
  >(new Set());
  const [feedbackMessages, setFeedbackMessages] = useState<{
    [key: string]: { message: string; type: "success" | "error" };
  }>({});
  const [error, setError] = useState<string | null>(null);

  // Fetch notifications from the API
  const fetchNotifications = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/notifications`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }

      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      setError("Failed to load notifications");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch notifications when the panel is opened
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
        const response = await fetch(`${backendUrl}/api/notifications/unread`, {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          setUnreadCount(data.unread_count || 0);
        }
      } catch (error) {
        console.error("Error checking unread notifications:", error);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

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
        // Remove expired notifications from UI
        setNotifications((prev) =>
          prev.filter((notification) => {
            if (notification.type === "group_invitation") {
              const createdAt = new Date(notification.created_at);
              const diffInMinutes =
                (now.getTime() - createdAt.getTime()) / (1000 * 60);
              return diffInMinutes < 1; // Keep notifications younger than 1 minute
            }
            return true; // Keep other notifications
          })
        );

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

  const markNotificationAsRead = async (notificationId: string) => {
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
        setNotifications(notifications.map((n) => 
          n.id === notificationId ? { ...n, is_read: true } : n
        ));
        setUnreadCount(prev => Math.max(prev - 1, 0));
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleNotificationAction = async (
    notification: Notification,
    action: "accept" | "decline" | "view"
  ) => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      // First mark the notification as read
      await markNotificationAsRead(notification.id);

      // Handle follow request actions
      if (notification.type === "follow_request" && action !== "view") {
        if (action === "accept") {
          const response = await fetch(
            `${backendUrl}/api/follow/request/${notification.reference_id}/accept`,
            {
              method: "POST",
              credentials: "include",
            }
          );

          if (response.ok) {
            setNotifications((prev) =>
              prev.filter((n) => n.id !== notification.id)
            );
            setProcessedNotifications(
              (prev) => new Set([...prev, notification.id])
            );
            showFeedback(
              notification.id,
              `✅ Follow request accepted!`,
              "success"
            );
            fetchNotifications();
          }
        } else if (action === "decline") {
          const response = await fetch(
            `${backendUrl}/api/follow/request/${notification.reference_id}/reject`,
            {
              method: "POST",
              credentials: "include",
            }
          );

          if (response.ok) {
            setNotifications((prev) =>
              prev.filter((n) => n.id !== notification.id)
            );
            setProcessedNotifications(
              (prev) => new Set([...prev, notification.id])
            );
            showFeedback(
              notification.id,
              `❌ Follow request declined`,
              "success"
            );
            fetchNotifications();
          }
        }
      }

      // Handle group invitation actions
      if (notification.type === "group_invitation") {
        if (processedNotifications.has(notification.id)) {
          return;
        }

        setProcessedNotifications(
          (prev) => new Set([...prev, notification.id])
        );

        if (action === "accept") {
          const invitationsResponse = await fetch(
            `${backendUrl}/api/invitations`,
            {
              method: "GET",
              credentials: "include",
            }
          );

          if (invitationsResponse.ok) {
            const invitationsData = await invitationsResponse.json();
            const invitation = invitationsData.invitations?.find(
              (inv: any) => inv.group_id === notification.reference_id
            );

            if (invitation) {
              const response = await fetch(
                `${backendUrl}/api/invitations/${invitation.id}/accept`,
                {
                  method: "POST",
                  credentials: "include",
                }
              );

              if (response.ok) {
                setNotifications((prev) =>
                  prev.filter((n) => n.id !== notification.id)
                );
                showFeedback(
                  notification.id,
                  `✅ Successfully joined ${invitation.group_name}!`,
                  "success"
                );
                fetchNotifications();
              }
            }
          }
        } else if (action === "decline") {
          const invitationsResponse = await fetch(
            `${backendUrl}/api/invitations`,
            {
              method: "GET",
              credentials: "include",
            }
          );

          if (invitationsResponse.ok) {
            const invitationsData = await invitationsResponse.json();
            const invitation = invitationsData.invitations?.find(
              (inv: any) => inv.group_id === notification.reference_id
            );

            if (invitation) {
              const response = await fetch(
                `${backendUrl}/api/invitations/${invitation.id}/reject`,
                {
                  method: "POST",
                  credentials: "include",
                }
              );

              if (response.ok) {
                setNotifications((prev) =>
                  prev.filter((n) => n.id !== notification.id)
                );
                showFeedback(
                  notification.id,
                  `❌ Declined invitation to ${invitation.group_name}`,
                  "success"
                );
                fetchNotifications();
              }
            }
          }
        }
      }

      // Handle view action for all notification types
      if (action === "view") {
        if (
          notification.type === "follow_request" ||
          notification.type === "follow" ||
          notification.type === "follow_accepted"
        ) {
          router.push(`/profile/${notification.sender?.id}`);
        } else if (
          notification.type === "post_like" ||
          notification.type === "post_comment"
        ) {
          router.push(`/posts/${notification.reference_id}`);
        } else if (notification.type === "message") {
          router.push("/chats");
        } else if (notification.type === "event_created") {
          router.push("/chats");
        }
      }
    } catch (error) {
      console.error("Error handling notification action:", error);
      showFeedback(notification.id, "An error occurred", "error");
    }
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "group_invitation":
      case "group_member_added":
      case "group_request":
        return <FaUsers className="text-indigo-600" size={18} />;
      case "follow_request":
        return <FaUserPlus className="text-blue-600" size={18} />;
      case "follow":
      case "follow_accepted":
        return <FaCheck className="text-green-600" size={18} />;
      case "event_created":
        return <FaCalendarAlt className="text-green-600" size={18} />;
      case "post_like":
        return <IoCheckmark className="text-red-600" size={18} />;
      case "post_comment":
        return <IoNotifications className="text-purple-600" size={18} />;
      case "message":
      default:
        return <IoNotifications className="text-orange-600" size={18} />;
    }
  };

  const getNotificationTitle = (type: Notification["type"]) => {
    switch (type) {
      case "group_invitation":
        return "Group Invitation";
      case "group_request":
        return "Group Request";
      case "follow_request":
        return "Follow Request";
      case "follow":
        return "New Follower";
      case "follow_accepted":
        return "Follow Request Accepted";
      case "event_created":
        return "New Event";
      case "post_like":
        return "Post Liked";
      case "post_comment":
        return "New Comment";
      case "message":
        return "New Message";
      case "system":
        return "System Notification";
      default:
        return "Notification";
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors focus:outline-none"
        aria-label="Notifications"
      >
        <IoNotifications size={24} className="text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-lg overflow-hidden z-50"
          >
            <div className="p-3 border-b flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">Notifications</h3>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : error ? (
                <div className="py-8 text-center text-red-500">
                  <p>{error}</p>
                </div>
              ) : notifications.length > 0 ? (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 hover:bg-gray-50 transition-colors ${
                        !notification.is_read ? "bg-blue-50" : ""
                      }`}
                    >
                      <div className="flex">
                        <div className="flex-shrink-0 mt-1">
                          {notification.sender ? (
                            <NotificationAvatar
                              avatar={notification.sender.avatar}
                              firstName={notification.sender.first_name}
                              lastName={notification.sender.last_name}
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                              {getNotificationIcon(notification.type)}
                            </div>
                          )}
                        </div>

                        <div className="ml-3 flex-1">
                          <div className="flex justify-between items-start">
                            <h4 className="text-sm font-medium text-gray-900">
                              {getNotificationTitle(notification.type)}
                            </h4>
                            <span className="text-xs text-gray-500">
                              {formatDate(notification.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {notification.content}
                          </p>

                          {/* Feedback Message */}
                          {feedbackMessages[notification.id] && (
                            <div
                              className={`mt-2 p-2 rounded-md text-xs font-medium ${
                                feedbackMessages[notification.id].type ===
                                "success"
                                  ? "bg-green-100 text-green-800 border border-green-200"
                                  : "bg-red-100 text-red-800 border border-red-200"
                              }`}
                            >
                              {feedbackMessages[notification.id].message}
                            </div>
                          )}

                          {/* Action Buttons - Only show if not processed and no feedback */}
                          {!processedNotifications.has(notification.id) &&
                            !feedbackMessages[notification.id] && (
                              <div className="mt-2 flex gap-2">
                                {notification.type === "follow_request" && (
                                  <>
                                    <button
                                      onClick={() =>
                                        handleNotificationAction(
                                          notification,
                                          "accept"
                                        )
                                      }
                                      className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center gap-1"
                                    >
                                      <FaCheck size={10} />
                                      Accept
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleNotificationAction(
                                          notification,
                                          "decline"
                                        )
                                      }
                                      className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 flex items-center gap-1"
                                    >
                                      <FaTimes size={10} />
                                      Decline
                                    </button>
                                  </>
                                )}

                                {notification.type === "group_invitation" && (
                                  <>
                                    <button
                                      onClick={() =>
                                        handleNotificationAction(
                                          notification,
                                          "accept"
                                        )
                                      }
                                      className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 flex items-center gap-1"
                                    >
                                      <FaCheck size={10} />
                                      Accept
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleNotificationAction(
                                          notification,
                                          "decline"
                                        )
                                      }
                                      className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 flex items-center gap-1"
                                    >
                                      <FaTimes size={10} />
                                      Decline
                                    </button>
                                  </>
                                )}

                                {(notification.type === "follow" ||
                                  notification.type === "follow_accepted" ||
                                  notification.type === "post_like" ||
                                  notification.type === "post_comment") && (
                                  <button
                                    onClick={() =>
                                      handleNotificationAction(
                                        notification,
                                        "view"
                                      )
                                    }
                                    className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
                                  >
                                    View
                                  </button>
                                )}
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500">
                  <p>No notifications yet</p>
                </div>
              )}
            </div>

            <div className="p-3 border-t text-center">
              <button
                onClick={() => setIsOpen(false)}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
