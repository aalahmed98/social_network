"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Avatar, ConfirmDialog } from "@/components/ui";
import { getImageUrl } from "@/utils/image";
import { useToast } from "@/context/ToastContext";

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

export default function Home() {
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [voting, setVoting] = useState<{ [postId: number]: boolean }>({});
  const [postsLoading, setPostsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [postToDelete, setPostToDelete] = useState<number | null>(null);

  useEffect(() => {
    // Fetch posts only if user is logged in and hasn't fetched yet
    if (isLoggedIn && !hasFetched) {
      fetchPosts();
    } else if (!isLoggedIn) {
      // Reset posts when logged out
      setPosts([]);
      setHasFetched(false);
    }
  }, [isLoggedIn, hasFetched]);

  // Fetch posts from the API
  const fetchPosts = async () => {
    if (postsLoading) return; // Prevent duplicate fetches

    setPostsLoading(true);
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
        setHasFetched(true);
      } else if (response.status === 401) {
        // Auth is handled by context now
      } else {
        console.error("Failed to fetch posts:", await response.text());
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setPostsLoading(false);
    }
  };

  // Show delete confirmation
  const showDeletePost = (postId: number, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent navigation to post detail
    setPostToDelete(postId);
    setShowDeleteConfirm(true);
  };

  // Delete a post
  const handleDeletePost = async () => {
    if (!postToDelete) return;

    setDeleting(true);

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/posts/${postToDelete}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        // Remove the post from the state
        setPosts(posts.filter((post) => post.id !== postToDelete));
      } else {
        const errorText = await response.text();
        let errorMessage = "Unknown error";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        showError("Delete Failed", `Failed to delete post: ${errorMessage}`);
        console.error("Failed to delete post:", errorText);
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      showError("Delete Error", "An error occurred while deleting the post.");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
      setPostToDelete(null);
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

  // Handle voting on a post
  const handleVote = async (
    postId: number,
    voteType: 1 | -1,
    event: React.MouseEvent
  ) => {
    event.stopPropagation(); // Prevent navigation to post detail

    if (voting[postId]) return; // Prevent double clicks

    setVoting((prev) => ({ ...prev, [postId]: true }));

    try {
      // Simple optimistic UI update
      // Determine the new vote state (toggle if same, change if different)
      const updatedPosts = posts.map((post) => {
        if (post.id === postId) {
          const currentVote = post.user_vote || 0;
          const newVote = currentVote === voteType ? 0 : voteType;

          // Update upvotes/downvotes
          let newUpvotes = post.upvotes || 0;
          let newDownvotes = post.downvotes || 0;

          // Remove old vote if exists
          if (currentVote === 1) newUpvotes--;
          if (currentVote === -1) newDownvotes--;

          // Add new vote if not toggling off
          if (newVote === 1) newUpvotes++;
          if (newVote === -1) newDownvotes++;

          return {
            ...post,
            user_vote: newVote,
            upvotes: newUpvotes,
            downvotes: newDownvotes,
          };
        }
        return post;
      });

      // Update UI immediately
      setPosts(updatedPosts);

      // Send API request
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      await fetch(`${backendUrl}/api/posts/${postId}/vote`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ vote_type: voteType }),
      });

      // Note: We're not updating the UI again with the server response
      // This makes the vote appear immediate, without waiting for the server
    } catch (error) {
      console.error("Error voting on post:", error);
      // On error, refresh posts to ensure data consistency
      fetchPosts();
    } finally {
      setVoting((prev) => ({ ...prev, [postId]: false }));
    }
  };

  return (
    <div className="py-6">
      <div className="max-w-6xl mx-auto px-4">
        {!isLoggedIn && (
          <div className="max-w-3xl mx-auto px-8 py-16 bg-white rounded-xl shadow-lg text-center transition-all hover:shadow-xl">
            <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-transparent bg-clip-text">
              Welcome to S-Network
            </h2>
            <p className="text-xl mb-10 text-gray-600 max-w-lg mx-auto leading-relaxed">
              Connect with colleagues, share ideas, and build your professional
              network with our secure and modern platform
            </p>

            <div className="flex gap-6 justify-center">
              <Link
                href="/login"
                className="px-8 py-4 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-all transform hover:-translate-y-1 font-medium"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-8 py-4 border-2 border-blue-600 text-blue-600 rounded-lg shadow-md hover:bg-blue-50 transition-all transform hover:-translate-y-1 font-medium"
              >
                Create Account
              </Link>
            </div>
          </div>
        )}

        {isLoggedIn && (
          <div className="flex flex-col md:flex-row gap-6">
            {/* Main Content - Posts feed */}
            <div className="flex-1">
              <h2 className="text-xl font-semibold mb-5 text-gray-800 flex items-center"></h2>

              {postsLoading && (
                <div className="bg-white shadow-md rounded-lg p-8 flex justify-center items-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                  <span className="ml-3 text-gray-600">Loading posts...</span>
                </div>
              )}

              {!postsLoading && posts.length > 0 && (
                <div className="space-y-4">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="bg-white rounded-lg border border-gray-200 shadow-md hover:shadow-lg transition-all overflow-hidden"
                    >
                      {/* Modern post layout */}
                      <div className="flex">
                        {/* Vote buttons - left side */}
                        <div className="bg-gray-50 w-12 flex flex-col items-center py-4 border-r border-gray-100">
                          <button
                            onClick={(e) => handleVote(post.id, 1, e)}
                            className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
                              post.user_vote === 1
                                ? "text-orange-500 bg-orange-50"
                                : "text-gray-400 hover:text-orange-500 hover:bg-orange-50"
                            }`}
                            disabled={voting[post.id]}
                            aria-label="Upvote"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="w-5 h-5"
                            >
                              <path d="M12 4l8 8h-6v8h-4v-8H4z" />
                            </svg>
                          </button>
                          <span
                            className={`text-sm font-medium my-1 ${
                              post.user_vote === 1
                                ? "text-orange-500"
                                : post.user_vote === -1
                                ? "text-blue-500"
                                : "text-gray-700"
                            }`}
                          >
                            {(post.upvotes || 0) - (post.downvotes || 0)}
                          </span>
                          <button
                            onClick={(e) => handleVote(post.id, -1, e)}
                            className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
                              post.user_vote === -1
                                ? "text-blue-500 bg-blue-50"
                                : "text-gray-400 hover:text-blue-500 hover:bg-blue-50"
                            }`}
                            disabled={voting[post.id]}
                            aria-label="Downvote"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="w-5 h-5"
                            >
                              <path d="M12 20l-8-8h6V4h4v8h6z" />
                            </svg>
                          </button>
                        </div>

                        {/* Post content - right side */}
                        <div
                          className="p-4 w-full cursor-pointer"
                          onClick={() => router.push(`/posts/${post.id}`)}
                        >
                          {/* Post header with user info */}
                          <div className="flex items-center mb-3">
                            {/* User avatar */}
                            <div className="flex-shrink-0 mr-3">
                              <Avatar
                                avatar={post.author.avatar}
                                firstName={post.author.first_name}
                                lastName={post.author.last_name}
                                size="md"
                                className="border-2 border-gray-100"
                              />
                            </div>

                            {/* Post metadata */}
                            <div className="flex flex-col">
                              <div className="flex items-center">
                                <span className="font-semibold text-gray-900 mr-1 text-sm">
                                  {post.author.first_name}{" "}
                                  {post.author.last_name}
                                </span>
                              </div>
                              <div className="flex items-center text-xs text-gray-500">
                                <span>{formatDate(post.created_at)}</span>
                                <span className="mx-1">·</span>
                                <span className="flex items-center">
                                  {post.privacy === "public" ? (
                                    <>
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
                                    </>
                                  ) : post.privacy === "almost_private" ? (
                                    <>
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
                                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                        />
                                      </svg>
                                      Followers
                                    </>
                                  ) : (
                                    <>
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
                                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                        />
                                      </svg>
                                      Private
                                    </>
                                  )}
                                </span>
                              </div>
                            </div>

                            {/* Post controls for author */}
                            {post.is_author && (
                              <button
                                onClick={(e) => {
                                  showDeletePost(post.id, e);
                                }}
                                disabled={deleting}
                                className="ml-auto text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-gray-100 transition-colors"
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

                          {/* Post title */}
                          <h3 className="text-lg font-medium mb-2 text-gray-900 leading-snug">
                            {post.title || post.content.split("\n")[0]}
                          </h3>

                          {/* Post content */}
                          <div className="mb-4 text-sm text-gray-800 leading-relaxed line-clamp-3">
                            {post.content}
                          </div>

                          {/* Post image */}
                          {post.image_url && (
                            <div className="mb-4 rounded-lg overflow-hidden bg-gray-50 border border-gray-200 shadow-sm relative">
                              <div
                                className="absolute inset-0 bg-no-repeat bg-center bg-cover blur-xl opacity-30 scale-110"
                                style={{
                                  backgroundImage: `url(${getImageUrl(
                                    post.image_url
                                  )})`,
                                }}
                              ></div>
                              <div className="relative z-10 flex justify-center bg-transparent">
                                <img
                                  src={getImageUrl(post.image_url)}
                                  alt="Post image"
                                  className="max-w-full mx-auto max-h-72 object-contain"
                                />
                              </div>
                            </div>
                          )}

                          {/* Post footer with actions */}
                          <div className="flex text-xs text-gray-600 pt-2 border-t border-gray-100">
                            <div
                              className="flex items-center mr-4 py-1.5 px-2.5 rounded-full hover:bg-gray-100 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/posts/${post.id}`);
                              }}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4 mr-1.5 text-gray-500"
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
                              <span>{post.comment_count || 0} Comments</span>
                            </div>
                            <div
                              className="flex items-center mr-4 py-1.5 px-2.5 rounded-full hover:bg-gray-100 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard
                                  .writeText(
                                    window.location.origin + `/posts/${post.id}`
                                  )
                                  .then(() =>
                                    showSuccess(
                                      "Link Copied",
                                      "Link copied to clipboard!"
                                    )
                                  )
                                  .catch((err) => {
                                    console.error("Failed to copy: ", err);
                                    showError(
                                      "Copy Failed",
                                      "Failed to copy link to clipboard"
                                    );
                                  });
                              }}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4 mr-1.5 text-gray-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                                />
                              </svg>
                              <span>Share</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!postsLoading && posts.length === 0 && (
                <div className="bg-white shadow-md rounded-lg p-10 text-center border border-gray-200 transition-all hover:shadow-lg">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-16 w-16 mx-auto text-gray-400 mb-5"
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
                  <p className="text-gray-500 mb-5 text-lg">
                    No posts to display yet.
                  </p>
                  <Link
                    href="/posts"
                    className="inline-flex items-center justify-center px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm hover:shadow"
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
        )}
      </div>

      {/* Delete Post Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setPostToDelete(null);
        }}
        onConfirm={handleDeletePost}
        title="Delete Post"
        message="Are you sure you want to delete this post? This action cannot be undone."
        confirmText="Delete Post"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}
