import { useState, useEffect } from "react";

interface User {
  id: number;
  first_name: string;
  last_name: string;
  nickname?: string;
  avatar?: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
  is_public?: boolean;
  about_me?: string;
}

interface ProfileUpdateData {
  firstName?: string;
  lastName?: string;
  nickname?: string;
  aboutMe?: string;
  isPublic?: boolean;
  avatar?: File | null;
}

interface UseProfileReturn {
  user: User | null;
  loading: boolean;
  error: string | null;
  followers: User[];
  following: User[];
  updateProfile: (data: ProfileUpdateData) => Promise<boolean>;
  fetchProfileById: (userId: number) => Promise<User | null>;
  followUser: (userId: number) => Promise<boolean>;
  unfollowUser: (userId: number) => Promise<boolean>;
  isFollowing: (userId: number) => boolean;
}

export function useProfile(): UseProfileReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [followers, setFollowers] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

  useEffect(() => {
    fetchCurrentUserProfile();
  }, []);

  const fetchCurrentUserProfile = async () => {
    try {
      setLoading(true);

      // Check authentication first
      const authResponse = await fetch(`${backendUrl}/api/auth/check`, {
        method: "GET",
        credentials: "include",
      });

      if (!authResponse.ok) {
        throw new Error("Not authenticated");
      }

      const authData = await authResponse.json();
      if (!authData.authenticated) {
        throw new Error("Not authenticated");
      }

      // Fetch profile data
      const profileResponse = await fetch(`${backendUrl}/api/profile`, {
        method: "GET",
        credentials: "include",
      });

      if (!profileResponse.ok) {
        throw new Error("Failed to fetch profile");
      }

      const userData = await profileResponse.json();
      setUser(userData);

      // Fetch followers
      await fetchFollowers();

      // Fetch following
      await fetchFollowing(userData.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
      console.error("Profile error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowers = async () => {
    try {
      const followersResponse = await fetch(`${backendUrl}/api/followers`, {
        method: "GET",
        credentials: "include",
      });

      if (followersResponse.ok) {
        const followersData = await followersResponse.json();
        setFollowers(followersData.followers || []);
      }
    } catch (err) {
      console.error("Error fetching followers:", err);
    }
  };

  const fetchFollowing = async (userId: number) => {
    try {
      const followingResponse = await fetch(
        `${backendUrl}/api/following?userId=${userId}`,
        {
          credentials: "include",
        }
      );

      if (followingResponse.ok) {
        const followingData = await followingResponse.json();
        setFollowing(followingData.followings || []);
      }
    } catch (err) {
      console.error("Error fetching following:", err);
    }
  };

  const fetchProfileById = async (userId: number): Promise<User | null> => {
    try {
      const response = await fetch(`${backendUrl}/api/profile/${userId}`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch profile");
      }

      return await response.json();
    } catch (err) {
      console.error("Error fetching profile by ID:", err);
      return null;
    }
  };

  const updateProfile = async (data: ProfileUpdateData): Promise<boolean> => {
    try {
      const formData = new FormData();

      if (data.firstName !== undefined)
        formData.append("first_name", data.firstName);
      if (data.lastName !== undefined)
        formData.append("last_name", data.lastName);
      if (data.nickname !== undefined)
        formData.append("nickname", data.nickname);
      if (data.aboutMe !== undefined) formData.append("about_me", data.aboutMe);
      if (data.isPublic !== undefined)
        formData.append("is_public", data.isPublic.toString());
      if (data.avatar) formData.append("avatar", data.avatar);

      const response = await fetch(`${backendUrl}/api/profile`, {
        method: "PUT",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update profile");
      }

      const updatedUser = await response.json();
      setUser(updatedUser);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
      return false;
    }
  };

  const followUser = async (userId: number): Promise<boolean> => {
    try {
      const response = await fetch(`${backendUrl}/api/follow/${userId}`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to follow user");
      }

      // Refresh following list
      if (user) {
        await fetchFollowing(user.id);
      }

      return true;
    } catch (err) {
      console.error("Error following user:", err);
      return false;
    }
  };

  const unfollowUser = async (userId: number): Promise<boolean> => {
    try {
      const response = await fetch(`${backendUrl}/api/unfollow/${userId}`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to unfollow user");
      }

      // Refresh following list
      if (user) {
        await fetchFollowing(user.id);
      }

      return true;
    } catch (err) {
      console.error("Error unfollowing user:", err);
      return false;
    }
  };

  const isFollowing = (userId: number): boolean => {
    return following.some((followedUser) => followedUser.id === userId);
  };

  return {
    user,
    loading,
    error,
    followers,
    following,
    updateProfile,
    fetchProfileById,
    followUser,
    unfollowUser,
    isFollowing,
  };
}
