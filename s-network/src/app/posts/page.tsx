"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

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
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [selectedFollowers, setSelectedFollowers] = useState<number[]>([]);
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch followers on page load
  useEffect(() => {
    fetchFollowers();
  }, []);

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

    if (!title.trim()) {
      alert("Please enter a title for your post.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("title", title);
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
        setTitle("");
        setContent("");
        setPrivacy("public");
        setImage(null);
        setImagePreview("");
        setSelectedFollowers([]);
        setShowFollowerSelect(false);

        // Redirect to home page after successful post
        router.push("/");
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

  const [showFollowerSelect, setShowFollowerSelect] = useState(false);

  return (
    <div className="py-6">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-800 font-serif tracking-tight">
            Create New Post
          </h1>
          <p className="text-gray-600">Share your thoughts with your network</p>
        </div>

        {/* Create Post Form */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-md hover:shadow-lg transition-all overflow-hidden">
          <form onSubmit={handleCreatePost}>
            <div className="p-6">
              {/* Title input */}
              <div className="mb-4">
                <label
                  htmlFor="title"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Post Title
                </label>
                <input
                  id="title"
                  type="text"
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-800 font-serif font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Add a descriptive title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              {/* Content textarea */}
              <div className="mb-6">
                <label
                  htmlFor="content"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Post Content (Optional)
                </label>
                <textarea
                  id="content"
                  className="w-full border border-gray-300 rounded-lg p-4 min-h-[120px] text-gray-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="What's on your mind?"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>

              {/* Image preview */}
              {imagePreview && (
                <div className="mb-6 relative rounded-lg overflow-hidden border border-gray-200">
                  <div className="relative bg-gray-50">
                    <div
                      className="absolute inset-0 bg-no-repeat bg-center bg-cover blur-xl opacity-30 scale-110"
                      style={{
                        backgroundImage: `url(${imagePreview})`,
                      }}
                    ></div>
                    <div className="relative z-10 flex justify-center bg-transparent py-2">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-w-full max-h-80 object-contain"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="absolute top-2 right-2 bg-gray-800 bg-opacity-70 text-white rounded-full p-1.5 hover:bg-red-500 transition-colors"
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

              {/* Post settings and options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                <div>
                  <label
                    htmlFor="privacy"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Privacy Setting
                  </label>
                  <div className="relative">
                    <select
                      id="privacy"
                      className="appearance-none block w-full bg-white border border-gray-300 rounded-lg py-3 px-4 pr-8 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={privacy}
                      onChange={handlePrivacyChange}
                    >
                      <option value="public">Public (Everyone)</option>
                      <option value="almost_private">Followers Only</option>
                      <option value="private">
                        Private (Selected Followers)
                      </option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                      <svg
                        className="fill-current h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="image"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Add an Image (Optional)
                  </label>
                  <div className="relative bg-white border border-gray-300 rounded-lg overflow-hidden">
                    <input
                      id="image"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleImageChange}
                    />
                    <label
                      htmlFor="image"
                      className="flex items-center justify-center cursor-pointer py-3 px-4 text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-2 text-gray-500"
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
                      {image ? "Change Image" : "Upload Image"}
                    </label>
                  </div>
                </div>
              </div>

              {/* Followers selection (for private posts) */}
              {showFollowerSelect && followers.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select followers who can see this post:
                  </label>
                  <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                    {followers.map((follower) => (
                      <div
                        key={follower.id}
                        className="flex items-center px-4 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          id={`follower-${follower.id}`}
                          checked={selectedFollowers.includes(follower.id)}
                          onChange={() => handleFollowerSelection(follower.id)}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <label
                          htmlFor={`follower-${follower.id}`}
                          className="flex items-center ml-3 cursor-pointer flex-1 py-1"
                        >
                          {follower.avatar ? (
                            <img
                              src={
                                follower.avatar.startsWith("http")
                                  ? follower.avatar
                                  : `${
                                      process.env.NEXT_PUBLIC_BACKEND_URL ||
                                      "http://localhost:8080"
                                    }${follower.avatar}`
                              }
                              alt={`${follower.first_name} ${follower.last_name}`}
                              className="w-8 h-8 rounded-full object-cover border-2 border-gray-100 mr-3"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white mr-3 shadow-sm">
                              {follower.first_name.charAt(0)}
                            </div>
                          )}
                          <span className="text-gray-700">
                            {follower.first_name} {follower.last_name}
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Form actions */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-all transform hover:-translate-y-1 font-medium disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                    Creating Post...
                  </span>
                ) : (
                  "Create Post"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
