"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import Image from "next/image";
import { getImageUrl, createAvatarFallback } from "@/utils/image";
import { useToast } from "@/context/ToastContext";
import { ConfirmDialog, Avatar } from "@/components/ui";

// Post type definition
interface Post {
  id: number;
  title?: string;
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
  comments?: Comment[];
  is_author?: boolean;
  user_vote?: number;
  upvotes?: number;
  downvotes?: number;
}

// Comment type definition
interface Comment {
  id: number;
  content: string;
  image_url?: string;
  created_at: string;
  user_id?: number;
  author: {
    id?: number;
    first_name: string;
    last_name: string;
    avatar?: string;
  };
  is_author?: boolean;
  is_post_author?: boolean;
  vote_count: number;
  user_vote: number;
}

export default function PostDetail() {
  const router = useRouter();
  const params = useParams();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const [post, setPost] = useState<Post | null>(null);
  const [commentContent, setCommentContent] = useState("");
  const [commentImage, setCommentImage] = useState<File | null>(null);
  const [commentImagePreview, setCommentImagePreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [voting, setVoting] = useState(false);
  const [showDeletePostConfirm, setShowDeletePostConfirm] = useState(false);
  const [showDeleteCommentConfirm, setShowDeleteCommentConfirm] =
    useState(false);
  const [commentToDelete, setCommentToDelete] = useState<number | null>(null);

  // Get post ID from URL params
  const postId = params?.id as string;

  useEffect(() => {
    if (postId) {
      fetchPost();
      fetchCurrentUser();
    }
  }, [postId]);

  // Fetch current user info to check ownership
  const fetchCurrentUser = async () => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/users/me`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const user = await response.json();
        setCurrentUserId(user.id);
      }
    } catch (error) {
      console.error("Error fetching current user:", error);
    }
  };

  // Fetch post details
  const fetchPost = async () => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/posts/${postId}`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPost(data);
      } else if (response.status === 401) {
        router.push("/login");
      } else if (response.status === 404) {
        setError("Post not found");
      } else {
        const errorText = await response.text();
        console.error("Failed to load post:", errorText);
        setError("Failed to load post");
      }
    } catch (error) {
      console.error("Error fetching post:", error);
      setError("An error occurred while loading the post");
    }
  };

  // Handle delete post
  const handleDeletePost = async () => {
    setDeleting(true);

    try {
              if (process.env.NODE_ENV === 'development') {
          console.log(`Attempting to delete post with ID: ${postId}`);
        }
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/posts/${postId}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

              if (process.env.NODE_ENV === 'development') {
          console.log(`Delete post response status: ${response.status}`);
        }

      if (response.ok) {
        if (process.env.NODE_ENV === 'development') {
          console.log("Post deleted successfully");
        }
        router.push("/");
      } else {
        const errorText = await response.text();
        console.error("Error response text:", errorText);

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
      console.error("Error details:", error);
      showError("Delete Error", "An error occurred while deleting the post.");
    } finally {
      setDeleting(false);
    }
  };

  // Show delete comment confirmation
  const showDeleteComment = (commentId: number) => {
    setCommentToDelete(commentId);
    setShowDeleteCommentConfirm(true);
  };

  // Handle delete comment
  const handleDeleteComment = async () => {
    if (!commentToDelete) return;

    setDeleting(true);

    try {
      console.log(
        `Attempting to delete comment with ID: ${commentToDelete} from post: ${postId}`
      );
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(
        `${backendUrl}/api/posts/${postId}/comments/${commentToDelete}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log(`Delete comment response status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        console.log("Updated comments received:", data.comments);

        if (post) {
          // Update post with the updated comments that include is_author flags
          setPost({
            ...post,
            comments: data.comments,
          });
        }
        console.log("Comment deleted successfully");
      } else {
        const errorText = await response.text();
        console.error("Error response text:", errorText);

        let errorMessage = "Unknown error";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        showError("Delete Failed", `Failed to delete comment: ${errorMessage}`);
        console.error("Failed to delete comment:", errorText);
      }
    } catch (error) {
      console.error("Error details:", error);
      showError(
        "Delete Error",
        "An error occurred while deleting the comment."
      );
    } finally {
      setDeleting(false);
      setShowDeleteCommentConfirm(false);
      setCommentToDelete(null);
    }
  };

  // Handle comment image selection
  const handleCommentImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCommentImage(file);
      setCommentImagePreview(URL.createObjectURL(file));
    }
  };

  // Add a new comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!commentContent.trim() && !commentImage) {
      showWarning(
        "Comment Required",
        "Please enter a comment or add an image."
      );
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("content", commentContent);

      if (commentImage) {
        formData.append("image", commentImage);
      }

      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(
        `${backendUrl}/api/posts/${postId}/comments`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      if (response.ok) {
        const data = await response.json();

        console.log("New comments received:", data.comments);

        // Update post with new comments
        if (post) {
          setPost({
            ...post,
            comments: data.comments, // These now include is_author flags from the backend
          });
        }

        // Reset form
        setCommentContent("");
        setCommentImage(null);
        setCommentImagePreview("");
      } else {
        const errorText = await response.text();
        let errorMessage = "Unknown error";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        showError("Comment Failed", `Failed to add comment: ${errorMessage}`);
        console.error("Failed to add comment:", errorText);
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      showError("Comment Error", "An error occurred while adding the comment.");
    } finally {
      setLoading(false);
    }
  };

  // Format date to readable string
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Handle vote
  const handleVote = async (vote: number) => {
    if (post) {
      setVoting(true);
      try {
        // Optimistic UI update
        const currentVote = post.user_vote || 0;
        const newVote = currentVote === vote ? 0 : vote;

        // Calculate new vote counts
        let newUpvotes = post.upvotes || 0;
        let newDownvotes = post.downvotes || 0;

        // Remove old vote if exists
        if (currentVote === 1) newUpvotes--;
        if (currentVote === -1) newDownvotes--;

        // Add new vote if not toggling off
        if (newVote === 1) newUpvotes++;
        if (newVote === -1) newDownvotes++;

        // Update the UI immediately
        setPost({
          ...post,
          user_vote: newVote,
          upvotes: newUpvotes,
          downvotes: newDownvotes,
        });

        // Send the request to the server
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

        // Note: We're not updating from server response to make it feel instantaneous
      } catch (error) {
        console.error("Error voting:", error);
        // On error, refresh the post to ensure correct data
        fetchPost();
      } finally {
        setVoting(false);
      }
    }
  };

  // Handle comment vote
  const handleCommentVote = async (commentId: number, vote: number) => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(
        `${backendUrl}/api/posts/${postId}/comments/${commentId}/vote`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ vote_type: vote }),
        }
      );

      if (response.ok) {
        const data = await response.json();

        // Update the comment in the post state
        if (post && post.comments) {
          const updatedComments = post.comments.map((comment) => {
            if (comment.id === commentId) {
              return {
                ...comment,
                vote_count: data.vote_count,
                user_vote: data.user_vote,
              };
            }
            return comment;
          });

          setPost({
            ...post,
            comments: updatedComments,
          });
        }
      } else {
        const errorText = await response.text();
        console.error("Error voting on comment:", errorText);
      }
    } catch (error) {
      console.error("Error voting on comment:", error);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className="bg-white shadow rounded-lg p-6 text-center">
          <p className="text-red-500 text-lg">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className="bg-white shadow rounded-lg p-6 text-center">
          <p className="text-gray-500">Loading post...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-2 sm:p-4 bg-gray-100">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.push("/")}
          className="mb-3 sm:mb-4 text-blue-500 hover:text-blue-700 flex items-center text-sm sm:text-base"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 sm:h-5 sm:w-5 mr-1"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
          Back to Home
        </button>

        {/* Post */}
        <div className="bg-white shadow-lg rounded-lg overflow-hidden mb-4 sm:mb-6 border border-gray-200 transition-all hover:shadow-xl">
          {/* Post Header */}
          <div className="flex items-center px-3 sm:px-6 pt-3 sm:pt-4 pb-2 border-b border-gray-100">
            {/* Author avatar */}
            <div className="flex-shrink-0 mr-2 sm:mr-3">
              <Avatar
                avatar={post?.author.avatar}
                firstName={post?.author.first_name}
                lastName={post?.author.last_name}
                size="md"
                className="border-2 border-gray-100 w-8 h-8 sm:w-10 sm:h-10"
              />
            </div>

            {/* Post metadata */}
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-semibold text-gray-900 text-sm sm:text-base">
                {post?.author.first_name} {post?.author.last_name}
              </span>
              <div className="flex items-center text-xs text-gray-500">
                <span className="truncate">{post && formatDate(post.created_at)}</span>
                <span className="mx-1">·</span>
                <span className="flex items-center flex-shrink-0">
                  {post?.privacy === "public" ? (
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
                      <span className="hidden sm:inline">Public</span>
                    </>
                  ) : post?.privacy === "almost_private" ? (
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
                      <span className="hidden sm:inline">Followers Only</span>
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
                      <span className="hidden sm:inline">Private</span>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Delete button for post owner */}
            {post.is_author && (
              <button
                onClick={() => setShowDeletePostConfirm(true)}
                disabled={deleting}
                className="ml-auto text-gray-400 hover:text-red-500 p-1 sm:p-2 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
                title="Delete post"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 sm:h-5 sm:w-5"
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

          {/* Post Content */}
          <div className="flex px-3 sm:px-6 min-w-0">
            {/* Left vote column - mobile optimized */}
            <div className="pt-3 sm:pt-4 w-8 sm:w-10 flex flex-col items-center flex-shrink-0">
              <button
                onClick={() => handleVote(1)}
                disabled={voting}
                className={`w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-md transition-colors ${
                  post.user_vote === 1
                    ? "text-orange-500 bg-orange-50"
                    : "text-gray-400 hover:text-orange-500 hover:bg-orange-50"
                }`}
                title="Upvote"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-4 h-4 sm:w-5 sm:h-5"
                >
                  <path d="M12 4l8 8h-6v8h-4v-8H4z" />
                </svg>
              </button>

              <div
                className={`text-xs sm:text-sm font-medium my-1 ${
                  post.user_vote === 1
                    ? "text-orange-500"
                    : post.user_vote === -1
                    ? "text-blue-500"
                    : "text-gray-800"
                }`}
              >
                {((post.upvotes || 0) - (post.downvotes || 0)).toString()}
              </div>

              <button
                onClick={() => handleVote(-1)}
                disabled={voting}
                className={`w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-md transition-colors ${
                  post.user_vote === -1
                    ? "text-blue-500 bg-blue-50"
                    : "text-gray-400 hover:text-blue-500 hover:bg-blue-50"
                }`}
                title="Downvote"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-4 h-4 sm:w-5 sm:h-5"
                >
                  <path d="M12 20l-8-8h6V4h4v8h6z" />
                </svg>
              </button>
            </div>

            {/* Main content - mobile optimized */}
            <div className="flex-1 py-3 sm:py-4 pl-2 sm:pl-4 min-w-0 overflow-hidden">
              {post?.title && (
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4 text-gray-900 break-words">
                  {post.title}
                </h1>
              )}
              <div className="whitespace-pre-line text-gray-800 mb-3 sm:mb-4 text-sm sm:text-base leading-relaxed break-words">
                {post?.content}
              </div>

              {post?.image_url && (
                <div className="mb-4 sm:mb-5 rounded-lg overflow-hidden bg-gray-50 border border-gray-200 shadow-sm relative">
                  <div
                    className="absolute inset-0 bg-no-repeat bg-center bg-cover blur-xl opacity-30 scale-110"
                    style={{
                      backgroundImage: `url(${getImageUrl(post.image_url)})`,
                    }}
                  ></div>
                  <div className="relative z-10 flex justify-center bg-transparent">
                    <img
                      src={getImageUrl(post.image_url)}
                      alt="Post image"
                      className="w-full h-auto max-h-64 sm:max-h-80 md:max-h-96 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Post actions */}
          <div className="px-3 sm:px-6 py-2 sm:py-3 border-t border-gray-100 bg-gray-50 text-xs sm:text-sm text-gray-600">
            <div className="flex items-center flex-wrap gap-4">
              <div className="flex items-center mr-4 sm:mr-6">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-1 sm:mr-2 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
                <span>{post.comments?.length || 0} comments</span>
              </div>

              <div className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-1 sm:mr-2 text-gray-500"
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
                <button
                  onClick={() => {
                    navigator.clipboard
                      .writeText(window.location.href)
                      .then(() =>
                        showSuccess("Link Copied", "Link copied to clipboard!")
                      )
                      .catch((err) => {
                        console.error("Failed to copy: ", err);
                        showError(
                          "Copy Failed",
                          "Failed to copy link to clipboard"
                        );
                      });
                  }}
                  className="hover:text-blue-600 transition-colors font-medium"
                >
                  Share
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Add Comment Form - Mobile optimized */}
        <div className="bg-white shadow-md rounded-lg border border-gray-200 p-3 sm:p-5 mb-4 sm:mb-6 transition-all hover:shadow-lg">
          <h2 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4 text-gray-800 flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
              />
            </svg>
            Add a Comment
          </h2>

          <form onSubmit={handleAddComment} noValidate>
            <div className="mb-3 sm:mb-4">
              <textarea
                className="w-full border border-gray-300 rounded-lg p-2 sm:p-3 h-20 sm:h-24 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all resize-none"
                placeholder="What are your thoughts? (text, image, or both)"
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if ((commentContent.trim() || commentImage) && !loading) {
                      handleAddComment(e);
                    }
                  }
                }}
              />
            </div>

            {commentImagePreview && (
              <div className="mb-3 sm:mb-4 relative rounded-lg overflow-hidden bg-gray-50 border border-gray-200 shadow-sm">
                <div
                  className="absolute inset-0 bg-no-repeat bg-center bg-cover blur-xl opacity-30 scale-110"
                  style={{
                    backgroundImage: `url(${commentImagePreview})`,
                  }}
                ></div>
                <div className="relative z-10 flex justify-center bg-transparent">
                  <img
                    src={commentImagePreview}
                    alt="Preview"
                    className="w-full h-auto max-h-48 sm:max-h-64 object-contain"
                    style={{
                      maxWidth: '100%',
                      height: 'auto'
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="absolute top-2 right-2 z-20 bg-white text-red-500 rounded-full p-1.5 shadow-md hover:bg-red-50 transition-colors"
                  onClick={() => {
                    setCommentImage(null);
                    setCommentImagePreview("");
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3 w-3 sm:h-4 sm:w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 sm:gap-3">
                <label className="cursor-pointer flex items-center text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full transition-colors">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-1.5 text-blue-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="hidden sm:inline">Add Image</span>
                  <span className="sm:hidden">📷</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCommentImageChange}
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || (!commentContent.trim() && !commentImage)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-full transition-colors ${
                  loading || (!commentContent.trim() && !commentImage)
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600 text-white shadow-sm hover:shadow"
                }`}
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span className="hidden sm:inline">Posting...</span>
                  </span>
                ) : (
                  <>
                    <span className="hidden sm:inline">Post Comment</span>
                    <span className="sm:hidden">Post</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Comments List - Mobile optimized */}
        <div className="bg-white shadow-md rounded-lg border border-gray-200 overflow-hidden transition-all hover:shadow-lg">
          <div className="px-3 sm:px-5 py-2 sm:py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
            <h2 className="text-sm sm:text-base font-semibold text-gray-800 flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
                />
              </svg>
              Comments ({post?.comments?.length || 0})
            </h2>
          </div>

          {post?.comments && post.comments.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {post.comments.map((comment) => (
                <div
                  key={comment.id}
                  className="p-3 sm:p-5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex min-w-0">
                    <div className="flex-shrink-0 mr-2 sm:mr-3">
                      <Avatar
                        avatar={comment.author.avatar}
                        firstName={comment.author.first_name}
                        lastName={comment.author.last_name}
                        size="sm"
                        className="border-2 border-gray-100 w-6 h-6 sm:w-8 sm:h-8"
                      />
                    </div>
                    <div className="flex-1 -mt-0.5 min-w-0 overflow-hidden">
                      <div className="flex items-center mb-1 min-w-0">
                        <span className="text-xs sm:text-sm font-medium text-gray-900 mr-2 truncate">
                          {comment.author.first_name} {comment.author.last_name}
                        </span>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {formatDate(comment.created_at)}
                        </span>

                        {/* Add Delete button if user is author of comment or post */}
                        {(comment.is_author ||
                          comment.is_post_author ||
                          post.is_author) && (
                          <button
                            onClick={() => showDeleteComment(comment.id)}
                            disabled={deleting}
                            className="ml-auto text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
                            title="Delete comment"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-3 w-3 sm:h-4 sm:w-4"
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
                      <div className="text-xs sm:text-sm text-gray-800 whitespace-pre-line mb-2 sm:mb-3 leading-relaxed break-words">
                        {comment.content}
                      </div>
                      {comment.image_url && (
                        <div className="mt-2 mb-2 sm:mb-3 rounded-lg overflow-hidden bg-gray-50 border border-gray-200 shadow-sm relative">
                          <div
                            className="absolute inset-0 bg-no-repeat bg-center bg-cover blur-xl opacity-30 scale-110"
                            style={{
                              backgroundImage: `url(${getImageUrl(comment.image_url)})`,
                            }}
                          ></div>
                          <div className="relative z-10 flex justify-center bg-transparent">
                            <img
                              src={getImageUrl(comment.image_url)}
                              alt="Comment image"
                              className="w-full h-auto max-h-40 sm:max-h-60 object-contain"
                              style={{
                                maxWidth: '100%',
                                height: 'auto'
                              }}
                            />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center text-xs text-gray-500 mt-2">
                        <div className="flex items-center bg-gray-50 border border-gray-200 rounded-full px-1">
                          <button
                            onClick={() => handleCommentVote(comment.id, 1)}
                            className={`p-1 rounded-full ${
                              comment.user_vote === 1
                                ? "text-orange-500 bg-orange-50"
                                : "text-gray-400 hover:text-orange-500 hover:bg-orange-50"
                            } transition-colors`}
                            title="Upvote"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="w-3 h-3 sm:w-4 sm:h-4"
                            >
                              <path d="M12 4l8 8h-6v8h-4v-8H4z" />
                            </svg>
                          </button>
                          <span
                            className={`mx-1 font-medium text-xs ${
                              comment.user_vote === 1
                                ? "text-orange-500"
                                : comment.user_vote === -1
                                ? "text-blue-500"
                                : "text-gray-700"
                            }`}
                          >
                            {comment.vote_count || 0}
                          </span>
                          <button
                            onClick={() => handleCommentVote(comment.id, -1)}
                            className={`p-1 rounded-full ${
                              comment.user_vote === -1
                                ? "text-blue-500 bg-blue-50"
                                : "text-gray-400 hover:text-blue-500 hover:bg-blue-50"
                            } transition-colors`}
                            title="Downvote"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="w-3 h-3 sm:w-4 sm:h-4"
                            >
                              <path d="M12 20l-8-8h6V4h4v8h6z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 sm:p-8 text-center text-gray-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-gray-300 mb-3 sm:mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              <p className="text-xs sm:text-sm font-medium">
                No comments yet. Be the first to comment!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Post Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeletePostConfirm}
        onClose={() => setShowDeletePostConfirm(false)}
        onConfirm={() => {
          setShowDeletePostConfirm(false);
          handleDeletePost();
        }}
        title="Delete Post"
        message="Are you sure you want to delete this post? This action cannot be undone."
        confirmText="Delete Post"
        variant="danger"
        isLoading={deleting}
      />

      {/* Delete Comment Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteCommentConfirm}
        onClose={() => {
          setShowDeleteCommentConfirm(false);
          setCommentToDelete(null);
        }}
        onConfirm={handleDeleteComment}
        title="Delete Comment"
        message="Are you sure you want to delete this comment? This action cannot be undone."
        confirmText="Delete Comment"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}
