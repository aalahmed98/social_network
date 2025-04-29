"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Basic types
interface Post {
  id: number;
  content: string;
  image_url?: string;
  privacy: string;
  created_at: string;
  updated_at: string;
  author: {
    id?: number;
    first_name: string;
    last_name: string;
    avatar?: string;
  };
  is_author?: boolean;
}

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      try {
        // Use the backend API directly
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
        const response = await fetch(`${backendUrl}/api/auth/check`, {
          method: "GET",
          credentials: "include", // Include cookies in the request
        });

        if (response.ok) {
          const data = await response.json();
          setIsLoggedIn(data.authenticated === true);
          if (data.authenticated === true) {
            fetchPosts();
          }
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
  }, []);

  // Fetch posts from the API
  const fetchPosts = async () => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/posts?page=1&limit=10`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
      } else if (response.status === 401) {
        setIsLoggedIn(false);
      } else {
        console.error("Failed to fetch posts:", await response.text());
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
    }
  };

  // Delete a post
  const handleDeletePost = async (postId: number, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent navigation to post detail

    if (!window.confirm("Are you sure you want to delete this post?")) {
      return;
    }

    setDeleting(true);

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/posts/${postId}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        // Remove the post from the state
        setPosts(posts.filter((post) => post.id !== postId));
      } else {
        const errorText = await response.text();
        let errorMessage = "Unknown error";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        alert(`Failed to delete post: ${errorMessage}`);
        console.error("Failed to delete post:", errorText);
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      alert("An error occurred while deleting the post.");
    } finally {
      setDeleting(false);
    }
  };

  // Format date to a readable format
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <h1 className="text-2xl font-semibold text-gray-800">
            Loading your feed...
          </h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex justify-between items-center mb-8 pb-4 border-b border-gray-200">
          <div className="flex items-center">
            <h1 className="text-3xl font-bold text-indigo-800">S-Network</h1>
            <div className="ml-4 text-sm text-gray-500 hidden md:block"></div>
          </div>
        </header>

        {!isLoggedIn && (
          <div className="max-w-3xl mx-auto px-8 py-16 bg-white rounded-xl shadow-lg text-center">
            <h2 className="text-4xl font-bold mb-4 text-indigo-800">
              Welcome to S-Network
            </h2>
            <p className="text-xl mb-10 text-gray-600 max-w-lg mx-auto">
              Connect with colleagues, share ideas, and build your professional
              network with our secure and modern platform
            </p>

            <div className="flex gap-6 justify-center">
              <Link
                href="/login"
                className="px-8 py-4 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition-all transform hover:-translate-y-1 font-medium"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-8 py-4 border-2 border-indigo-600 text-indigo-600 rounded-lg shadow-md hover:bg-indigo-50 transition-all transform hover:-translate-y-1 font-medium"
              >
                Create Account
              </Link>
            </div>
          </div>
        )}

        {isLoggedIn && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Sidebar */}
              <div className="hidden lg:block">
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6 sticky top-4">
                  <h2 className="font-semibold text-lg mb-4 text-gray-700">
                    Quick Links
                  </h2>
                  <div className="space-y-2">
                    <Link
                      href="/posts"
                      className="flex items-center p-3 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-2"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Create Post
                    </Link>
                    <Link
                      href="/profile"
                      className="flex items-center p-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-2"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Profile
                    </Link>
                  </div>
                </div>
              </div>

              {/* Main Content - Posts feed */}
              <div className="lg:col-span-2">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">
                  Your Feed
                </h2>

                {posts.length > 0 ? (
                  <div className="space-y-6">
                    {posts.map((post) => (
                      <div
                        key={post.id}
                        className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200 hover:shadow-md transition-shadow"
                      >
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                              {post.author.avatar ? (
                                <img
                                  src={post.author.avatar}
                                  alt={`${post.author.first_name} ${post.author.last_name}`}
                                  className="w-10 h-10 rounded-full mr-3 object-cover border border-gray-200"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mr-3 font-semibold border border-gray-200">
                                  {post.author.first_name.charAt(0)}
                                  {post.author.last_name.charAt(0)}
                                </div>
                              )}
                              <div>
                                <div className="font-semibold text-gray-800">
                                  {post.author.first_name}{" "}
                                  {post.author.last_name}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center">
                                  <span>{formatDate(post.created_at)}</span>
                                  <span className="mx-1.5">•</span>
                                  <span className="inline-flex items-center">
                                    {post.privacy === "public" ? (
                                      <span className="flex items-center text-green-600">
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          className="h-3 w-3 mr-1"
                                          viewBox="0 0 20 20"
                                          fill="currentColor"
                                        >
                                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                          <path
                                            fillRule="evenodd"
                                            d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                                            clipRule="evenodd"
                                          />
                                        </svg>
                                        Public
                                      </span>
                                    ) : (
                                      <span className="flex items-center text-amber-600">
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          className="h-3 w-3 mr-1"
                                          viewBox="0 0 20 20"
                                          fill="currentColor"
                                        >
                                          <path
                                            fillRule="evenodd"
                                            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                                            clipRule="evenodd"
                                          />
                                        </svg>
                                        Private
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {post.is_author && (
                              <button
                                onClick={(e) => handleDeletePost(post.id, e)}
                                disabled={deleting}
                                className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50"
                                title="Delete post"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-5 w-5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            )}
                          </div>

                          <div className="mb-4 whitespace-pre-line text-gray-700">
                            {post.content}
                          </div>

                          {post.image_url && (
                            <div className="mb-4 rounded-lg overflow-hidden bg-gray-100">
                              <img
                                src={post.image_url}
                                alt="Post image"
                                className="w-full h-auto max-h-80 object-contain"
                              />
                            </div>
                          )}
                        </div>

                        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                          <div
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center"
                            onClick={() => router.push(`/posts/${post.id}`)}
                            style={{ cursor: "pointer" }}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5 mr-2"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z"
                                clipRule="evenodd"
                              />
                            </svg>
                            View post and comments
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white shadow-sm rounded-lg p-8 text-center border border-gray-200">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-12 w-12 mx-auto text-gray-400 mb-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                      />
                    </svg>
                    <p className="text-gray-500 mb-4">
                      No posts to display yet.
                    </p>
                    <Link
                      href="/posts"
                      className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-2"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Create Your First Post
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
