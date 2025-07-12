"use client";

import React, { useEffect, useState, FormEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getImageUrl, createAvatarFallback } from "@/utils/image";
import { useToast } from "@/context/ToastContext";
import { Avatar } from "@/components/ui";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  FiEdit3,
  FiCamera,
  FiLock,
  FiGlobe,
  FiUsers,
  FiMessageSquare,
  FiHeart,
  FiCalendar,
  FiSettings,
  FiX,
  FiImage,
} from "react-icons/fi";
import { BiArrowBack } from "react-icons/bi";

// Post type definition
interface Post {
  id: number;
  title?: string;
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
  comment_count?: number;
}

export default function Profile() {
  const router = useRouter();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    nickname: "",
    aboutMe: "",
    isPublic: true,
    avatar: null as File | null,
    banner: null as File | null,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updating, setUpdating] = useState(false);
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showSettingsPopup, setShowSettingsPopup] = useState(false);

  const [showFollowersPopup, setShowFollowersPopup] = useState(false);
  const [showFollowingPopup, setShowFollowingPopup] = useState(false);
  const [showRemoveFollowerConfirm, setShowRemoveFollowerConfirm] = useState(false);
  const [showUnfollowConfirm, setShowUnfollowConfirm] = useState(false);
  const [selectedFollowerId, setSelectedFollowerId] = useState<number | null>(null);
  const [selectedUnfollowUserId, setSelectedUnfollowUserId] = useState<number | null>(null);

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
          isPublic: userData.is_public === false ? false : true,
          avatar: null,
          banner: null,
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

  useEffect(() => {
    if (!user?.id) return; // Wait until user data is loaded

    async function loadData() {
      try {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

        const flRes = await fetch(
          `${backendUrl}/api/following?userId=${user.id}`,
          {
            credentials: "include",
          }
        );

        if (!flRes.ok) throw new Error("Failed to load following");

        const flJson = await flRes.json();
        setFollowing(flJson.followings || []);
      } catch (error) {
        console.error("Error fetching following:", error);
      }
    }

    loadData();
  }, [user?.id]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target as HTMLInputElement;

    // Note: isPublic is now handled by the onClick handler directly on the toggle
    if (type === "checkbox" && name !== "isPublic") {
      const target = e.target as HTMLInputElement;
      setFormData((prev) => ({ ...prev, [name]: target.checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fieldName = e.target.name as 'avatar' | 'banner';
      setFormData((prev) => ({ ...prev, [fieldName]: e.target.files![0] }));
    }
  };

  const handleBannerUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const bannerFile = e.target.files[0];
      
      // Validate file type and size
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(bannerFile.type)) {
        showError("Invalid File Type", "Please select a JPEG, PNG, or GIF image.");
        return;
      }
      
      if (bannerFile.size > 10 * 1024 * 1024) { // 10MB
        showError("File Too Large", "Please select an image smaller than 10MB.");
        return;
      }
      
      try {
        setUpdating(true);
        
        // Create form data for banner upload
        const data = new FormData();
        data.append("firstName", formData.firstName);
        data.append("lastName", formData.lastName);
        data.append("nickname", formData.nickname);
        data.append("aboutMe", formData.aboutMe);
        data.append("isPublic", formData.isPublic.toString());
        data.append("banner", bannerFile);
        
        // Use backend API directly
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

        const response = await fetch(`${backendUrl}/api/profile/update`, {
          method: "POST",
          credentials: "include",
          body: data,
        });

        if (!response.ok) {
          let errorMessage = "Failed to update banner";
          try {
            const result = await response.json();
            errorMessage = result.error || errorMessage;
          } catch (e) {
            // If JSON parsing fails, use the default message
          }
          throw new Error(errorMessage);
        }

        showSuccess("Banner Updated", "Your profile banner has been updated successfully!");
        
        // Refresh user data
        const updatedResponse = await fetch(`${backendUrl}/api/profile`, {
          method: "GET",
          credentials: "include",
        });

        if (updatedResponse.ok) {
          const updatedUserData = await updatedResponse.json();
          setUser(updatedUserData);
          setFormData(prev => ({
            ...prev,
            banner: null, // Clear the form banner since it's now saved
          }));
        }
      } catch (error) {
        console.error("Banner upload error:", error);
        showError("Upload Failed", error instanceof Error ? error.message : "Failed to upload banner");
      } finally {
        setUpdating(false);
      }
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

      if (formData.banner) {
        data.append("banner", formData.banner);
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
      showSuccess(
        "Profile Updated",
        "Your profile has been updated successfully!"
      );
      setShowSettingsPopup(false);

      // Refresh user data and posts
      const fetchUpdatedData = async () => {
        // Fetch updated profile
        const profileResponse = await fetch(`${backendUrl}/api/profile`, {
          method: "GET",
          credentials: "include",
        });

        if (profileResponse.ok) {
          const userData = await profileResponse.json();
          setUser(userData);
        }

        // Fetch updated posts
        const postsResponse = await fetch(`${backendUrl}/api/posts`, {
          method: "GET",
          credentials: "include",
        });

        if (postsResponse.ok) {
          const postsData = await postsResponse.json();
          const userPosts = postsData.posts.filter(
            (post: Post) => post.user_id === user.id
          );
          setPosts(userPosts);
        }
      };

      // Refresh data
      await fetchUpdatedData();
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

  const handleRemoveFollower = async (followerId: number) => {
    setSelectedFollowerId(followerId);
    setShowRemoveFollowerConfirm(true);
  };

  const confirmRemoveFollower = async () => {
    if (!selectedFollowerId) return;

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(
        `${backendUrl}/api/followers/remove/${selectedFollowerId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (response.ok) {
        // Remove the follower from the local state
        setFollowers(followers.filter((f) => f.id !== selectedFollowerId));
        showSuccess("Follower Removed", "Follower removed successfully");
      } else {
        const errorText = await response.text();
        showError("Remove Failed", `Failed to remove follower: ${errorText}`);
      }
    } catch (error) {
      console.error("Error removing follower:", error);
      showError("Remove Error", "Failed to remove follower. Please try again.");
    } finally {
      setShowRemoveFollowerConfirm(false);
      setSelectedFollowerId(null);
    }
  };

  const handleUnfollow = async (userId: number) => {
    setSelectedUnfollowUserId(userId);
    setShowUnfollowConfirm(true);
  };

  const confirmUnfollow = async () => {
    if (!selectedUnfollowUserId) return;

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/follow/${selectedUnfollowUserId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        // Remove the user from the following list
        setFollowing(following.filter((f) => f.id !== selectedUnfollowUserId));
        showSuccess("Unfollowed", "User unfollowed successfully");
      } else {
        const errorText = await response.text();
        showError("Unfollow Failed", `Failed to unfollow user: ${errorText}`);
      }
    } catch (error) {
      console.error("Error unfollowing user:", error);
      showError("Unfollow Error", "Failed to unfollow user. Please try again.");
    } finally {
      setShowUnfollowConfirm(false);
      setSelectedUnfollowUserId(null);
    }
  };

  // Use the imported getImageUrl function from utils/image.ts

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pt-6 pb-12">
      <div className="max-w-2xl w-full mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
        {/* Profile Header */}
        <div className="bg-white rounded-xl shadow-md mb-6 border border-gray-200">
          <div className="relative h-32 sm:h-40 md:h-48 overflow-hidden rounded-t-xl">
            {/* Banner Image */}
            {user?.banner ? (
              <img
                src={getImageUrl(user.banner)}
                alt="Profile banner"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 w-full h-full"></div>
            )}
            
            {/* Camera icon for banner photo upload */}
            <label className="absolute bottom-3 right-3 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-md text-gray-700 hover:bg-white transition-colors cursor-pointer">
              <FiCamera size={18} />
              <input
                type="file"
                name="banner"
                accept="image/*"
                onChange={handleBannerUpload}
                className="sr-only"
              />
            </label>
          </div>

          <div className="px-6 py-6 md:px-8 md:py-6 relative">
            {/* Avatar and User Info Section */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-4">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className="rounded-full overflow-hidden border-4 border-white bg-white shadow-md">
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32">
                    <Avatar
                      avatar={user?.avatar}
                      firstName={user?.first_name}
                      lastName={user?.last_name}
                      size="2xl"
                      className="w-full h-full !text-lg sm:!text-xl md:!text-3xl"
                    />
                    {/* Camera icon overlay for avatar */}
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100 rounded-full">
                      <div className="bg-white p-1 sm:p-2 rounded-full">
                        <FiCamera className="text-gray-700 w-3 h-3 sm:w-4 sm:h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center">
                      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 truncate">
                        {user?.first_name} {user?.last_name}
                      </h2>
                      {user?.is_public === false && (
                        <div className="ml-2 text-gray-500 flex-shrink-0" title="Private profile">
                          <FiLock size={16} />
                        </div>
                      )}
                      {user?.is_public === true && (
                        <div className="ml-2 text-green-500 flex-shrink-0" title="Public profile">
                          <FiGlobe size={16} />
                        </div>
                      )}
                      {/* Verification badge (decorative) */}
                      {followers.length > 10 && (
                        <div className="ml-2 bg-blue-500 text-white p-1 rounded-full flex-shrink-0">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="w-3 h-3"
                          >
                            <path
                              fillRule="evenodd"
                              d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    {user?.nickname && (
                      <p className="text-gray-600 truncate">@{user.nickname}</p>
                    )}
                    <div className="flex items-center mt-1 text-sm text-gray-500">
                      {user?.created_at && (
                        <div className="flex items-center">
                          <FiCalendar className="mr-1" />
                          <span>
                            Joined {new Date(user.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                    {user?.about_me && (
                      <p className="text-gray-700 mt-3 text-sm sm:text-base">
                        {user.about_me}
                      </p>
                    )}
                  </div>
                  <div className="ml-4 flex-shrink-0 flex space-x-2">
                    <button
                      onClick={() => router.push('/dashboard')}
                      className="inline-flex items-center p-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition duration-200 hover:shadow-sm"
                      aria-label="Analytics Dashboard"
                      title="Analytics Dashboard"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-5 h-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setShowSettingsPopup(true)}
                      className="inline-flex items-center p-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition duration-200 hover:shadow-sm"
                      aria-label="Settings"
                      title="Profile Settings"
                    >
                      <FiSettings className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* User Stats */}
            <div className="mt-6 grid grid-cols-3 gap-4 border-t border-gray-200 pt-6">
              {/* Posts count stays the same */}
              <div className="text-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
                <div className="text-xl font-bold text-indigo-600">
                  {posts.length}
                </div>
                <div className="text-gray-600 text-sm font-medium">Posts</div>
              </div>

              {/* Followers button */}
              <button
                onClick={() => setShowFollowersPopup(true)}
                className="text-center p-3 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="text-xl font-bold text-indigo-600">
                  {followers.length}
                </div>
                <div className="text-gray-600 text-sm font-medium">
                  Followers
                </div>
              </button>

              {/* Following button */}
              <button
                onClick={() => setShowFollowingPopup(true)}
                className="text-center p-3 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="text-xl font-bold text-indigo-600">
                  {following.length}
                </div>
                <div className="text-gray-600 text-sm font-medium">
                  Following
                </div>
              </button>
              {showFollowersPopup && (
                <div
                  className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50"
                  onClick={() => setShowFollowersPopup(false)}
                >
                  <div
                    className="bg-white rounded-lg shadow-lg w-80 max-w-[90vw] max-h-[80vh] overflow-y-auto p-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 className="text-lg font-semibold mb-2">Followers</h3>
                    {followers.length === 0 ? (
                      <p className="text-gray-500">No followers yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {followers.map((f) => (
                          <li
                            key={f.id}
                            className="flex items-center justify-between space-x-2"
                          >
                            <div className="flex items-center space-x-2">
                              {getImageUrl(f.avatar || "") ? (
                                <img
                                  src={getImageUrl(f.avatar || "")!}
                                  className="w-6 h-6 rounded-full"
                                  onError={(e) =>
                                    createAvatarFallback(
                                      e.currentTarget,
                                      f.first_name.charAt(0),
                                      "text-xs"
                                    )
                                  }
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs text-white">
                                  {f.first_name.charAt(0)}
                                </div>
                              )}
                              <span>
                                {f.first_name} {f.last_name}
                              </span>
                            </div>
                            <button
                              onClick={() => handleRemoveFollower(f.id)}
                              className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded border border-red-300 hover:border-red-500 transition-colors"
                              title="Remove follower"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                      onClick={() => setShowFollowersPopup(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {showFollowingPopup && (
                <div
                  className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50"
                  onClick={() => setShowFollowingPopup(false)}
                >
                  <div
                    className="bg-white rounded-lg shadow-lg w-80 max-w-[90vw] max-h-[80vh] overflow-y-auto p-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 className="text-lg font-semibold mb-2">Following</h3>
                    {following.length === 0 ? (
                      <p className="text-gray-500">Not following anyone yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {following.map((f) => (
                          <li
                            key={f.id}
                            className="flex items-center justify-between space-x-2"
                          >
                            <div className="flex items-center space-x-2">
                              {getImageUrl(f.avatar || "") ? (
                                <img
                                  src={getImageUrl(f.avatar || "")!}
                                  className="w-6 h-6 rounded-full"
                                  onError={(e) =>
                                    createAvatarFallback(
                                      e.currentTarget,
                                      f.first_name.charAt(0),
                                      "text-xs"
                                    )
                                  }
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs text-white">
                                  {f.first_name.charAt(0)}
                                </div>
                              )}
                              <span>
                                {f.first_name} {f.last_name}
                              </span>
                            </div>
                            <button
                              onClick={() => handleUnfollow(f.id)}
                              className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded border border-red-300 hover:border-red-500 transition-colors"
                              title="Unfollow"
                            >
                              Unfollow
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                      onClick={() => setShowFollowingPopup(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Settings Popup */}
        {showSettingsPopup && (
          <div
            className="fixed inset-0 z-50 backdrop-blur-sm bg-black/30 flex items-center justify-center overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowSettingsPopup(false);
              }
            }}
          >
            <div
              className="bg-white rounded-xl shadow-xl w-full max-w-md my-8 mx-4 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
                <h2 className="text-xl font-bold flex items-center">
                  <FiSettings className="mr-2 text-indigo-600" />
                  Profile Settings
                </h2>
                <button
                  onClick={() => setShowSettingsPopup(false)}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100"
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="p-6">
                {error && (
                  <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm border border-red-200">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 text-green-700 p-3 rounded mb-4 text-sm border border-green-200">
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
                    <div className="mt-1 flex rounded-md shadow-sm">
                      <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                        @
                      </span>
                      <input
                        type="text"
                        id="nickname"
                        name="nickname"
                        value={formData.nickname}
                        onChange={handleChange}
                        className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
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
                      placeholder="Tell us about yourself..."
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      Brief description for your profile.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="avatar"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Profile Picture (Optional)
                    </label>
                    <div className="mt-1 flex items-center">
                      <div className="flex-shrink-0 h-12 w-12 rounded-full overflow-hidden bg-gray-100">
                        {formData.avatar ? (
                          <img
                            src={URL.createObjectURL(formData.avatar)}
                            alt="Preview"
                            className="h-full w-full object-cover"
                          />
                        ) : user?.avatar ? (
                          <img
                            src={getImageUrl(user.avatar)}
                            alt={`${
                              user?.first_name || "User"
                            }'s profile picture`}
                            className="h-full w-full object-cover"
                            onError={(e) =>
                              createAvatarFallback(
                                e.currentTarget,
                                user?.first_name?.charAt(0) || "?",
                                "text-sm"
                              )
                            }
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-indigo-600 text-white font-bold">
                            {formData.firstName.charAt(0) || "?"}
                          </div>
                        )}
                      </div>
                      <div className="ml-4 flex">
                        <div className="relative bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm flex items-center hover:bg-gray-50 cursor-pointer">
                          <label
                            htmlFor="avatar"
                            className="cursor-pointer flex items-center text-sm font-medium text-gray-700"
                          >
                            <FiCamera className="mr-2" />
                            Change
                          </label>
                          <input
                            id="avatar"
                            name="avatar"
                            type="file"
                            onChange={handleFileChange}
                            accept="image/*"
                            className="sr-only"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Banner Upload Section */}
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-700">
                      Profile Banner (Optional)
                    </label>
                    <div className="mt-1 flex items-center">
                      <div className="flex-shrink-0 w-16 h-10 rounded overflow-hidden bg-gray-100">
                        {formData.banner ? (
                          <img
                            src={URL.createObjectURL(formData.banner)}
                            alt="Banner preview"
                            className="h-full w-full object-cover"
                          />
                        ) : user?.banner ? (
                          <img
                            src={getImageUrl(user.banner)}
                            alt="Current banner"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-gradient-to-r from-blue-600 to-indigo-700">
                            <FiImage className="text-white text-sm" />
                          </div>
                        )}
                      </div>
                      <div className="ml-4 flex">
                        <div className="relative bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm flex items-center hover:bg-gray-50 cursor-pointer">
                          <label
                            htmlFor="banner"
                            className="cursor-pointer flex items-center text-sm font-medium text-gray-700"
                          >
                            <FiCamera className="mr-2" />
                            Change Banner
                          </label>
                          <input
                            id="banner"
                            name="banner"
                            type="file"
                            onChange={handleFileChange}
                            accept="image/*"
                            className="sr-only"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-gray-200 pt-6">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <span className="text-sm font-medium text-gray-700">
                          Profile Privacy
                        </span>
                        <p className="text-xs text-gray-500 mt-1">
                          {formData.isPublic
                            ? "Your profile is public and visible to everyone"
                            : "Your profile is private and only visible to your followers"}
                        </p>
                      </div>
                      <div className="flex items-center">
                        <div className="flex flex-col items-end mr-3">
                          <span
                            className={`text-xs font-medium ${
                              formData.isPublic
                                ? "text-green-600"
                                : "text-indigo-600"
                            }`}
                          >
                            {formData.isPublic ? "Public" : "Private"}
                          </span>
                          {formData.isPublic && (
                            <span className="text-[10px] text-gray-500">
                              default
                            </span>
                          )}
                        </div>
                        <div
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                            formData.isPublic ? "bg-indigo-600" : "bg-gray-300"
                          }`}
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              isPublic: !prev.isPublic,
                            }))
                          }
                          role="switch"
                          aria-checked={formData.isPublic}
                          tabIndex={0}
                          title={
                            formData.isPublic
                              ? "Switch to public profile"
                              : "Switch to private profile"
                          }
                        >
                          <span className="sr-only">
                            Toggle profile privacy
                          </span>
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              formData.isPublic
                                ? "translate-x-6"
                                : "translate-x-1"
                            }`}
                          />
                          <span
                            className={`absolute right-1.5 text-xs font-bold text-white ${
                              formData.isPublic ? "opacity-100" : "opacity-0"
                            }`}
                          >
                            <FiGlobe size={12} />
                          </span>
                          <span
                            className={`absolute left-1.5 text-xs font-bold text-gray-500 ${
                              !formData.isPublic ? "opacity-100" : "opacity-0"
                            }`}
                          >
                            <FiLock size={12} />
                          </span>
                        </div>
                      </div>
                    </label>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="submit"
                      disabled={updating}
                      className={`flex justify-center py-2 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                        updating
                          ? "bg-indigo-400"
                          : "bg-indigo-600 hover:bg-indigo-700"
                      } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                    >
                      {updating ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSettingsPopup(false)}
                      className="flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Posts Section */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-bold">Your Posts</h2>
            <Link
              href="/posts"
              className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Create New <span className="ml-1">+</span>
            </Link>
          </div>

          {posts.length === 0 ? (
            <div className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 mb-4">
                <FiMessageSquare size={24} />
              </div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">
                No posts yet
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                You haven't created any posts yet. Start sharing with your
                followers!
              </p>
              <Link
                href="/posts"
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
              </Link>
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="bg-white rounded-lg border border-gray-200 shadow-md hover:shadow-lg transition-all overflow-hidden"
                >
                  {/* Modern post layout - Responsive */}
                  <div className="flex min-w-0">
                    {/* Vote buttons - left side */}
                    <div className="bg-gray-50 w-10 md:w-12 flex flex-col items-center py-4 border-r border-gray-100 flex-shrink-0">
                      <button
                        className={`w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-md transition-colors ${
                          post.user_vote === 1
                            ? "text-orange-500 bg-orange-50"
                            : "text-gray-400 hover:text-orange-500 hover:bg-orange-50"
                        }`}
                        aria-label="Upvote"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-4 h-4 md:w-5 md:h-5"
                        >
                          <path d="M12 4l8 8h-6v8h-4v-8H4z" />
                        </svg>
                      </button>
                      <span
                        className={`text-xs md:text-sm font-medium my-1 ${
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
                        className={`w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-md transition-colors ${
                          post.user_vote === -1
                            ? "text-blue-500 bg-blue-50"
                            : "text-gray-400 hover:text-blue-500 hover:bg-blue-50"
                        }`}
                        aria-label="Downvote"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-4 h-4 md:w-5 md:h-5"
                        >
                          <path d="M12 20l-8-8h6V4h4v8h6z" />
                        </svg>
                      </button>
                    </div>

                    {/* Post content - right side */}
                    <div
                      className="p-2 sm:p-3 md:p-4 flex-1 min-w-0 cursor-pointer"
                      onClick={() => navigateToPost(post.id)}
                    >
                      {/* Post header with user info */}
                      <div className="flex items-center mb-3 min-w-0">
                        {/* User avatar */}
                        <div className="flex-shrink-0 mr-2 md:mr-3">
                          <Avatar
                            avatar={user?.avatar}
                            firstName={user?.first_name}
                            lastName={user?.last_name}
                            size="md"
                            className="border-2 border-gray-100"
                          />
                        </div>

                        {/* Post metadata */}
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center min-w-0">
                            <span className="font-semibold text-gray-900 mr-1 text-sm truncate">
                              {user?.first_name} {user?.last_name}
                            </span>
                          </div>
                          <div className="flex items-center text-xs text-gray-500 min-w-0">
                            <span className="truncate">{formatDate(post.created_at)}</span>
                            <span className="mx-1 flex-shrink-0">·</span>
                            <span className="flex items-center flex-shrink-0">
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
                      </div>

                      {/* Post title */}
                      <h3 className="text-base md:text-lg font-medium mb-2 text-gray-900 leading-snug break-words">
                        {post.title || post.content.split("\n")[0]}
                      </h3>

                      {/* Post content */}
                      <div className="mb-4 text-sm text-gray-800 leading-relaxed line-clamp-3 break-words overflow-hidden">
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
                              className="w-full h-auto max-h-48 sm:max-h-64 md:max-h-72 object-contain"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Post footer with actions */}
                      <div className="flex flex-wrap gap-2 text-xs text-gray-600 pt-2 border-t border-gray-100 min-w-0">
                        <div
                          className="flex items-center py-1.5 px-2.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateToPost(post.id);
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-1.5 text-gray-500"
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
                          <span className="text-xs">{post.comment_count || 0} Comments</span>
                        </div>
                        <div
                          className="flex items-center py-1.5 px-2.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0"
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
                            className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-1.5 text-gray-500"
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
                          <span className="text-xs">Share</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Remove Follower Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showRemoveFollowerConfirm}
        onClose={() => {
          setShowRemoveFollowerConfirm(false);
          setSelectedFollowerId(null);
        }}
        onConfirm={confirmRemoveFollower}
        title="Remove Follower"
        message="Are you sure you want to remove this follower? They will no longer be able to see your posts."
        confirmText="Remove Follower"
        cancelText="Cancel"
        variant="warning"
      />

      {/* Unfollow Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showUnfollowConfirm}
        onClose={() => {
          setShowUnfollowConfirm(false);
          setSelectedUnfollowUserId(null);
        }}
        onConfirm={confirmUnfollow}
        title="Unfollow User"
        message="Are you sure you want to unfollow this user? You will no longer see their posts in your feed."
        confirmText="Unfollow"
        cancelText="Cancel"
        variant="warning"
      />
    </div>
  );
}
