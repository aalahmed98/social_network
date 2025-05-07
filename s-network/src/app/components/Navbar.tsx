"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { FiSearch, FiUser, FiX } from "react-icons/fi";
import Image from "next/image";

interface SearchResult {
  id: number;
  firstName: string;
  lastName: string;
  avatar: string;
  nickname?: string;
  verified: boolean;
  username: string;
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoggedIn, loading, logout } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchResultsRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    await logout();

    // If already on home page, refresh the page
    if (pathname === "/") {
      window.location.reload();
    } else {
      // If on other pages, redirect to home page
      router.push("/");
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
        <Link href="/" className="text-xl font-bold text-indigo-600">
          Social Network
        </Link>
      </nav>
    );
  }

  return (
    <nav className="bg-white shadow fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
      <Link href="/" className="text-xl font-bold text-indigo-600">
        Social Network
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
                            : `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"}${result.avatar.startsWith("/") ? result.avatar : `/${result.avatar}`}`
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

      {isLoggedIn ? (
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-white border border-gray-300 
            hover:bg-gray-100 transition-all duration-200 shadow-sm hover:shadow-md
            transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm"
        >
          Logout
        </button>
      ) : (
        pathname !== "/login" &&
        pathname !== "/register" && (
          <div className="flex gap-2">
            <Link
              href="/login"
              className="px-4 py-2 rounded-lg text-sm font-medium text-indigo-600 border border-gray-300 
                hover:bg-gray-50 transition-all duration-200 transform hover:-translate-y-0.5"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 
                hover:bg-indigo-700 transition-all duration-200 transform hover:-translate-y-0.5 shadow-sm hover:shadow-md"
            >
              Register
            </Link>
          </div>
        )
      )}
    </nav>
  );
}
