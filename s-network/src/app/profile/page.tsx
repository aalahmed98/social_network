"use client";

import React, { useEffect, useState, FormEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";

// Post type definition
interface Post {
  id: number;
  content: string;
  image_url?: string;
  privacy: string;
  created_at: string;
  updated_at: string;
  user_id: number;
  author: {
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

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    nickname: "",
    aboutMe: "",
    isPublic: true,
    avatar: null as File | null,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updating, setUpdating] = useState(false);
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [showEditForm, setShowEditForm] = useState(false);

  useEffect(() => {
    // Fetch user data
    const fetchUser = async () => {
      try {
        // Use the backend API directly
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

        // First, check authentication
        const authResponse = await fetch(`${backendUrl}/api/auth/check`, {
          method: "GET",
          credentials: "include", // Include cookies in the request
        });

        if (!authResponse.ok) {
          throw new Error("Not authenticated");
        }

        const authData = await authResponse.json();
        if (!authData.authenticated) {
          throw new Error("Not authenticated");
        }

        // Then fetch profile data
        const profileResponse = await fetch(`${backendUrl}/api/profile`, {
          method: "GET",
          credentials: "include", // Include cookies in the request
        });

        if (!profileResponse.ok) {
          throw new Error("Failed to fetch profile");
        }

        const userData = await profileResponse.json();
        setUser(userData);
        setFormData({
          firstName: userData.first_name || "",
          lastName: userData.last_name || "",
          nickname: userData.nickname || "",
          aboutMe: userData.about_me || "",
          isPublic: userData.is_public || true,
          avatar: null,
        });

        // Fetch followers
        const followersResponse = await fetch(`${backendUrl}/api/followers`, {
          method: "GET",
          credentials: "include",
        });

        if (followersResponse.ok) {
          const followersData = await followersResponse.json();
          setFollowers(followersData.followers || []);
        }

        // Fetch posts
        const postsResponse = await fetch(`${backendUrl}/api/posts`, {
          method: "GET",
          credentials: "include",
        });

        if (postsResponse.ok) {
          const postsData = await postsResponse.json();
          // Extract only the user's posts
          const userPosts = postsData.posts.filter(
            (post: Post) => post.user_id === userData.id
          );
          setPosts(userPosts);
        }
      } catch (error) {
        console.error("Profile error:", error);
        // Delay the redirect to prevent flashing
        setTimeout(() => {
          router.push("/login");
        }, 100);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target as HTMLInputElement;

    if (type === "checkbox") {
      const target = e.target as HTMLInputElement;
      setFormData((prev) => ({ ...prev, [name]: target.checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFormData((prev) => ({ ...prev, avatar: e.target.files![0] }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setUpdating(true);

    try {
      // Create form data for file upload
      const data = new FormData();
      data.append("firstName", formData.firstName);
      data.append("lastName", formData.lastName);
      data.append("nickname", formData.nickname);
      data.append("aboutMe", formData.aboutMe);
      data.append("isPublic", formData.isPublic.toString());

      if (formData.avatar) {
        data.append("avatar", formData.avatar);
      }

      // Use backend API directly
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      const response = await fetch(`${backendUrl}/api/profile/update`, {
        method: "POST",
        credentials: "include",
        body: data,
      });

      if (!response.ok) {
        let errorMessage = "Failed to update profile";
        try {
          const result = await response.json();
          errorMessage = result.error || errorMessage;
        } catch (e) {
          // If JSON parsing fails, use the default message
        }
        throw new Error(errorMessage);
      }

      setSuccess("Profile updated successfully");
      setShowEditForm(false);

      // Refresh user data
      const profileResponse = await fetch(`${backendUrl}/api/profile`, {
        method: "GET",
        credentials: "include",
      });

      if (profileResponse.ok) {
        const userData = await profileResponse.json();
        setUser(userData);
      }
    } catch (err: any) {
      console.error("Profile update error:", err);
      setError(err.message || "Failed to update profile");
    } finally {
      setUpdating(false);
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

  const navigateToPost = (postId: number) => {
    router.push(`/posts/${postId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pt-20 pb-12">
      <div className="max-w-5xl mx-auto">
        {/* Profile Header */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 h-32 md:h-48"></div>
          <div className="px-6 py-4 md:px-8 md:py-6 relative">
            {/* Avatar - positioned to overlap the gradient banner */}
            <div className="absolute -top-16 left-6 w-32 h-32 rounded-full overflow-hidden border-4 border-white bg-white shadow-md">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-indigo-300 bg-indigo-50">
                  {user?.first_name?.charAt(0)}
                </div>
              )}
            </div>

            {/* User Info */}
            <div className="ml-0 mt-16 md:ml-36 md:mt-0 md:flex md:justify-between md:items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  {user?.first_name} {user?.last_name}
                </h2>
                {user?.nickname && (
                  <p className="text-gray-600">@{user.nickname}</p>
                )}
                {user?.about_me && (
                  <p className="text-gray-700 mt-3 max-w-2xl">
                    {user.about_me}
                  </p>
                )}
              </div>
              <div className="mt-4 md:mt-0">
                <button
                  onClick={() => setShowEditForm(!showEditForm)}
                  className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition duration-200 shadow-sm"
                >
                  {showEditForm ? "Hide Edit Form" : "Edit Profile"}
                </button>
              </div>
            </div>

            {/* User Stats */}
            <div className="mt-6 flex border-t border-gray-200 pt-4">
              <div className="text-center w-1/3">
                <div className="text-xl font-bold">{posts.length}</div>
                <div className="text-gray-600 text-sm">Posts</div>
              </div>
              <div className="text-center w-1/3">
                <div className="text-xl font-bold">{followers.length}</div>
                <div className="text-gray-600 text-sm">Followers</div>
              </div>
              <div className="text-center w-1/3">
                <div className="text-xl font-bold">0</div>
                <div className="text-gray-600 text-sm">Following</div>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Profile Form */}
        {showEditForm && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6 p-6">
            <h2 className="text-xl font-bold mb-6">Edit Profile</h2>

            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 text-green-700 p-3 rounded mb-4 text-sm">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="firstName"
                    className="block text-sm font-medium text-gray-700"
                  >
                    First Name
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="lastName"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="nickname"
                  className="block text-sm font-medium text-gray-700"
                >
                  Nickname (Optional)
                </label>
                <input
                  type="text"
                  id="nickname"
                  name="nickname"
                  value={formData.nickname}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label
                  htmlFor="aboutMe"
                  className="block text-sm font-medium text-gray-700"
                >
                  About Me (Optional)
                </label>
                <textarea
                  id="aboutMe"
                  name="aboutMe"
                  rows={4}
                  value={formData.aboutMe}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label
                  htmlFor="avatar"
                  className="block text-sm font-medium text-gray-700"
                >
                  Profile Picture (Optional)
                </label>
                <input
                  type="file"
                  id="avatar"
                  name="avatar"
                  onChange={handleFileChange}
                  accept="image/*"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Leave empty to keep current image
                </p>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isPublic"
                  name="isPublic"
                  checked={formData.isPublic}
                  onChange={handleChange}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="isPublic"
                  className="ml-2 block text-sm text-gray-700"
                >
                  Public Profile (Anyone can view your profile and follow you)
                </label>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={updating}
                  className={`w-full md:w-auto flex justify-center py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                    updating
                      ? "bg-indigo-400"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                >
                  {updating ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Posts Section */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold">Your Posts</h2>
          </div>

          {posts.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-5xl text-gray-300 mb-4">📝</div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">
                No posts yet
              </h3>
              <p className="text-gray-600 mb-6">
                You haven't created any posts. Start sharing with your
                followers!
              </p>
              <button
                onClick={() => router.push("/posts")}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg
                  className="-ml-1 mr-2 h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Create New Post
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="p-6 hover:bg-gray-50 transition cursor-pointer"
                  onClick={() => navigateToPost(post.id)}
                >
                  <div className="flex items-center mb-3">
                    <div className="flex-shrink-0 mr-3">
                      {user?.avatar ? (
                        <img
                          src={user.avatar}
                          alt="Profile"
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-sm font-bold text-white">
                          {user?.first_name?.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">
                        {user?.first_name} {user?.last_name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {formatDate(post.created_at)}
                        <span className="mx-1">·</span>
                        <span className="flex items-center">
                          {post.privacy === "public"
                            ? "Public"
                            : post.privacy === "almost_private"
                            ? "Followers Only"
                            : "Private"}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="text-gray-800">{post.content}</p>
                  </div>

                  {post.image_url && (
                    <div className="rounded-lg overflow-hidden bg-gray-100 my-3">
                      <img
                        src={
                          post.image_url.startsWith("http")
                            ? post.image_url
                            : `${
                                process.env.NEXT_PUBLIC_BACKEND_URL ||
                                "http://localhost:8080"
                              }${post.image_url}`
                        }
                        alt="Post"
                        className="max-h-80 w-auto mx-auto object-contain"
                      />
                    </div>
                  )}

                  <div className="flex items-center text-gray-500 text-sm mt-4">
                    <div className="flex items-center mr-4">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                        />
                      </svg>
                      {post.upvotes || 0} likes
                    </div>
                    <div className="flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-1"
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
                      {post.comments?.length || 0} comments
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {posts.length > 0 && (
            <div className="p-4 border-t border-gray-200 text-center">
              <button
                onClick={() => router.push("/posts")}
                className="px-4 py-2 text-indigo-600 hover:text-indigo-800 font-medium rounded-md hover:bg-indigo-50 transition-colors"
              >
                Create New Post
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
