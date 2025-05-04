"use client";

import { useState, useEffect, useRef } from "react";
import { useSearch } from "@/context/SearchContext";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getImageUrl, createAvatarFallback } from "@/utils/image";

// Define the user type for search results
interface User {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  verified?: boolean;
  avatar: string;
  followers: number;
  description?: string;
  followedBy?: string[];
}

export default function SearchSidebar() {
  const [searchQuery, setSearchQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSearched = useRef<string>("");
  const { collapseSearch } = useSearch();
  const router = useRouter();

  // Focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Load recent searches from localStorage on mount
  useEffect(() => {
    const savedSearches = localStorage.getItem("recentSearches");
    if (savedSearches) {
      try {
        setRecentSearches(JSON.parse(savedSearches));
      } catch (e) {
        console.error("Failed to parse recent searches:", e);
      }
    }
  }, []);

  // Save recent searches to localStorage when they change
  useEffect(() => {
    localStorage.setItem("recentSearches", JSON.stringify(recentSearches));
  }, [recentSearches]);

  // Search when query changes with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    // Only search if query is at least 2 characters
    if (searchQuery.length < 2) {
      return;
    }

    const timer = setTimeout(() => {
      fetchSearchResults(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchSearchResults = async (query: string) => {
    if (!query.trim() || query.length < 2) return;

    // Check if we already searched for this exact query
    if (query === lastSearched.current) return;

    // Keep track of last searched query
    lastSearched.current = query;

    setIsSearching(true);
    setSearchError(null);

    try {
      // Use the Go backend API with timeout to prevent long waits
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(
        `${backendUrl}/api/users/search?q=${encodeURIComponent(query.trim())}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          credentials: "include", // Include cookies for authenticated requests
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`Search request failed with status: ${response.status}`);
        setSearchResults([]);
        return;
      }

      const data = await response.json();

      // Handle any response format gracefully
      if (!data || typeof data !== "object") {
        console.warn("Empty response received");
        setSearchResults([]);
        return;
      }

      // Check if users property exists and is an array, otherwise use empty array
      const users = data.users && Array.isArray(data.users) ? data.users : [];

      // Map the API response to match our User interface
      const mappedUsers = users.map((user) => ({
        id: user.id,
        username: user.email?.split("@")[0] || "user",
        firstName: user.first_name,
        lastName: user.last_name,
        nickname: user.nickname || null,
        verified: Boolean(user.verified), // Ensure boolean type
        avatar: user.avatar || "",
        followers: user.followers || 0, // Use followers count from API if available
        description: user.about_me || "",
        followedBy: user.followed_by || [],
      }));

      setSearchResults(mappedUsers);

      // Add to recent searches if not already there
      if (query.length > 2 && !recentSearches.includes(query)) {
        setRecentSearches((prev) => [query, ...prev.slice(0, 4)]);
      }
    } catch (error) {
      console.error("Search error:", error);
      // Don't show error in UI, but set empty results
      setSearchError(null);
      setSearchResults([]);

      // No need to retry if it's a network error - will only fail again
      if (
        !(error instanceof TypeError && error.message === "Failed to fetch")
      ) {
        // Only retry for non-network errors
        setTimeout(() => {
          if (query === searchQuery) {
            retrySearch(query);
          }
        }, 2000);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const retrySearch = async (query: string) => {
    try {
      setSearchError(null);

      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(
        `${backendUrl}/api/users/search?q=${encodeURIComponent(query.trim())}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(`Retry failed with status: ${response.status}`);
      }

      const data = await response.json();

      // Handle any response format gracefully
      if (!data || typeof data !== "object") {
        console.warn("Empty response received in retry");
        setSearchResults([]);
        return;
      }

      // Check if users property exists and is an array, otherwise use empty array
      const users = data.users && Array.isArray(data.users) ? data.users : [];

      // Map the API response to match our User interface
      const mappedUsers = users.map((user) => ({
        id: user.id,
        username: user.email?.split("@")[0] || "user",
        firstName: user.first_name,
        lastName: user.last_name,
        nickname: user.nickname || null,
        verified: Boolean(user.verified), // Ensure boolean type
        avatar: user.avatar || "",
        followers: user.followers || 0, // Use followers count from API if available
        description: user.about_me || "",
        followedBy: user.followed_by || [],
      }));

      setSearchResults(mappedUsers);
    } catch (error) {
      console.error("Retry search error:", error);
      setSearchError(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    fetchSearchResults(searchQuery);
  };

  const handleGoBack = () => {
    collapseSearch();
  };

  const handleNavigation = (path: string) => {
    collapseSearch();
    router.push(path);
  };

  return (
    <div className="w-80 h-screen fixed top-0 left-16 bg-white shadow-md border-r border-gray-200 z-20 overflow-hidden">
      <div className="p-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Search</h1>
          <button
            onClick={handleGoBack}
            className="text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-full hover:bg-gray-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M7.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l2.293 2.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              className="w-full px-4 py-2 pl-10 bg-gray-100 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-gray-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-gray-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>
        </form>

        {isSearching ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : searchError ? (
          <div className="text-center py-8 text-red-500">{searchError}</div>
        ) : searchResults.length > 0 ? (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-gray-500 mb-3">Results</h2>
            <div className="space-y-3">
              {searchResults.map((user) => (
                <div
                  key={`search-result-${user.id}`}
                  className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                  onClick={() => handleNavigation(`/profile/${user.id}`)}
                >
                  <div className="flex items-center">
                    <div className="w-10 h-10 relative rounded-full bg-gray-200 mr-3 overflow-hidden">
                      {user.avatar &&
                      user.avatar !== "/uploads/avatars/default.jpg" ? (
                        <div className="w-full h-full flex items-center justify-center bg-gray-200">
                          <Image
                            src={getImageUrl(user.avatar)}
                            alt={user.username}
                            width={40}
                            height={40}
                            className="object-cover w-full h-full"
                            style={{
                              animationPlayState: user.avatar.includes(
                                "static=1"
                              )
                                ? "paused"
                                : "running",
                            }}
                            onError={(e) =>
                              createAvatarFallback(
                                e.target as HTMLImageElement,
                                user.firstName.charAt(0),
                                "text-sm"
                              )
                            }
                          />
                        </div>
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
                      {user.verified && (
                        <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-1">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="white"
                            className="w-3 h-3"
                          >
                            <path
                              fillRule="evenodd"
                              d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center">
                        <p className="font-medium text-sm">
                          {user.firstName} {user.lastName}
                        </p>
                        {user.verified && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="w-4 h-4 ml-1 text-blue-500"
                          >
                            <path
                              fillRule="evenodd"
                              d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53-1.471-1.47a.75.75 0 00-1.06 1.06l2 2a.75.75 0 001.146-.102l4-5.598z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {user.nickname
                          ? `@${user.nickname}`
                          : `@${user.username}`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : searchQuery ? (
          <div className="text-center py-8 text-gray-500">
            No results found for "{searchQuery}"
          </div>
        ) : null}

        {!searchQuery && (
          <div className="mb-4">
            <h2 className="text-sm font-medium text-gray-500 mb-3">Recent</h2>

            {recentSearches.length > 0 ? (
              <div className="space-y-2">
                {recentSearches.map((search, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                    onClick={() => setSearchQuery(search)}
                  >
                    <div className="flex items-center">
                      <div className="bg-gray-200 rounded-full p-2 mr-3">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 text-gray-600"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <span className="text-sm">{search}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRecentSearches((prev) =>
                          prev.filter((_, i) => i !== index)
                        );
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                No recent searches.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
