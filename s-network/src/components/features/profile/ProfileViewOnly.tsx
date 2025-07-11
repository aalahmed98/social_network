"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FiMessageSquare,
  FiCalendar,
  FiGlobe,
  FiUsers,
  FiLock,
  FiUserPlus,
  FiUserCheck,
} from "react-icons/fi";
import { getImageUrl, createAvatarFallback } from "@/utils/image";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

interface Post {
  id: number;
  title?: string;
  content: string;
  image_url?: string;
  privacy: string;
  created_at: string;
  user_id: number;
}

interface User {
  id: number;
  first_name: string;
  last_name: string;
  nickname?: string;
  avatar?: string;
  about_me?: string;
  is_public: boolean;
  created_at?: string;
}

interface ProfileViewOnlyProps {
  userId: number;
}

export default function ProfileViewOnly({ userId }: ProfileViewOnlyProps) {
  const router = useRouter();
  const { isLoggedIn, loading: authLoading } = useAuth();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followers, setFollowers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFollowing, setIsFollowing] = useState(false);
  const [followRequestSent, setFollowRequestSent] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const [following, setFollowing] = useState<any[]>([]);
  const [showFollowersPopup, setShowFollowersPopup] = useState(false);
  const [showFollowingPopup, setShowFollowingPopup] = useState(false);
  const [showUnfollowConfirm, setShowUnfollowConfirm] = useState(false);

  // Fetch current user info
  useEffect(() => {
    async function fetchCurrentUser() {
      if (!isLoggedIn || authLoading) return;

      try {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
        const response = await fetch(`${backendUrl}/api/auth/me`, {
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const userData = await response.json();
          if (process.env.NODE_ENV === 'development') {
          console.log("Current user data:", userData);
        }
          setCurrentUser(userData);
        } else {
          console.error("Failed to fetch current user:", await response.text());
        }
      } catch (error) {
        console.error("Error fetching current user:", error);
      }
    }

    fetchCurrentUser();
  }, [isLoggedIn, authLoading]);

  // Load profile data
  useEffect(() => {
    async function loadData() {
      try {
        if (process.env.NODE_ENV === 'development') {
        console.log("Loading profile data for userId:", userId);
      }
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

        // 1) Fetch user data
        const uRes = await fetch(`${backendUrl}/api/users/${userId}`, {
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        });
        if (!uRes.ok) {
          console.error("Failed to fetch user data:", await uRes.text());
          throw new Error("User not found");
        }
        const uData: User = await uRes.json();
        setUser(uData);
        if (process.env.NODE_ENV === 'development') {
          console.log("User data loaded:", uData);
        }

        // 2) Fetch posts by this user
        const pRes = await fetch(`${backendUrl}/api/posts?userId=${userId}`, {
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        });
        if (!pRes.ok) {
          console.error("Failed to fetch posts:", await pRes.text());
          throw new Error("Failed to load posts");
        }
        const pJson = await pRes.json();
        // Filter posts to only show the ones for this user
        const userPosts = pJson.posts
          ? pJson.posts.filter((post: Post) => post.user_id === userId)
          : [];
        setPosts(userPosts);
        if (process.env.NODE_ENV === 'development') {
          console.log("Posts loaded:", userPosts.length);
        }

        // 3) Fetch followers list
        const fRes = await fetch(
          `${backendUrl}/api/followers?userId=${userId}`,
          {
            credentials: "include",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
          }
        );
        if (!fRes.ok) {
          console.error("Failed to fetch followers:", await fRes.text());
          throw new Error("Failed to load followers");
        }
        const fJson = await fRes.json();
        setFollowers(fJson.followers || []);
        if (process.env.NODE_ENV === 'development') {
          console.log("Followers loaded:", fJson.followers?.length || 0);
        }

        // 4) Fetch following list
        const flRes = await fetch(
          `${backendUrl}/api/following?userId=${userId}`,
          {
            credentials: "include",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
          }
        );
        if (!flRes.ok) {
          console.error("Failed to fetch following:", await flRes.text());
          throw new Error("Failed to load following");
        }
        const flJson = await flRes.json();
        setFollowing(flJson.followings || []);
        console.log("Following loaded:", flJson.followings?.length || 0);
      } catch (err: any) {
        console.error("Error loading profile data:", err);
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [userId]);

  // Check follow status separately once we have the current user
  useEffect(() => {
    // Only check follow status if we have the current user loaded
    if (currentUser && userId !== currentUser.id) {
      checkFollowStatus();
    }
  }, [currentUser, userId]);

  // Check if the current user is following this profile
  const checkFollowStatus = async () => {
    if (!currentUser) return;

    try {
      // Use full API path
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(
        `${backendUrl}/api/follow/status/${userId}`,
        {
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("Follow status response:", data);
        setIsFollowing(data.isFollowing);
        setFollowRequestSent(data.followRequestSent);
      } else {
        console.error("Follow status check failed:", await response.text());
      }
    } catch (error) {
      console.error("Error checking follow status:", error);
    }
  };

  // Update the handleFollowAction to handle showing the dialog
  const handleFollowAction = async () => {
    if (isFollowing) {
      // Show unfollow confirmation dialog
      setShowUnfollowConfirm(true);
    } else {
      // Follow user directly
      if (!currentUser || followLoading) return;

      console.log("Attempting to follow user:", userId);
      setFollowLoading(true);

      try {
        // Use full API path
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
        const response = await fetch(`${backendUrl}/api/follow/${userId}`, {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        });

        console.log("Follow response status:", response.status);

        if (response.ok) {
          const data = await response.json();
          console.log("Follow response data:", data);

          if (data.status === "followed") {
            // Direct follow for public accounts
            setIsFollowing(true);
            // Add current user to followers
            setFollowers([
              ...followers,
              {
                id: currentUser.id,
                first_name: currentUser.first_name,
                last_name: currentUser.last_name,
                avatar: currentUser.avatar,
              },
            ]);
          } else if (data.status === "request_sent") {
            // Follow request for private accounts
            setFollowRequestSent(true);
          }
        } else {
          const errorText = await response.text();
          console.error("Follow request failed:", response.status, errorText);
          showError("Follow Failed", `Failed to follow user: ${errorText}`);
        }
      } catch (error) {
        console.error("Error following user:", error);
        showError("Follow Error", "Failed to follow user. Please try again.");
      } finally {
        setFollowLoading(false);
      }
    }
  };

  const handleUnfollow = async () => {
    if (!currentUser || followLoading) return;

    console.log("Attempting to unfollow user:", userId);
    setFollowLoading(true);

    try {
      // Use full API path
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/follow/${userId}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      console.log("Unfollow response status:", response.status);

      if (response.ok) {
        setIsFollowing(false);
        // Update followers count by removing current user from followers
        setFollowers(followers.filter((f) => f.id !== currentUser.id));
      } else {
        const errorText = await response.text();
        console.error("Unfollow request failed:", response.status, errorText);
        showError("Unfollow Failed", `Failed to unfollow user: ${errorText}`);
      }
    } catch (error) {
      console.error("Error unfollowing user:", error);
      showError("Unfollow Error", "Failed to unfollow user. Please try again.");
    } finally {
      setFollowLoading(false);
      setShowUnfollowConfirm(false); // Close the dialog
    }
  };

  const handleCancelRequest = async () => {
    if (!currentUser || followLoading) return;

    console.log("Attempting to cancel follow request for user:", userId);
    setFollowLoading(true);

    try {
      // Use full API path
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(
        `${backendUrl}/api/follow/request/${userId}/cancel`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Cancel request response status:", response.status);

      if (response.ok) {
        setFollowRequestSent(false);
      } else {
        const errorText = await response.text();
        console.error("Cancel request failed:", response.status, errorText);
        showError(
          "Cancel Failed",
          `Failed to cancel follow request: ${errorText}`
        );
      }
    } catch (error) {
      console.error("Error canceling follow request:", error);
      showError(
        "Cancel Error",
        "Failed to cancel follow request. Please try again."
      );
    } finally {
      setFollowLoading(false);
    }
  };

  const handleRemoveFollower = async (followerId: number) => {
    if (!confirm("Are you sure you want to remove this follower?")) {
      return;
    }

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(
        `${backendUrl}/api/followers/remove/${followerId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (response.ok) {
        // Remove the follower from the local state
        setFollowers(followers.filter((f) => f.id !== followerId));
        showSuccess("Follower Removed", "Follower removed successfully");
      } else {
        const errorText = await response.text();
        showError("Remove Failed", `Failed to remove follower: ${errorText}`);
      }
    } catch (error) {
      console.error("Error removing follower:", error);
      showError("Remove Error", "Failed to remove follower. Please try again.");
    }
  };

  const handleUnfollowFromList = async (userId: number) => {
    if (!confirm("Are you sure you want to unfollow this user?")) {
      return;
    }

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/follow/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        // Remove the user from the following list
        setFollowing(following.filter((f) => f.id !== userId));
        showSuccess("Unfollowed", "User unfollowed successfully");
      } else {
        const errorText = await response.text();
        showError("Unfollow Failed", `Failed to unfollow user: ${errorText}`);
      }
    } catch (error) {
      console.error("Error unfollowing user:", error);
      showError("Unfollow Error", "Failed to unfollow user. Please try again.");
    }
  };

  if (loading) return <div className="p-4 text-center">Loading…</div>;
  if (error)
    return (
      <div className="p-4 text-center text-red-500">
        <p>{error}</p>
        <button onClick={() => router.back()}>Go back</button>
      </div>
    );

  // Don't show follow button for own profile
  const isOwnProfile = currentUser?.id === userId;

  return (
    <div className="min-h-screen bg-gray-100 p-2 sm:p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Profile header */}
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-3 sm:space-x-4">
              {user?.avatar ? (
                <img
                  src={getImageUrl(user.avatar)}
                  alt={`${user.first_name} avatar`}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover"
                  onError={(e) =>
                    createAvatarFallback(
                      e.currentTarget,
                      user?.first_name?.charAt(0) || "?",
                      "text-xl sm:text-2xl"
                    )
                  }
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-300 flex items-center justify-center text-xl sm:text-2xl text-white">
                  {user?.first_name.charAt(0)}
                </div>
              )}
              <div>
                <div className="flex items-center">
                  <h1 className="text-2xl font-bold">
                    {user?.first_name} {user?.last_name}
                  </h1>
                  {user && (
                    <span className="ml-2">
                      {user.is_public ? (
                        <FiGlobe className="text-green-500" />
                      ) : (
                        <FiLock className="text-orange-500" />
                      )}
                    </span>
                  )}
                </div>
                {user?.nickname && (
                  <p className="text-gray-500">@{user.nickname}</p>
                )}
                {user?.created_at && (
                  <p className="text-sm text-gray-400 flex items-center">
                    <FiCalendar className="mr-1" />
                    Joined {new Date(user.created_at).toLocaleDateString()}
                  </p>
                )}
                {user?.about_me && (
                  <p className="mt-2 text-gray-700">{user.about_me}</p>
                )}
              </div>
            </div>

            {/* Follow/Unfollow Button */}
            {!isOwnProfile && (
              <div>
                {isFollowing ? (
                  <button
                    onClick={handleFollowAction}
                    disabled={followLoading}
                    className="flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg hover:bg-indigo-200 transition-colors"
                  >
                    <FiUserCheck />
                    Following
                  </button>
                ) : followRequestSent ? (
                  <button
                    onClick={handleCancelRequest}
                    disabled={followLoading}
                    className="flex items-center gap-2 bg-gray-100 text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <FiUserPlus />
                    {followLoading ? "Canceling..." : "Cancel Request"}
                  </button>
                ) : (
                  <button
                    onClick={handleFollowAction}
                    disabled={followLoading}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <FiUserPlus />
                    {user?.is_public ? "Follow" : "Request to Follow"}
                  </button>
                )}
              </div>
            )}
          </div>
          <div>
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
                            {/* Show remove button only if this is the current user's own profile */}
                            {currentUser && currentUser.id === userId && (
                              <button
                                onClick={() => handleRemoveFollower(f.id)}
                                className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded border border-red-300 hover:border-red-500 transition-colors"
                                title="Remove follower"
                              >
                                Remove
                              </button>
                            )}
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
                            {/* Show unfollow button only if this is the current user's own profile */}
                            {currentUser && currentUser.id === userId && (
                              <button
                                onClick={() => handleUnfollowFromList(f.id)}
                                className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded border border-red-300 hover:border-red-500 transition-colors"
                                title="Unfollow"
                              >
                                Unfollow
                              </button>
                            )}
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

        {/* Posts Section */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold">Posts</h2>
          </div>

          {posts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {/* Show different icon and message for private accounts */}
              {!user?.is_public &&
              !isFollowing &&
              currentUser?.id !== userId ? (
                <>
                  <FiLock size={32} className="mx-auto mb-2" />
                  <p>Account private.</p>
                </>
              ) : (
                <>
                  <FiMessageSquare size={32} className="mx-auto mb-2" />
                  <p>No posts yet.</p>
                </>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="flex p-3 sm:p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/posts/${post.id}`)}
                >
                  {post.image_url && (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-lg overflow-hidden mr-3 sm:mr-4">
                      <img
                        src={getImageUrl(post.image_url)}
                        alt={post.title || "Post image"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {post.title && (
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                        {post.title}
                      </h3>
                    )}
                    <p className="text-sm text-gray-700 line-clamp-2 mt-1 break-words">
                      {post.content}
                    </p>
                    <div className="mt-2 text-xs text-gray-500 flex items-center flex-wrap">
                      <FiCalendar className="mr-1" />
                      <span>
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                      <span className="mx-2">&bull;</span>
                      {post.privacy === "public" && (
                        <>
                          <FiGlobe className="mr-1" /> Public
                        </>
                      )}
                      {post.privacy === "almost_private" && (
                        <>
                          <FiUsers className="mr-1" /> Followers Only
                        </>
                      )}
                      {post.privacy === "private" && (
                        <>
                          <FiLock className="mr-1" /> Private
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Unfollow Confirmation Dialog */}
      {showUnfollowConfirm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-80 p-4">
            <h3 className="text-lg font-semibold mb-2">Unfollow User</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to unfollow {user?.first_name}{" "}
              {user?.last_name}?
            </p>
            <div className="flex justify-end space-x-2">
              <button
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                onClick={() => setShowUnfollowConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                onClick={handleUnfollow}
                disabled={followLoading}
              >
                {followLoading ? "Unfollowing..." : "Unfollow"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
