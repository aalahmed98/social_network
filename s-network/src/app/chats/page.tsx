"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";

interface ChatMessage {
  id?: string;
  sender?: string;
  content: string;
  type: string;
  timestamp: Date;
  isSystem?: boolean;
}

export default function Chats() {
  const [wsStatus, setWsStatus] = useState<string>("Connecting...");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [username, setUsername] = useState<string>("User");
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const connectingRef = useRef<boolean>(false);
  const isJoinedRef = useRef<boolean>(false);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Effect to scroll down whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Safely add a message to the state to prevent race conditions
  const addMessage = useCallback((newMessage: ChatMessage) => {
    setMessages(prevMessages => [...prevMessages, newMessage]);
  }, []);

  // Helper function to add system messages
  const addSystemMessage = useCallback((content: string) => {
    addMessage({
      content, 
      type: "system",
      timestamp: new Date(),
      isSystem: true
    });
  }, [addMessage]);

  // Function to establish WebSocket connection
  const connectWebSocket = useCallback(() => {
    // Prevent multiple connection attempts
    if (connectingRef.current) return;
    connectingRef.current = true;

    // Clear any existing connection
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {
        console.error("Error closing existing connection:", e);
      }
      wsRef.current = null;
    }

    // Clear any existing timeouts/intervals
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    setWsStatus("Connecting...");
    addSystemMessage("Attempting WebSocket connection...");
    
    try {
      // Create new WebSocket connection
      const ws = new WebSocket("ws://localhost:8080/ws/chat");
      wsRef.current = ws;
      
      // Connection established
      ws.onopen = () => {
        connectingRef.current = false;
        setWsStatus("Connected");
        addSystemMessage("WebSocket connection established!");

        // Reset joined flag
        isJoinedRef.current = false;
        
        // Send join message with username after a short delay
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ 
                type: "join", 
                message: `${username} has joined the chat`,
                sender: username,
                timestamp: new Date()
              }));
              isJoinedRef.current = true;
            } catch (e) {
              console.error("Error sending join message:", e);
            }
          }
        }, 1000);
        
        // Set up heartbeat to keep connection alive
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ 
                type: "heartbeat", 
                message: "Keep alive",
                timestamp: new Date()
              }));
            } catch (e) {
              console.error("Error sending heartbeat:", e);
              // Try to reconnect if heartbeat fails
              if (ws === wsRef.current) {
                connectWebSocket();
              }
            }
          }
        }, 30000); // Send heartbeat every 30 seconds
      };
      
      // Handle incoming messages
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Don't show heartbeat responses in the messages list
          if (data.type !== "heartbeat") {
            if (data.type === "welcome") {
              addSystemMessage(data.message);
            } else if (data.type === "message") {
              // Regular chat message
              addMessage({
                content: data.message,
                sender: data.sender,
                type: data.type,
                timestamp: new Date(data.time),
                id: data.id
              });
            } else if (data.type === "join") {
              // User joined
              addSystemMessage(data.message);
            } else if (data.type === "leave") {
              // User left
              addSystemMessage(data.message);
            } else if (data.type === "join_ack") {
              // Join acknowledgement
              addSystemMessage(data.message);
            } else {
              // Any other message type
              addSystemMessage(`Received: ${JSON.stringify(data)}`);
            }
          }
        } catch (e) {
          addSystemMessage(`Received: ${event.data}`);
        }
      };
      
      // Handle errors
      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setWsStatus("Error occurred");
        addSystemMessage("WebSocket error occurred");
        connectingRef.current = false;
      };
      
      // Handle connection closure
      ws.onclose = (event) => {
        setWsStatus("Disconnected");
        addSystemMessage(`WebSocket connection closed: ${event.reason || "No reason provided"}`);
        connectingRef.current = false;
        
        // Clear heartbeat interval when connection closes
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
        
        // Set up reconnection with exponential backoff
        const delay = Math.min(5000, 1000 * Math.pow(1.5, 1)); // Max 5 second delay
        addSystemMessage(`Reconnecting in ${delay/1000} seconds...`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, delay);
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      setWsStatus("Failed to connect");
      addSystemMessage("Failed to create WebSocket connection");
      connectingRef.current = false;
      
      // Try to reconnect after a delay
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 5000);
    }
  }, [username, addSystemMessage, addMessage]);

  // Connect on component mount and clean up on unmount
  useEffect(() => {
    connectWebSocket();
    
    // Cleanup function
    return () => {
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {
          console.error("Error closing WebSocket:", e);
        }
        wsRef.current = null;
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [connectWebSocket]);

  // Handle manual reconnection
  const handleReconnect = useCallback(() => {
    addSystemMessage("Manual reconnection initiated");
    connectWebSocket();
  }, [connectWebSocket, addSystemMessage]);

  // Handle sending a message
  const sendMessage = useCallback(() => {
    if (!inputMessage.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    
    try {
      const messageObj = {
        type: "message",
        message: inputMessage,
        sender: username,
        timestamp: new Date()
      };
      
      wsRef.current.send(JSON.stringify(messageObj));
      setInputMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      addSystemMessage("Failed to send message. Connection may be lost.");
      
      // Try to reconnect
      if (wsRef.current) {
        const ws = wsRef.current;
        setTimeout(() => {
          if (ws === wsRef.current) {
            connectWebSocket();
          }
        }, 1000);
      }
    }
  }, [inputMessage, username, addSystemMessage, connectWebSocket]);

  // Handle input key press (send on Enter)
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Update username and rejoin chat
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUsername = e.target.value || "User";
    setUsername(newUsername);
    
    // Send new username if already connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && isJoinedRef.current) {
      try {
        wsRef.current.send(JSON.stringify({ 
          type: "join", 
          message: `${newUsername} has joined the chat`,
          sender: newUsername,
          timestamp: new Date()
        }));
      } catch (e) {
        console.error("Error updating username:", e);
      }
    }
  };

  return (
    <div className="min-h-screen p-4 bg-gray-50">
      <h1 className="text-3xl font-bold mb-4 text-center">Chats</h1>
      
      <div className="max-w-4xl mx-auto bg-white shadow-md rounded-lg overflow-hidden">
        {/* Connection status bar */}
        <div className="p-3 border-b bg-gray-100 flex items-center justify-between">
          <div className="flex items-center">
            <div className={`px-3 py-1 rounded-full text-sm ${
              wsStatus === "Connected" 
                ? "bg-green-100 text-green-800" 
                : wsStatus === "Connecting..." 
                  ? "bg-yellow-100 text-yellow-800" 
                  : "bg-red-100 text-red-800"
            }`}>
              {wsStatus}
              {wsStatus === "Connected" && (
                <span className="ml-2 inline-block h-2 w-2 rounded-full bg-green-500"></span>
              )}
            </div>
            <button 
              onClick={handleReconnect}
              className="ml-3 px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition"
            >
              Reconnect
            </button>
          </div>
          
          <div className="flex items-center">
            <label htmlFor="username" className="text-sm text-gray-600 mr-2">Your Name:</label>
            <input 
              type="text" 
              id="username"
              value={username}
              onChange={handleUsernameChange}
              className="border rounded px-2 py-1 text-sm"
              maxLength={20}
            />
          </div>
        </div>
        
        {/* Chat messages container */}
        <div className="h-96 overflow-y-auto p-4 bg-gray-50">
          {messages.length === 0 ? (
            <p className="text-gray-500 italic text-center">No messages yet</p>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, index) => (
                <div key={index} className={`${
                  msg.isSystem
                    ? "bg-gray-100 text-gray-700 text-sm italic text-center py-1 px-3 rounded" 
                    : msg.sender === username
                      ? "bg-blue-100 text-blue-800 ml-12 rounded-lg p-3" 
                      : "bg-white border rounded-lg p-3 mr-12"
                }`}>
                  {!msg.isSystem && (
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-medium">{msg.sender || 'Unknown'}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  )}
                  <div>{msg.content}</div>
                </div>
              ))}
              <div ref={messagesEndRef} /> {/* Scroll anchor */}
            </div>
          )}
        </div>
        
        {/* Message input */}
        <div className="p-3 border-t flex">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-grow border rounded-l-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || wsStatus !== "Connected"}
            className={`px-4 rounded-r-lg font-medium ${
              !inputMessage.trim() || wsStatus !== "Connected"
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-500 text-white hover:bg-blue-600"
            }`}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
