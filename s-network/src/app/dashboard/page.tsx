"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Dashboard() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

        // Check authentication status first
        const authResponse = await fetch(`${backendUrl}/api/auth/check`, {
          method: "GET",
          credentials: "include",
        });

        const authData = await authResponse.json();

        if (!authData.authenticated) {
          router.push("/login");
          return;
        }

        // Fetch user profile
        const profileResponse = await fetch(`${backendUrl}/api/profile`, {
          method: "GET",
          credentials: "include",
        });

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          setUserData(profileData);
        } else {
          throw new Error("Failed to fetch profile data");
        }
      } catch (err) {
        console.error("Dashboard error:", err);
        setError("Failed to load user data");
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
          <div className="text-red-500 mb-4">{error}</div>
          <Link href="/login" className="text-indigo-600 hover:text-indigo-800">
            Return to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="bg-white rounded-lg shadow-md p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

        {userData && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-md">
              <h2 className="text-lg font-semibold mb-2">User Profile</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-600">Name</p>
                  <p className="font-medium">
                    {userData.first_name} {userData.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Email</p>
                  <p className="font-medium">{userData.email}</p>
                </div>
                {userData.nickname && (
                  <div>
                    <p className="text-gray-600">Nickname</p>
                    <p className="font-medium">{userData.nickname}</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-600">Date of Birth</p>
                  <p className="font-medium">{userData.date_of_birth}</p>
                </div>
              </div>

              {userData.about_me && (
                <div className="mt-4">
                  <p className="text-gray-600">About Me</p>
                  <p className="font-medium">{userData.about_me}</p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 p-4 rounded-md">
              <h2 className="text-lg font-semibold mb-2">Account Status</h2>
              <p>
                Profile Visibility:{" "}
                <span className="font-medium">
                  {userData.is_public ? "Public" : "Private"}
                </span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
