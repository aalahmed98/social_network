"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

// Post type definition
interface Post {
  id: number;
  content: string;
  image_url?: string;
  privacy: string;
  created_at: string;
  updated_at: string;
  author: {
    first_name: string;
    last_name: string;
    avatar?: string;
  };
  comments?: Comment[];
}

// Comment type definition
interface Comment {
  id: number;
  content: string;
  image_url?: string;
  created_at: string;
  author: {
    first_name: string;
    last_name: string;
    avatar?: string;
  };
}

// User type definition
interface Follower {
  id: number;
  first_name: string;
  last_name: string;
  avatar?: string;
}

export default function Posts() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [selectedFollowers, setSelectedFollowers] = useState<number[]>([]);
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [showFollowerSelect, setShowFollowerSelect] = useState(false);

  // Fetch posts on page load and when page changes
  useEffect(() => {
    fetchPosts();
    fetchFollowers();
  }, [page]);

  // Fetch posts from the API
  const fetchPosts = async () => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(
        `${backendUrl}/api/posts?page=${page}&limit=10`,
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
        setPosts(data.posts || []);
      } else if (response.status === 401) {
        router.push("/login");
      } else {
        console.error("Failed to fetch posts:", await response.text());
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
    }
  };

  // Fetch followers from the API
  const fetchFollowers = async () => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/followers`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setFollowers(data.followers || []);
      } else if (response.status === 401) {
        router.push("/login");
      } else {
        console.error("Failed to fetch followers:", await response.text());
      }
    } catch (error) {
      console.error("Error fetching followers:", error);
    }
  };

  // Handle image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // Handle privacy change
  const handlePrivacyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setPrivacy(value);
    setShowFollowerSelect(value === "private");
    if (value !== "private") {
      setSelectedFollowers([]);
    }
  };

  // Handle follower selection
  const handleFollowerSelection = (followerId: number) => {
    setSelectedFollowers((prev) => {
      if (prev.includes(followerId)) {
        return prev.filter((id) => id !== followerId);
      } else {
        return [...prev, followerId];
      }
    });
  };

  // Create a new post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      alert("Please enter some content for your post.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("content", content);
      formData.append("privacy", privacy);

      if (image) {
        formData.append("image", image);
      }

      if (privacy === "private" && selectedFollowers.length > 0) {
        formData.append("allowedFollowers", JSON.stringify(selectedFollowers));
      }

      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/posts`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (response.ok) {
        // Reset form
        setContent("");
        setPrivacy("public");
        setImage(null);
        setImagePreview("");
        setSelectedFollowers([]);
        setShowFollowerSelect(false);

        // Refresh posts
        fetchPosts();
      } else {
        const errorText = await response.text();
        let errorMessage = "Unknown error";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        alert(`Failed to create post: ${errorMessage}`);
        console.error("Failed to create post:", errorText);
      }
    } catch (error) {
      console.error("Error creating post:", error);
      alert("An error occurred while creating the post.");
    } finally {
      setLoading(false);
    }
  };

  // Format date to readable string
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="min-h-screen p-4 bg-gray-100">
      <h1 className="text-3xl font-bold mb-6 text-center">Posts</h1>

      {/* Create Post Form */}
      <div className="max-w-2xl mx-auto bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Create a New Post</h2>
        <form onSubmit={handleCreatePost}>
          <div className="mb-4">
            <textarea
              className="w-full border rounded-lg p-3 h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="What's on your mind?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>

          {imagePreview && (
            <div className="mb-4 relative">
              <img
                src={imagePreview}
                alt="Preview"
                className="max-h-64 rounded-lg mx-auto"
              />
              <button
                type="button"
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"
                onClick={() => {
                  setImage(null);
                  setImagePreview("");
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

          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium mb-1">
                Privacy Setting
              </label>
              <select
                className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={privacy}
                onChange={handlePrivacyChange}
              >
                <option value="public">Public (Everyone)</option>
                <option value="almost_private">
                  Almost Private (Followers Only)
                </option>
                <option value="private">Private (Selected Followers)</option>
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium mb-1">
                Add an Image (Optional)
              </label>
              <input
                type="file"
                accept="image/*"
                className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onChange={handleImageChange}
              />
            </div>
          </div>

          {showFollowerSelect && followers.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Select followers who can see this post:
              </label>
              <div className="max-h-40 overflow-y-auto border rounded-lg p-2">
                {followers.map((follower) => (
                  <div
                    key={follower.id}
                    className="flex items-center p-2 hover:bg-gray-100 rounded"
                  >
                    <input
                      type="checkbox"
                      id={`follower-${follower.id}`}
                      checked={selectedFollowers.includes(follower.id)}
                      onChange={() => handleFollowerSelection(follower.id)}
                      className="mr-2"
                    />
                    <label
                      htmlFor={`follower-${follower.id}`}
                      className="flex items-center cursor-pointer"
                    >
                      {follower.avatar ? (
                        <img
                          src={follower.avatar}
                          alt={`${follower.first_name} ${follower.last_name}`}
                          className="w-8 h-8 rounded-full mr-2"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center mr-2">
                          {follower.first_name.charAt(0)}
                          {follower.last_name.charAt(0)}
                        </div>
                      )}
                      <span>
                        {follower.first_name} {follower.last_name}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg"
          >
            {loading ? "Posting..." : "Post"}
          </button>
        </form>
      </div>

      {/* Posts List */}
      <div className="max-w-2xl mx-auto">
        {posts.length > 0 ? (
          posts.map((post) => (
            <div key={post.id} className="bg-white shadow rounded-lg p-6 mb-6">
              <div className="flex items-center mb-4">
                {post.author.avatar ? (
                  <img
                    src={post.author.avatar}
                    alt={`${post.author.first_name} ${post.author.last_name}`}
                    className="w-10 h-10 rounded-full mr-3"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                    {post.author.first_name.charAt(0)}
                    {post.author.last_name.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="font-semibold">
                    {post.author.first_name} {post.author.last_name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDate(post.created_at)} ·
                    <span className="ml-1">
                      {post.privacy === "public"
                        ? "Public"
                        : post.privacy === "almost_private"
                        ? "Followers Only"
                        : "Private"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mb-4 whitespace-pre-line">{post.content}</div>

              {post.image_url && (
                <div className="mb-4">
                  <img
                    src={post.image_url}
                    alt="Post image"
                    className="max-h-96 rounded-lg mx-auto"
                  />
                </div>
              )}

              <div className="border-t pt-3 mt-3">
                <button
                  onClick={() => router.push(`/posts/${post.id}`)}
                  className="text-blue-500 hover:text-blue-700"
                >
                  View {post.comments?.length || 0} comments
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-10">
            <p className="text-gray-500">
              No posts to display. Be the first to create a post!
            </p>
          </div>
        )}

        {/* Pagination */}
        {posts.length > 0 && (
          <div className="flex justify-between mt-4 mb-8">
            <button
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page === 1}
              className={`px-4 py-2 rounded ${
                page === 1
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              }`}
            >
              Previous
            </button>
            <button
              onClick={() => setPage((prev) => prev + 1)}
              disabled={posts.length < 10}
              className={`px-4 py-2 rounded ${
                posts.length < 10
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              }`}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
