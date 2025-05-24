"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { IoNotifications, IoCheckmark, IoClose } from "react-icons/io5";
import { FaUsers, FaUserPlus, FaCalendarAlt } from "react-icons/fa";
import { createAvatarFallback } from "@/utils/image";

interface Notification {
  id: string;
  type:
    | "group_invitation"
    | "follow_request"
    | "group_request"
    | "event_created"
    | "message";
  title: string;
  content: string;
  from?: {
    id: number;
    name: string;
    avatar?: string;
  };
  entityId?: string; // ID of group, user, etc.
  timestamp: string;
  read: boolean;
}

export default function NotificationPanel() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load mock notifications
  useEffect(() => {
    // This would be replaced with an API call
    const mockNotifications: Notification[] = [
      {
        id: "1",
        type: "group_invitation",
        title: "Group Invitation",
        content: "You've been invited to join Web Development group",
        from: {
          id: 1,
          name: "John Doe",
          avatar: "/uploads/avatars/default.png",
        },
        entityId: "group-1",
        timestamp: "2023-06-10T14:30:00Z",
        read: false,
      },
      {
        id: "2",
        type: "follow_request",
        title: "Follow Request",
        content: "Jane Smith wants to follow you",
        from: {
          id: 2,
          name: "Jane Smith",
          avatar: "/uploads/avatars/default.png",
        },
        entityId: "user-2",
        timestamp: "2023-06-09T10:15:00Z",
        read: false,
      },
      {
        id: "3",
        type: "group_request",
        title: "Group Join Request",
        content: "Bob Johnson wants to join your Design Principles group",
        from: {
          id: 3,
          name: "Bob Johnson",
          avatar: "/uploads/avatars/default.png",
        },
        entityId: "group-2",
        timestamp: "2023-06-08T16:45:00Z",
        read: true,
      },
      {
        id: "4",
        type: "event_created",
        title: "New Event",
        content:
          "Weekly Meetup event has been created in Web Development group",
        entityId: "event-1",
        timestamp: "2023-06-07T09:20:00Z",
        read: true,
      },
    ];

    setNotifications(mockNotifications);
    setUnreadCount(mockNotifications.filter((n) => !n.read).length);
  }, []);

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

  const handleNotificationAction = (
    notificationId: string,
    action: "accept" | "decline" | "view" | "markAsRead"
  ) => {
    // This would be replaced with an API call
    if (action === "markAsRead") {
      setNotifications(
        notifications.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      return;
    }

    const notification = notifications.find((n) => n.id === notificationId);
    if (!notification) return;

    let message = "";
    switch (action) {
      case "accept":
        if (notification.type === "group_invitation") {
          message = "You've joined the group!";
        } else if (notification.type === "follow_request") {
          message = `You've accepted ${notification.from?.name}'s follow request`;
        } else if (notification.type === "group_request") {
          message = `You've accepted ${notification.from?.name}'s request to join your group`;
        }
        break;
      case "decline":
        message = "Request declined";
        break;
      case "view":
        // Navigate to relevant page
        if (
          notification.type === "group_invitation" ||
          notification.type === "group_request"
        ) {
          router.push(`/groups/${notification.entityId}`);
        } else if (notification.type === "follow_request") {
          router.push(`/profile/${notification.from?.id}`);
        } else if (notification.type === "event_created") {
          router.push(`/events/${notification.entityId}`);
        }
        break;
    }

    if (message) {
      alert(message);
    }

    // Mark as read
    setNotifications(
      notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "group_invitation":
      case "group_request":
        return <FaUsers className="text-indigo-600" size={18} />;
      case "follow_request":
        return <FaUserPlus className="text-blue-600" size={18} />;
      case "event_created":
        return <FaCalendarAlt className="text-green-600" size={18} />;
      case "message":
        return <IoNotifications className="text-orange-600" size={18} />;
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
              {unreadCount > 0 && (
                <span className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">
                  Mark all as read
                </span>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length > 0 ? (
                <div className="divide-y">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 hover:bg-gray-50 transition-colors ${
                        !notification.read ? "bg-blue-50" : ""
                      }`}
                    >
                      <div className="flex">
                        <div className="flex-shrink-0 mt-1">
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            {notification.from?.avatar ? (
                              <img
                                src={notification.from.avatar}
                                alt={notification.from.name}
                                className="h-full w-full object-cover rounded-full"
                              />
                            ) : notification.from ? (
                              createAvatarFallback(notification.from.name)
                            ) : (
                              <div className="h-full w-full flex items-center justify-center">
                                {getNotificationIcon(notification.type)}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="ml-3 flex-1">
                          <div className="flex justify-between items-start">
                            <h4 className="text-sm font-medium text-gray-900">
                              {notification.title}
                            </h4>
                            <span className="text-xs text-gray-500">
                              {formatDate(notification.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {notification.content}
                          </p>

                          <div className="mt-2 flex gap-2">
                            {(notification.type === "group_invitation" ||
                              notification.type === "follow_request" ||
                              notification.type === "group_request") && (
                              <>
                                <button
                                  onClick={() =>
                                    handleNotificationAction(
                                      notification.id,
                                      "accept"
                                    )
                                  }
                                  className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() =>
                                    handleNotificationAction(
                                      notification.id,
                                      "decline"
                                    )
                                  }
                                  className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                                >
                                  Decline
                                </button>
                              </>
                            )}

                            {notification.type === "event_created" && (
                              <button
                                onClick={() =>
                                  handleNotificationAction(
                                    notification.id,
                                    "view"
                                  )
                                }
                                className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
                              >
                                View Event
                              </button>
                            )}

                            {!notification.read && (
                              <button
                                onClick={() =>
                                  handleNotificationAction(
                                    notification.id,
                                    "markAsRead"
                                  )
                                }
                                className="ml-auto text-gray-400 hover:text-gray-600"
                                aria-label="Mark as read"
                              >
                                <IoCheckmark size={16} />
                              </button>
                            )}
                          </div>
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
