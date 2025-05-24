"use client";

import { useState, useRef, useEffect } from "react";
import { Chat } from "../page";
import { IoSend, IoInformationCircle, IoAddCircle } from "react-icons/io5";
import { FaSmile, FaUsers, FaCalendarAlt, FaTimes } from "react-icons/fa";
import { createAvatarFallback } from "@/utils/image";
import * as Dialog from "@radix-ui/react-dialog";
import { useAuth } from "@/context/AuthContext";

interface Message {
  id: string;
  senderId: string | number;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: string;
  isMe: boolean;
}

interface ChatWindowProps {
  chat: Chat;
  onConversationUpdated: () => Promise<void>;
}

export default function ChatWindow({
  chat,
  onConversationUpdated,
}: ChatWindowProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  // WebSocket connection
  useEffect(() => {
    // Close any existing socket connection
    if (socket) {
      socket.close();
    }

    // Don't attempt to connect if not authenticated
    if (!user) return;

    let wsConnected = false;
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${backendUrl.replace(
      /^https?:\/\//,
      ""
    )}/ws/chat`;

    const newSocket = new WebSocket(wsUrl);

    newSocket.onopen = () => {
      console.log("WebSocket connection established");
      wsConnected = true;
      setError(null);
      // Register for this conversation
      if (newSocket.readyState === WebSocket.OPEN) {
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

        if (
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
            isMe: data.sender_id === user?.id,
          };

          setMessages((prev) => [...prev, newMessage]);

          // Notify parent component that there's a new message (updates conversation list)
          onConversationUpdated();
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    newSocket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setError(
        "Could not establish WebSocket connection. Falling back to polling."
      );
      wsConnected = false;
    };

    newSocket.onclose = () => {
      console.log("WebSocket connection closed");
      wsConnected = false;
    };

    setSocket(newSocket);

    // Polling fallback if WebSocket fails
    let pollingInterval: NodeJS.Timeout | null = null;

    const startPolling = () => {
      // Only start polling if WebSocket is not connected
      if (!wsConnected) {
        console.log("Starting polling fallback");
        // Poll every 3 seconds
        pollingInterval = setInterval(fetchLatestMessages, 3000);
      }
    };

    // Give WebSocket 2 seconds to connect, then start polling if needed
    const pollingTimeout = setTimeout(() => {
      if (!wsConnected) {
        startPolling();
      }
    }, 2000);

    // Cleanup function
    return () => {
      if (newSocket && newSocket.readyState === WebSocket.OPEN) {
        newSocket.close();
      }
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      clearTimeout(pollingTimeout);
    };
  }, [chat.id, user]);

  // Function to fetch the latest messages
  const fetchLatestMessages = async () => {
    if (!chat.id || !user) return;

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(
        `${backendUrl}/api/conversations/${chat.id}/messages?limit=20`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }

      const data = await response.json();

      if (data.messages && Array.isArray(data.messages)) {
        const formattedMessages: Message[] = data.messages.map((msg: any) => ({
          id: msg.id.toString(),
          senderId: msg.sender.id,
          senderName: `${msg.sender.first_name} ${msg.sender.last_name}`,
          senderAvatar: msg.sender.avatar,
          content: msg.content,
          timestamp: formatTimestamp(msg.timestamp),
          isMe: msg.sender.id === user?.id,
        }));

        // Check if we have new messages by comparing IDs
        const currentMessageIds = new Set(messages.map((m) => m.id));
        const newMessages = formattedMessages.filter(
          (msg) => !currentMessageIds.has(msg.id)
        );

        if (newMessages.length > 0) {
          setMessages((prev) => [...prev, ...newMessages]);
          onConversationUpdated();
        }
      }
    } catch (error) {
      console.error("Error polling messages:", error);
    }
  };

  // Load messages for the current conversation
  useEffect(() => {
    const fetchMessages = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
        const response = await fetch(
          `${backendUrl}/api/conversations/${chat.id}/messages`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch messages: ${response.status}`);
        }

        const data = await response.json();

        if (data.messages && Array.isArray(data.messages)) {
          const formattedMessages: Message[] = data.messages.map(
            (msg: any) => ({
              id: msg.id.toString(),
              senderId: msg.sender.id,
              senderName: `${msg.sender.first_name} ${msg.sender.last_name}`,
              senderAvatar: msg.sender.avatar,
              content: msg.content,
              timestamp: formatTimestamp(msg.timestamp),
              isMe: msg.sender.id === user?.id,
            })
          );

          setMessages(formattedMessages);
        }
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
  }, [chat.id, user]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
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
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const messageContent = message.trim();
    setMessage("");

    // Try to send via WebSocket first
    if (socket && socket.readyState === WebSocket.OPEN) {
      const messageData = {
        type: "chat_message",
        conversation_id: parseInt(chat.id),
        content: messageContent,
      };

      socket.send(JSON.stringify(messageData));
    } else {
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

        // Manually add the message to the UI to show it immediately
        const tempMessage: Message = {
          id: `temp-${Date.now()}`,
          senderId: user?.id || 0,
          senderName:
            user?.firstName && user?.lastName
              ? `${user.firstName} ${user.lastName}`
              : "You",
          content: messageContent,
          timestamp: formatTimestamp(new Date().toISOString()),
          isMe: true,
        };

        setMessages((prev) => [...prev, tempMessage]);

        // Fetch latest messages to get the properly stored message
        setTimeout(fetchLatestMessages, 500);
      } catch (error) {
        console.error("Error sending message via API:", error);
        setError("Failed to send message. Please try again.");
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCreateEvent = () => {
    // This would normally be sent to an API
    alert(
      `Event created: ${newEvent.title} on ${newEvent.date} at ${newEvent.time}`
    );
    setShowEventModal(false);
    setNewEvent({ title: "", description: "", date: "", time: "" });
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col">
        {/* Chat header */}
        <div className="px-4 py-3 border-b flex justify-between items-center bg-white">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
              {chat.isGroup ? (
                <div className="bg-indigo-100 h-full w-full flex items-center justify-center text-indigo-700">
                  <FaUsers size={18} />
                </div>
              ) : chat.avatar ? (
                <img
                  src={
                    chat.avatar.startsWith("http")
                      ? chat.avatar
                      : `${
                          process.env.NEXT_PUBLIC_BACKEND_URL ||
                          "http://localhost:8080"
                        }${chat.avatar}`
                  }
                  alt={chat.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                createAvatarFallback(chat.name)
              )}
            </div>
            <div className="ml-3">
              <h2 className="font-medium text-gray-900">{chat.name}</h2>
              {chat.isGroup && chat.members && (
                <p className="text-xs text-gray-500">
                  {chat.members.length} members
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {chat.isGroup && (
              <button
                onClick={() => setShowEventModal(true)}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-700 transition-colors"
                title="Create event"
              >
                <FaCalendarAlt size={18} />
              </button>
            )}
            <button
              onClick={() => setShowInfo(!showInfo)}
              className={`p-2 rounded-full hover:bg-gray-100 transition-colors ${
                showInfo ? "text-blue-600 bg-blue-50" : "text-gray-700"
              }`}
              title="Chat information"
            >
              <IoInformationCircle size={20} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {error ? (
            <div className="text-center py-8 text-red-500">{error}</div>
          ) : isLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No messages yet. Start the conversation!
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.isMe ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`flex max-w-[75%] ${
                      msg.isMe ? "flex-row-reverse" : ""
                    }`}
                  >
                    {!msg.isMe && (
                      <div className="flex-shrink-0 h-8 w-8 rounded-full overflow-hidden bg-gray-200 mr-2">
                        {msg.senderAvatar ? (
                          <img
                            src={
                              msg.senderAvatar.startsWith("http")
                                ? msg.senderAvatar
                                : `${
                                    process.env.NEXT_PUBLIC_BACKEND_URL ||
                                    "http://localhost:8080"
                                  }${msg.senderAvatar}`
                            }
                            alt={msg.senderName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          createAvatarFallback(msg.senderName)
                        )}
                      </div>
                    )}
                    <div className="flex flex-col">
                      {chat.isGroup && !msg.isMe && (
                        <span className="text-xs text-gray-500 mb-1 ml-1">
                          {msg.senderName}
                        </span>
                      )}
                      <div
                        className={`rounded-lg px-4 py-2 inline-block ${
                          msg.isMe
                            ? "bg-blue-600 text-white rounded-tr-none"
                            : "bg-white text-gray-800 rounded-tl-none shadow-sm"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                      </div>
                      <span
                        className={`text-xs mt-1 ${
                          msg.isMe
                            ? "text-gray-500 text-right"
                            : "text-gray-500 ml-1"
                        }`}
                      >
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message input */}
        <div className="p-3 border-t bg-white">
          <div className="flex items-end gap-2">
            <button
              className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
              title="Add attachment"
            >
              <IoAddCircle size={20} />
            </button>
            <div className="flex-1 relative">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="w-full p-3 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={1}
                style={{ maxHeight: "120px", minHeight: "44px" }}
              />
              <button
                className="absolute right-2 bottom-2 p-1.5 text-gray-500 hover:text-blue-600 rounded-full"
                title="Add emoji"
              >
                <FaSmile size={18} />
              </button>
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!message.trim()}
              className={`p-3 rounded-full ${
                message.trim()
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
              title="Send message"
            >
              <IoSend size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Info sidebar */}
      {showInfo && (
        <div className="w-80 border-l bg-white overflow-y-auto">
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg">Details</h3>
              <button
                onClick={() => setShowInfo(false)}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
              >
                <FaTimes size={16} />
              </button>
            </div>

            <div className="flex flex-col items-center mb-6">
              <div className="h-20 w-20 rounded-full overflow-hidden bg-gray-200 mb-3 flex items-center justify-center">
                {chat.isGroup ? (
                  <div className="bg-indigo-100 h-full w-full flex items-center justify-center text-indigo-700">
                    <FaUsers size={36} />
                  </div>
                ) : chat.avatar ? (
                  <img
                    src={
                      chat.avatar.startsWith("http")
                        ? chat.avatar
                        : `${
                            process.env.NEXT_PUBLIC_BACKEND_URL ||
                            "http://localhost:8080"
                          }${chat.avatar}`
                    }
                    alt={chat.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  createAvatarFallback(chat.name)
                )}
              </div>
              <h2 className="font-medium text-xl text-center">{chat.name}</h2>
              {chat.isGroup && (
                <p className="text-sm text-gray-500 mt-1">
                  Created on Jan 15, 2023
                </p>
              )}
            </div>

            {chat.isGroup && (
              <>
                <div className="mb-6">
                  <h4 className="font-medium text-sm text-gray-500 uppercase mb-2">
                    Description
                  </h4>
                  <p className="text-gray-700">
                    This is a group for discussing web development projects and
                    collaboration.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-sm text-gray-500 uppercase mb-2">
                    Members ({chat.members?.length || 0})
                  </h4>
                  <div className="space-y-2">
                    {chat.members?.map((member, index) => (
                      <div
                        key={index}
                        className="flex items-center p-2 hover:bg-gray-50 rounded-lg"
                      >
                        <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-200 mr-3 flex items-center justify-center">
                          {member.avatar ? (
                            <img
                              src={
                                member.avatar.startsWith("http")
                                  ? member.avatar
                                  : `${
                                      process.env.NEXT_PUBLIC_BACKEND_URL ||
                                      "http://localhost:8080"
                                    }${member.avatar}`
                              }
                              alt={member.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            createAvatarFallback(member.name)
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {member.name}
                          </p>
                          {index === 0 && (
                            <p className="text-xs text-gray-500">Creator</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {!chat.isGroup && (
              <div className="mb-6">
                <h4 className="font-medium text-sm text-gray-500 uppercase mb-2">
                  About
                </h4>
                <p className="text-gray-700">
                  Started chatting on Jan 15, 2023
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
    </div>
  );
}
