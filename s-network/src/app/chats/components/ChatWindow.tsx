"use client";

import { useState, useRef, useEffect } from "react";
import { Chat } from "../page";
import { IoSend, IoInformationCircle, IoAddCircle } from "react-icons/io5";
import { FaSmile, FaUsers, FaCalendarAlt, FaTimes } from "react-icons/fa";
import { getImageUrl, createAvatarFallback } from "@/utils/image";
import * as Dialog from "@radix-ui/react-dialog";
import { useAuth } from "@/context/AuthContext";

interface Message {
  id: string;
  senderId: string | number;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: string;
  timestampRaw?: string;
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
  const { isLoggedIn } = useAuth();
  const [currentUser, setCurrentUser] = useState<any>(null);

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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

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
    if (!currentUser) return;

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

        // Handle different message types
        if (data.type === "registered") {
          console.log("Successfully registered for conversation:", data.conversation_id);
        } else if (data.type === "connected") {
          console.log("WebSocket connected:", data.status);
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
                    new Date(existingMsg.timestampRaw || existingMsg.timestamp).getTime() -
                    new Date(newMessage.timestampRaw || newMessage.timestamp).getTime()
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
  }, [chat.id, currentUser]);

  // Function to fetch the latest messages
  const fetchLatestMessages = async () => {
    if (!chat.id || !currentUser) return;

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
        const formattedMessages: Message[] = data.messages.map((msg: any) => {
          const isCurrentUser =
            String(msg.sender.id) === String(currentUser?.id) ||
            Number(msg.sender.id) === Number(currentUser?.id);

          return {
            id: msg.id.toString(),
            senderId: msg.sender.id,
            senderName: `${msg.sender.first_name} ${msg.sender.last_name}`,
            senderAvatar: msg.sender.avatar,
            content: msg.content,
            timestamp: formatTimestamp(msg.created_at),
            timestampRaw: msg.created_at,
            isMe: isCurrentUser,
          };
        });

        // Sort messages by timestamp (oldest first)
        formattedMessages.sort((a, b) => {
          const timeA = new Date(a.timestampRaw || a.timestamp).getTime();
          const timeB = new Date(b.timestampRaw || b.timestamp).getTime();
          return timeA - timeB;
        });

        // Check if we have new messages by comparing IDs
        const currentMessageIds = new Set(messages.map((m) => m.id));
        const newMessages = formattedMessages.filter(
          (msg) => !currentMessageIds.has(msg.id)
        );

        if (newMessages.length > 0) {
          setMessages((prev) => {
            // Combine previous messages with new ones and sort by timestamp
            const allMessages = [...prev, ...newMessages];
            allMessages.sort((a, b) => {
              const timeA = new Date(a.timestampRaw || a.timestamp).getTime();
              const timeB = new Date(b.timestampRaw || b.timestamp).getTime();
              return timeA - timeB;
            });
            return allMessages;
          });
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
          const formattedMessages: Message[] = data.messages.map((msg: any) => {
            const isCurrentUser =
              String(msg.sender.id) === String(currentUser?.id) ||
              Number(msg.sender.id) === Number(currentUser?.id);

            return {
              id: msg.id.toString(),
              senderId: msg.sender.id,
              senderName: `${msg.sender.first_name} ${msg.sender.last_name}`,
              senderAvatar: msg.sender.avatar,
              content: msg.content,
              timestamp: formatTimestamp(msg.created_at),
              timestampRaw: msg.created_at,
              isMe: isCurrentUser,
            };
          });

          // Sort messages by timestamp (oldest first)
          formattedMessages.sort((a, b) => {
            const timeA = new Date(a.timestampRaw || a.timestamp).getTime();
            const timeB = new Date(b.timestampRaw || b.timestamp).getTime();
            return timeA - timeB;
          });

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

    // Try to send via WebSocket first
    if (socket && socket.readyState === WebSocket.OPEN) {
      const messageData = {
        type: "chat_message",
        conversation_id: parseInt(chat.id),
        content: messageContent,
      };
      socket.send(JSON.stringify(messageData));
      // Don't add optimistic message for WebSocket - wait for server response
      return;
    }
    
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
      console.error("Error sending message via API:", error);
      setError("Failed to send message. Please try again.");
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

  // Emoji picker handler (native for now)
  const handleEmojiClick = () => {
    // Use the native emoji picker (works in most modern browsers)
    // This will open the OS emoji picker
    if (navigator.userAgent.includes("Windows")) {
      // Windows: Win + .
      alert("Press Win + . (dot) to open the emoji picker.");
    } else if (navigator.userAgent.includes("Mac")) {
      // Mac: Cmd + Ctrl + Space
      alert("Press Cmd + Ctrl + Space to open the emoji picker.");
    } else {
      alert("Use your system's emoji picker shortcut.");
    }
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
                <div className="w-full h-full flex items-center justify-center bg-gray-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="1.5"
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
                    className={`flex items-end max-w-[85%] ${
                      msg.isMe ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    {!msg.isMe && (
                      <div className="flex-shrink-0 h-8 w-8 rounded-full overflow-hidden bg-gray-200 mr-3 mb-1">
                        {msg.senderAvatar &&
                        msg.senderAvatar !== "/uploads/avatars/default.jpg" ? (
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
                    )}

                    <div
                      className={`flex flex-col ${
                        msg.isMe ? "items-end" : "items-start"
                      }`}
                    >
                      {chat.isGroup && !msg.isMe && (
                        <span className="text-xs text-gray-500 mb-1 px-2">
                          {msg.senderName}
                        </span>
                      )}

                      <div
                        className={`relative px-4 py-2 rounded-2xl max-w-sm break-words ${
                          msg.isMe
                            ? "bg-blue-600 text-white rounded-br-md"
                            : "bg-gray-300 text-gray-900 rounded-bl-md"
                        }`}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </p>

                        <div
                          className={`text-xs mt-1 ${
                            msg.isMe ? "text-blue-100" : "text-gray-700"
                          }`}
                        >
                          {msg.timestamp}
                        </div>
                      </div>
                    </div>

                    {msg.isMe && (
                      <div className="flex-shrink-0 h-8 w-8 ml-3 mb-1">
                        {/* Spacer for alignment */}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message input */}
        <div className="flex items-center gap-2 p-4 border-t bg-white">
          <button
            type="button"
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
            title="Add emoji"
            onClick={handleEmojiClick}
          >
            <FaSmile size={20} />
          </button>
          <textarea
            className="flex-1 resize-none border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={1}
            placeholder="Type your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ minHeight: 36 }}
          />
          <button
            type="button"
            className="ml-2 p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            onClick={handleSendMessage}
            disabled={!message.trim()}
            title="Send"
          >
            <IoSend size={20} />
          </button>
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
                  <div className="w-full h-full flex items-center justify-center bg-gray-300">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="1.5"
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
                            <div className="w-full h-full flex items-center justify-center bg-gray-300">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="white"
                                strokeWidth="1.5"
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
