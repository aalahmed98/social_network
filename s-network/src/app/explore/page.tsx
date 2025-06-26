"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";
import { getImageUrl, createAvatarFallback } from "@/utils/image";

// Basic types
interface Post {
  id: number;
  title?: string;
  content: string;
  image_url?: string;
  privacy: string;
  created_at: string;
  updated_at: string;
  upvotes?: number;
  downvotes?: number;
  comment_count?: number;
  user_vote?: number;
  author: {
    id?: number;
    first_name: string;
    last_name: string;
    avatar?: string;
  };
  is_author?: boolean;
}

export default function Explore() {
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [voting, setVoting] = useState<{ [postId: number]: boolean }>({});
  const [postsLoading, setPostsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (isLoggedIn) {
      fetchPosts(1, true);
    } else {
      setPosts([]);
    }
  }, [isLoggedIn]);

  // Fetch posts from the API
  const fetchPosts = async (pageNum: number = 1, reset: boolean = false) => {
    if (postsLoading) return;

    setPostsLoading(true);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(
        `${backendUrl}/api/posts/explore?page=${pageNum}&limit=10`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const newPosts = data.posts || [];

        if (reset) {
          setPosts(newPosts);
        } else {
          setPosts((prev) => [...prev, ...newPosts]);
        }

        setHasMore(newPosts.length === 10);
        setPage(pageNum);
      } else if (response.status === 401) {
        router.push("/login");
      } else {
        console.error("Failed to fetch posts:", await response.text());
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setPostsLoading(false);
    }
  };

  // Load more posts
  const loadMore = () => {
    if (!postsLoading && hasMore) {
      fetchPosts(page + 1, false);
    }
  };

  // Handle vote
  const handleVote = async (postId: number, vote: number) => {
    if (voting[postId]) return;

    setVoting((prev) => ({ ...prev, [postId]: true }));

    try {
      const post = posts.find((p) => p.id === postId);
      if (!post) return;

      // Optimistic UI update
      const currentVote = post.user_vote || 0;
      const newVote = currentVote === vote ? 0 : vote;

      let newUpvotes = post.upvotes || 0;
      let newDownvotes = post.downvotes || 0;

      // Remove old vote
      if (currentVote === 1) newUpvotes--;
      if (currentVote === -1) newDownvotes--;

      // Add new vote if not toggling off
      if (newVote === 1) newUpvotes++;
      if (newVote === -1) newDownvotes++;

      // Update UI immediately
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                user_vote: newVote,
                upvotes: newUpvotes,
                downvotes: newDownvotes,
              }
            : p
        )
      );

      // Send request to server
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      await fetch(`${backendUrl}/api/posts/${postId}/vote`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ vote_type: vote }),
      });
    } catch (error) {
      console.error("Error voting:", error);
      // Refresh posts on error to ensure correct data
      fetchPosts(1, true);
    } finally {
      setVoting((prev) => ({ ...prev, [postId]: false }));
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

  // Truncate content for preview
  const truncateContent = (content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + "...";
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Welcome to Explore
          </h2>
          <p className="text-gray-600 mb-6">
            Please log in to discover posts from the community
          </p>
          <Link
            href="/login"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Log In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Explore Posts
          </h1>
          <p className="text-gray-600">
            Discover public posts from the community
          </p>
        </div>

        {/* Posts feed */}
        <div className="space-y-6">
          {postsLoading && posts.length === 0 && (
            <div className="bg-white shadow-md rounded-lg p-8 flex justify-center items-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
              <span className="ml-3 text-gray-600">Loading posts...</span>
            </div>
          )}

          {!postsLoading && posts.length === 0 && (
            <div className="bg-white shadow-md rounded-lg p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 text-gray-400 mb-4">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">
                No posts found
              </h3>
              <p className="text-gray-600">
                There are no public posts to explore yet.
              </p>
            </div>
          )}

          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-white rounded-lg border border-gray-200 shadow-md hover:shadow-lg transition-all overflow-hidden"
            >
              <div
                className="p-6 cursor-pointer"
                onClick={() => router.push(`/posts/${post.id}`)}
              >
                {/* Post header with user info */}
                <div className="flex items-center mb-4">
                  {/* User avatar */}
                  <div className="flex-shrink-0 mr-3">
                    {post.author.avatar ? (
                      <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-gray-100">
                        <Image
                          src={getImageUrl(post.author.avatar)}
                          alt={`${post.author.first_name} ${post.author.last_name}`}
                          width={48}
                          height={48}
                          className="object-cover"
                          onError={(e) =>
                            createAvatarFallback(
                              e.target as HTMLImageElement,
                              post.author.first_name.charAt(0),
                              "text-sm"
                            )
                          }
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-sm">
                        {post.author.first_name.charAt(0)}
                      </div>
                    )}
                  </div>

                  {/* Post metadata */}
                  <div className="flex-1">
                    <div className="flex items-center">
                      <span className="font-semibold text-gray-900 hover:text-indigo-600 cursor-pointer">
                        {post.author.first_name} {post.author.last_name}
                      </span>
                      <span className="mx-2 text-gray-400">·</span>
                      <span className="text-sm text-gray-500">
                        {formatDate(post.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center text-xs text-gray-400 mt-1">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Public
                    </div>
                  </div>
                </div>

                {/* Post content */}
                <div className="mb-4">
                  {post.title && (
                    <h2 className="text-xl font-bold mb-2 text-gray-900">
                      {post.title}
                    </h2>
                  )}
                  <div className="text-gray-700 whitespace-pre-line leading-relaxed">
                    {truncateContent(post.content)}
                  </div>
                </div>

                {/* Post image */}
                {post.image_url && (
                  <div className="mb-4 rounded-lg overflow-hidden bg-gray-50">
                    <Image
                      src={getImageUrl(post.image_url)}
                      alt={post.title || "Post image"}
                      width={600}
                      height={400}
                      className="w-full h-auto max-h-96 object-cover"
                    />
                  </div>
                )}
              </div>

              {/* Post actions */}
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {/* Upvote */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVote(post.id, 1);
                      }}
                      disabled={voting[post.id]}
                      className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        post.user_vote === 1
                          ? "bg-green-100 text-green-700"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
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
                          d="M7 11l5-5m0 0l5 5m-5-5v12"
                        />
                      </svg>
                      <span>{post.upvotes || 0}</span>
                    </button>

                    {/* Downvote */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVote(post.id, -1);
                      }}
                      disabled={voting[post.id]}
                      className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        post.user_vote === -1
                          ? "bg-red-100 text-red-700"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
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
                          d="M17 13l-5 5m0 0l-5-5m5 5V6"
                        />
                      </svg>
                      <span>{post.downvotes || 0}</span>
                    </button>

                    {/* Comments */}
                    <div className="flex items-center space-x-1 text-gray-600">
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
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                      </svg>
                      <span className="text-sm">{post.comment_count || 0}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => router.push(`/posts/${post.id}`)}
                    className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                  >
                    View Post
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Load more button */}
          {hasMore && posts.length > 0 && (
            <div className="text-center">
              <button
                onClick={loadMore}
                disabled={postsLoading}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {postsLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Loading...
                  </>
                ) : (
                  "Load More Posts"
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
