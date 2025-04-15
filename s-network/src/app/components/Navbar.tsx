"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  // Search-related states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Ref to detect clicks outside the search container
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      try {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
        console.log("Checking auth status at:", `${backendUrl}/api/auth/check`);

        const response = await fetch(`${backendUrl}/api/auth/check`, {
          method: "GET",
          credentials: "include", // Include cookies in the request
        });

        if (response.ok) {
          const data = await response.json();
          setIsLoggedIn(data.authenticated === true);
        } else {
          setIsLoggedIn(false);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        setIsLoggedIn(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [pathname]);

  // Live search effect with 300ms debounce
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setSearchResults([]);
      return;
    }
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
    setSearchLoading(true);

    const timer = setTimeout(() => {
      fetch(`${backendUrl}/api/search?q=${encodeURIComponent(searchQuery)}`, {
        method: "GET",
        credentials: "include",
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error("Error fetching search results");
          }
          return res.json();
        })
        .then((data) => {
          // Ensure that searchResults is always an array even if data is null
          setSearchResults(Array.isArray(data) ? data : []);
        })
        .catch((error) => {
          console.error("Search error:", error);
          setSearchResults([]);
        })
        .finally(() => {
          setSearchLoading(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle click outside the search container to hide dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setSearchResults([]);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handles form submission. Navigates to a search results page.
  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchQuery.trim() === "") return;
    router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  const handleLogout = async () => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      console.log("Attempting logout at:", `${backendUrl}/api/logout`);

      await fetch(`${backendUrl}/api/logout`, {
        method: "POST",
        credentials: "include", // Include cookies in the request
      });

      setIsLoggedIn(false);

      if (pathname === "/") {
        window.location.reload();
      } else {
        router.push("/");
      }
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  if (loading) {
    return (
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-indigo-600">
                S-Network
              </Link>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Branding */}
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="text-xl font-bold text-indigo-600">
              S-Network
            </Link>
          </div>

          {/* Search Bar (only visible when logged in) */}
          {isLoggedIn && (
            <div
              className="flex items-center flex-1 justify-center relative"
              ref={searchContainerRef}
            >
              <form
                onSubmit={handleSearchSubmit}
                className="w-full max-w-md relative"
              >
                <input
                  type="text"
                  placeholder="Search users..."
                  className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchLoading && (
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">
                    Loading...
                  </div>
                )}
                {searchResults && searchResults.length > 0 && (
                  <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md max-h-60 overflow-auto">
                    {searchResults.map((user) => (
                      <li key={user.id} className="px-3 py-2 hover:bg-gray-100">
                        <Link href={`/profile/${user.id}`}>
                          {user.first_name} {user.last_name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </form>
            </div>
          )}

          {/* Navigation Links */}
          <div className="flex items-center">
            {isLoggedIn ? (
              <>
                <Link
                  href="/"
                  className={`px-3 py-2 mx-2 rounded-md text-sm font-medium ${
                    pathname === "/"
                      ? "bg-indigo-100 text-indigo-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Home
                </Link>
                <Link
                  href="/dashboard"
                  className={`px-3 py-2 mx-2 rounded-md text-sm font-medium ${
                    pathname === "/dashboard"
                      ? "bg-indigo-100 text-indigo-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/posts"
                  className={`px-3 py-2 mx-2 rounded-md text-sm font-medium ${
                    pathname === "/posts" || pathname.startsWith("/posts/")
                      ? "bg-indigo-100 text-indigo-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Posts
                </Link>
                <Link
                  href="/chats"
                  className={`px-3 py-2 mx-2 rounded-md text-sm font-medium ${
                    pathname === "/chats" || pathname.startsWith("/chats/")
                      ? "bg-indigo-100 text-indigo-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Chat
                </Link>
                <Link
                  href="/profile"
                  className={`px-3 py-2 mx-2 rounded-md text-sm font-medium ${
                    pathname === "/profile"
                      ? "bg-indigo-100 text-indigo-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 mx-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Logout
                </button>
              </>
            ) : (
              (pathname !== "/login" && pathname !== "/register") && (
                <>
                  {/* Add public-only links here if needed */}
                </>
              )
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
