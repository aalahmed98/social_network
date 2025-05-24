"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getImageUrl, createAvatarFallback } from "@/utils/image";
import { motion } from "framer-motion";
import { FaUserPlus, FaUserCheck, FaTimes, FaCheck } from "react-icons/fa";
import { IoMdClose } from "react-icons/io";
import { useNotifications } from "@/context/NotificationContext";

interface Notification {
  id: string;
  type:
    | "group_invitation"
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
  const { notifications, refreshNotifications, markAsRead, markAllAsRead } =
    useNotifications();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  // Refresh notifications when sidebar opens
  useEffect(() => {
    if (isOpen) {
      handleRefresh();
    }
  }, [isOpen]);

  const handleRefresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await refreshNotifications();
    } catch (error) {
      console.error("Error refreshing notifications:", error);
      setError("Failed to load notifications");
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered notifications based on active filter
  const filteredNotifications = notifications.filter((notification) => {
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
        await refreshNotifications(); // Refresh notifications
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
        await refreshNotifications(); // Refresh notifications
      }
    } catch (error) {
      console.error("Error rejecting follow request:", error);
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
      if (!notification || notification.is_read) return;

      await markAsRead(notificationId);
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
                d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902 1.168.188 2.352.327 3.55.414.28.02.521.18.642.413l1.713 3.293a.75.75 0 001.33 0l1.713-3.293a.783.783 0 01.642-.413 41.102 41.102 0 003.55-.414c1.437-.231 2.43-1.49 2.43-2.902V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0010 2z"
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
          <div className="flex items-center space-x-3">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="text-gray-500 hover:text-indigo-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
            {notifications.length > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path
                    fillRule="evenodd"
                    d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                    clipRule="evenodd"
                  />
                </svg>
                Mark all read
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
              <button
                onClick={handleRefresh}
                className="mt-2 text-indigo-600 hover:text-indigo-800"
              >
                Try again
              </button>
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
          ) : filteredNotifications.length === 0 ? (
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
              {filteredNotifications.map((notification, index) => (
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
                      <div
                        className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 mr-3 cursor-pointer flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          notification.sender &&
                            handleViewProfile(notification.sender.id);
                        }}
                      >
                        {notification.sender.avatar &&
                        getImageUrl(notification.sender.avatar) ? (
                          <Image
                            src={getImageUrl(notification.sender.avatar)!}
                            alt={`${notification.sender.first_name} ${notification.sender.last_name}`}
                            width={40}
                            height={40}
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                            {createAvatarFallback(
                              notification.sender.first_name,
                              notification.sender.last_name
                            )}
                          </div>
                        )}
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

                      {/* Action buttons for specific notification types */}
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
