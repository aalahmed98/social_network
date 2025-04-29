"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";

// Post type definition
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
  comments?: Comment[];
  is_author?: boolean;
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
}

export default function PostDetail() {
  const router = useRouter();
  const params = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [commentContent, setCommentContent] = useState("");
  const [commentImage, setCommentImage] = useState<File | null>(null);
  const [commentImagePreview, setCommentImagePreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    if (!window.confirm("Are you sure you want to delete this post?")) {
      return;
    }

    setDeleting(true);

    try {
      console.log(`Attempting to delete post with ID: ${postId}`);
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/posts/${postId}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log(`Delete post response status: ${response.status}`);

      if (response.ok) {
        console.log("Post deleted successfully");
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
        alert(`Failed to delete post: ${errorMessage}`);
        console.error("Failed to delete post:", errorText);
      }
    } catch (error) {
      console.error("Error details:", error);
      alert("An error occurred while deleting the post.");
    } finally {
      setDeleting(false);
    }
  };

  // Handle delete comment
  const handleDeleteComment = async (commentId: number) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    setDeleting(true);

    try {
      console.log(
        `Attempting to delete comment with ID: ${commentId} from post: ${postId}`
      );
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(
        `${backendUrl}/api/posts/${postId}/comments/${commentId}`,
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
        alert(`Failed to delete comment: ${errorMessage}`);
        console.error("Failed to delete comment:", errorText);
      }
    } catch (error) {
      console.error("Error details:", error);
      alert("An error occurred while deleting the comment.");
    } finally {
      setDeleting(false);
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

    if (!commentContent.trim()) {
      alert("Please enter a comment.");
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
        alert(`Failed to add comment: ${errorMessage}`);
        console.error("Failed to add comment:", errorText);
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      alert("An error occurred while adding the comment.");
    } finally {
      setLoading(false);
    }
  };

  // Format date to readable string
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
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
    <div className="min-h-screen p-4 bg-gray-100">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.push("/")}
          className="mb-4 text-blue-500 hover:text-blue-700 flex items-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-1"
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
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              {post?.author.avatar ? (
                <img
                  src={post.author.avatar}
                  alt={`${post.author.first_name} ${post.author.last_name}`}
                  className="w-10 h-10 rounded-full mr-3"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                  {post?.author.first_name.charAt(0)}
                  {post?.author.last_name.charAt(0)}
                </div>
              )}
              <div>
                <div className="font-semibold">
                  {post?.author.first_name} {post?.author.last_name}
                </div>
                <div className="text-xs text-gray-500">
                  {post && formatDate(post.created_at)} ·
                  <span className="ml-1">
                    {post?.privacy === "public"
                      ? "Public"
                      : post?.privacy === "almost_private"
                      ? "Followers Only"
                      : "Private"}
                  </span>
                </div>
              </div>
            </div>

            {/* Add Delete button if user is the author of the post */}
            {post.is_author && (
              <button
                onClick={handleDeletePost}
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

          <div className="mb-4 whitespace-pre-line">{post?.content}</div>

          {post?.image_url && (
            <div className="mb-4">
              <img
                src={post.image_url}
                alt="Post image"
                className="max-h-96 rounded-lg mx-auto"
              />
            </div>
          )}
        </div>

        {/* Add Comment Form */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Add a Comment</h2>
          <form onSubmit={handleAddComment}>
            <div className="mb-4">
              <textarea
                className="w-full border rounded-lg p-3 h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Write a comment..."
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                required
              />
            </div>

            {commentImagePreview && (
              <div className="mb-4 relative">
                <img
                  src={commentImagePreview}
                  alt="Preview"
                  className="max-h-64 rounded-lg mx-auto"
                />
                <button
                  type="button"
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"
                  onClick={() => {
                    setCommentImage(null);
                    setCommentImagePreview("");
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
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

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Add an Image (Optional)
              </label>
              <input
                type="file"
                accept="image/*"
                className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onChange={handleCommentImageChange}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg"
            >
              {loading ? "Posting..." : "Post Comment"}
            </button>
          </form>
        </div>

        {/* Comments List */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">
            Comments ({post?.comments?.length || 0})
          </h2>

          {post?.comments && post.comments.length > 0 ? (
            post.comments.map((comment) => (
              <div key={comment.id} className="border-b last:border-b-0 py-4">
                <div className="flex items-start">
                  {comment.author.avatar ? (
                    <img
                      src={comment.author.avatar}
                      alt={`${comment.author.first_name} ${comment.author.last_name}`}
                      className="w-8 h-8 rounded-full mr-3 mt-1"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center mr-3 mt-1">
                      {comment.author.first_name.charAt(0)}
                      {comment.author.last_name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center">
                        <span className="font-medium mr-2">
                          {comment.author.first_name} {comment.author.last_name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(comment.created_at)}
                        </span>
                      </div>

                      {/* Add Delete button if user is author of comment or post */}
                      {(comment.is_author ||
                        comment.is_post_author ||
                        post.is_author) && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          disabled={deleting}
                          className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50"
                          title="Delete comment"
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
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="whitespace-pre-line">{comment.content}</div>
                    {comment.image_url && (
                      <div className="mt-2">
                        <img
                          src={comment.image_url}
                          alt="Comment image"
                          className="max-h-64 rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-4">
              No comments yet. Be the first to comment!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
