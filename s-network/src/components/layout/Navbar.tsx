"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { FiSearch, FiUser, FiX, FiBell } from "react-icons/fi";
import Image from "next/image";
import { useNotifications } from "@/context/NotificationContext";

interface SearchResult {
  id: number;
  firstName: string;
  lastName: string;
  avatar: string;
  nickname?: string;
  verified: boolean;
  username: string;
}

interface NavbarProps {
  onNotificationClick?: () => void;
}

export default function Navbar({ onNotificationClick }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoggedIn, loading, logout } = useAuth();
  const { unreadCount, toggleNotificationSidebar } = useNotifications();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const searchResultsRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const accountDropdownRef = useRef<HTMLDivElement>(null);

  // Close search results when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchResultsRef.current &&
        !searchResultsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSearchResults(false);
      }

      // Close account dropdown when clicking outside
      if (
        accountDropdownRef.current &&
        !accountDropdownRef.current.contains(event.target as Node)
      ) {
        setShowAccountDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();

    try {
      await logout();

      // Use the router for all navigation to prevent full page reloads
      router.push("/");

      // If we're already on the home page, refresh the page state without a full reload
      if (pathname === "/") {
        router.refresh();
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Search functionality
  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (value.length > 1) {
      setIsSearching(true);
      try {
        // Add timeout to prevent long waits
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
        const response = await fetch(
          `${backendUrl}/api/users/search?q=${encodeURIComponent(
            value.trim()
          )}`,
          {
            method: "GET",
            credentials: "include",
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          // Safely check if data and data.users exist and are valid
          if (
            data &&
            typeof data === "object" &&
            data.users &&
            Array.isArray(data.users)
          ) {
            // Map the backend user data to our SearchResult interface
            const mappedResults = data.users.map((user: any) => ({
              id: user.id,
              firstName: user.first_name,
              lastName: user.last_name,
              avatar: user.avatar || "",
              nickname: user.nickname || null,
              verified: Boolean(user.verified), // Ensure boolean type
              username: user.email?.split("@")[0] || "", // Extract username for consistency
            }));

            setSearchResults(mappedResults);
            setShowSearchResults(mappedResults.length > 0);
          } else {
            setSearchResults([]);
            setShowSearchResults(false);
          }
        } else {
          console.error("Failed to fetch search results:", response.status);
          setSearchResults([]);
          setShowSearchResults(false);
        }
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
        setShowSearchResults(false);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  const handleSearchResultClick = (userId: number) => {
    setShowSearchResults(false);
    setSearchTerm("");
    router.push(`/profile/${userId}`);
  };

  const clearSearch = () => {
    setSearchTerm("");
    setSearchResults([]);
    setShowSearchResults(false);
  };

  if (loading) {
    return (
      <nav className="bg-white shadow fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        <Link href="/chats" className="text-xl font-bold text-indigo-600 flex items-center">
          <span className="hidden sm:inline">Social Network</span>
        </Link>
      </nav>
    );
  }

  return (
    <nav className="bg-white shadow fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
      <Link href="/chats" className="text-xl font-bold text-indigo-600 flex items-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 mr-2"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
          <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
        </svg>
        <span className="hidden sm:inline">Social Network</span>
      </Link>

      {isLoggedIn && (
        <div className="relative mx-auto max-w-md w-full px-4 hidden md:block">
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search for people..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full py-2 pl-10 pr-10 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <div className="absolute left-3 top-2.5 text-gray-400">
              <FiSearch size={20} />
            </div>
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <FiX size={20} />
              </button>
            )}
          </div>

          {showSearchResults && searchResults.length > 0 && (
            <div
              ref={searchResultsRef}
              className="absolute mt-1 w-full bg-white rounded-lg shadow-lg z-10 max-h-96 overflow-y-auto"
            >
              {searchResults.map((result) => (
                <div
                  key={`navbar-search-${result.id}`}
                  className="p-3 hover:bg-gray-100 cursor-pointer flex items-center"
                  onClick={() => handleSearchResultClick(result.id)}
                >
                  <div className="relative h-10 w-10 rounded-full overflow-hidden bg-gray-200 mr-3">
                    {result.avatar &&
                    result.avatar !== "/uploads/avatars/default.jpg" ? (
                      <Image
                        src={
                          result.avatar.startsWith("http")
                            ? result.avatar
                            : `${
                                process.env.NEXT_PUBLIC_BACKEND_URL ||
                                "http://localhost:8080"
                              }${
                                result.avatar.startsWith("/")
                                  ? result.avatar
                                  : `/${result.avatar}`
                              }`
                        }
                        alt={`${result.firstName} ${result.lastName}`}
                        fill
                        sizes="40px"
                        className="object-cover"
                        style={{
                          objectFit: "cover",
                          animationPlayState: result.avatar.includes("static=1")
                            ? "paused"
                            : "running",
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full w-full bg-gray-300">
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
                    <div className="font-medium flex items-center">
                      {result.firstName} {result.lastName}
                      {result.verified && (
                        <span className="ml-1 text-blue-500">✓</span>
                      )}
                    </div>
                    {result.nickname && (
                      <div className="text-sm text-gray-500">
                        @{result.nickname}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {isSearching && (
            <div className="absolute top-0 right-3 h-full flex items-center">
              <div className="animate-spin h-5 w-5 border-2 border-indigo-500 rounded-full border-t-transparent"></div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center space-x-4">
        {isLoggedIn ? (
          <>
            <button
              onClick={toggleNotificationSidebar}
              className="relative p-2 text-gray-600 hover:text-indigo-600 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Notifications"
            >
              <FiBell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            <div className="relative">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setShowAccountDropdown(!showAccountDropdown);
                }}
                className="flex items-center space-x-1 text-gray-600 hover:text-indigo-600"
              >
                <FiUser size={20} />
                <span className="hidden sm:inline text-sm font-medium">
                  Account
                </span>
              </button>
              {showAccountDropdown && (
                <div
                  ref={accountDropdownRef}
                  className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10"
                >
                  <Link
                    href="/profile"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50"
                    onClick={() => setShowAccountDropdown(false)}
                  >
                    Your Profile
                  </Link>
                  <Link
                    href="/dashboard"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50"
                    onClick={() => setShowAccountDropdown(false)}
                  >
                    Analytics Dashboard
                  </Link>
                  <Link
                    href="/settings"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50"
                    onClick={() => setShowAccountDropdown(false)}
                  >
                    Settings
                  </Link>
                  <button
                    onClick={(e) => {
                      setShowAccountDropdown(false);
                      handleLogout(e);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="text-gray-800 hover:text-indigo-600 text-sm font-medium"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
            >
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
