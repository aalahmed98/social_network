"use client";

import React, { useEffect, useState, FormEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";

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

  // New state variables for follower and following counts
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Define backendUrl so that we can prepend it to avatar paths if needed.
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

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

  // New: Fetch follower and following counts once user data is available
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
        if (user && user.id) {
          const followerRes = await fetch(
            `${backendUrl}/api/followers/count?user_id=${user.id}`,
            { method: "GET", credentials: "include" }
          );
          if (followerRes.ok) {
            const followerData = await followerRes.json();
            setFollowerCount(followerData.followers_count);
          } else {
            console.error("Failed to fetch follower count");
          }

          const followingRes = await fetch(
            `${backendUrl}/api/following/count?user_id=${user.id}`,
            { method: "GET", credentials: "include" }
          );
          if (followingRes.ok) {
            const followingData = await followingRes.json();
            setFollowingCount(followingData.following_count);
          } else {
            console.error("Failed to fetch following count");
          }
        }
      } catch (err) {
        console.error("Error fetching counts", err);
      }
    };

    fetchCounts();
  }, [user]);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pt-20 pb-12">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md overflow-hidden">
        <div className="md:flex">
          <div className="md:w-1/3 bg-indigo-50 p-6 flex flex-col items-center">
            <div className="w-40 h-40 rounded-full overflow-hidden bg-gray-200 mb-6">
              {user?.avatar ? (
                // Prepend backendUrl to the avatar path so the image loads correctly
                <img
                  src={`${backendUrl}/${user.avatar}`}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  No Image
                </div>
              )}
            </div>
            <h2 className="text-xl font-bold">
              {user?.first_name} {user?.last_name}
            </h2>
            <p className="text-gray-600">{user?.email}</p>
            <p className="text-gray-500 mt-2">
              Member since{" "}
              {new Date(user?.created_at || Date.now()).toLocaleDateString()}
            </p>
            {/* New: Display follower and following counts */}
            <div className="flex space-x-4 mt-4">
              <div className="text-center">
                <p className="text-gray-500 mt-2">{followerCount}</p>
                <p className="text-gray-600 text-sm">Followers</p>
              </div>
              <div className="text-center">
                <p className="text-gray-500 mt-2">{followingCount}</p>
                <p className="text-gray-600 text-sm">Following</p>
              </div>
            </div>
          </div>

          <div className="md:w-2/3 p-6">
            <h2 className="text-2xl font-bold mb-6">Edit Profile</h2>

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
              <div className="grid grid-cols-2 gap-4">
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
                  className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
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
        </div>
      </div>
    </div>
  );
}
