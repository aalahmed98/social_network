"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import { format, subDays } from "date-fns";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface AnalyticsData {
  total_followers: number;
  total_following: number;
  total_posts: number;
  total_likes: number;
  total_comments: number;
  follower_growth: {
    last_day: Array<{ date: string; value: number }>;
    last_week: Array<{ date: string; value: number }>;
    last_30_days: Array<{ date: string; value: number }>;
  };
  post_growth: {
    last_day: Array<{ date: string; value: number }>;
    last_week: Array<{ date: string; value: number }>;
    last_30_days: Array<{ date: string; value: number }>;
  };
  like_growth: {
    last_day: Array<{ date: string; value: number }>;
    last_week: Array<{ date: string; value: number }>;
    last_30_days: Array<{ date: string; value: number }>;
  };
  recent_followers: Array<{
    id: number;
    first_name: string;
    last_name: string;
    avatar: string;
    followed_at: string;
  }>;
  top_posts: Array<{
    id: number;
    title: string;
    content: string;
    likes_count: number;
    comments_count: number;
    created_at: string;
  }>;
  engagement_rate: number;
  avg_likes_per_post: number;
  avg_comments_per_post: number;
}

export default function Dashboard() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<"1d" | "7d" | "30d">(
    "30d"
  );
  const [activeTab, setActiveTab] = useState<
    "overview" | "followers" | "posts" | "engagement"
  >("overview");

  useEffect(() => {
    const fetchData = async () => {
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
        }

        // Fetch analytics data
        const analyticsResponse = await fetch(
          `${backendUrl}/api/analytics/dashboard`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        if (analyticsResponse.ok) {
          const analytics = await analyticsResponse.json();
          setAnalyticsData(analytics);
        } else {
          throw new Error("Failed to fetch analytics data");
        }
      } catch (err) {
        console.error("Dashboard error:", err);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const getChartData = (
    dataArray: Array<{ date: string; value: number }>,
    label: string,
    color: string
  ) => {
    return {
      labels: dataArray.map((item) => formatChartLabel(item.date)),
      datasets: [
        {
          label,
          data: dataArray.map((item) => item.value),
          borderColor: color,
          backgroundColor: color + "20",
          fill: true,
          tension: 0.4,
        },
      ],
    };
  };

  const getBarChartData = (
    dataArray: Array<{ date: string; value: number }>,
    label: string,
    color: string
  ) => {
    return {
      labels: dataArray.map((item) => formatChartLabel(item.date)),
      datasets: [
        {
          label,
          data: dataArray.map((item) => item.value),
          backgroundColor: color,
          borderColor: color,
          borderWidth: 1,
        },
      ],
    };
  };

  const formatChartLabel = (dateString: string) => {
    // Check if it's a time format (HH:MM) for hourly data
    if (dateString.match(/^\d{2}:\d{2}$/)) {
      return dateString; // Return time as-is (e.g., "15:04")
    }

    // Check if it's a date format (YYYY-MM-DD) for daily data
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      try {
        return format(new Date(dateString), "MMM dd"); // Format as "Jan 15"
      } catch (error) {
        console.error("Error formatting date:", dateString, error);
        return dateString; // Fallback to original string
      }
    }

    // Fallback for any other format
    return dateString;
  };

  const getDoughnutData = () => {
    if (!analyticsData) return { labels: [], datasets: [] };

    return {
      labels: ["Likes", "Comments"],
      datasets: [
        {
          data: [analyticsData.total_likes, analyticsData.total_comments],
          backgroundColor: ["#3B82F6", "#10B981"],
          borderColor: ["#2563EB", "#059669"],
          borderWidth: 2,
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
        },
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "bottom" as const,
      },
    },
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Loading Analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center">
          <div className="text-red-500 mb-4 text-lg">{error}</div>
          <Link
            href="/login"
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Return to login
          </Link>
        </div>
      </div>
    );
  }

  const getCurrentPeriodData = (type: "followers" | "posts" | "likes") => {
    if (!analyticsData) return [];

    const growthData =
      type === "followers"
        ? analyticsData.follower_growth
        : type === "posts"
        ? analyticsData.post_growth
        : analyticsData.like_growth;

    switch (selectedPeriod) {
      case "1d":
        return growthData.last_day;
      case "7d":
        return growthData.last_week;
      case "30d":
        return growthData.last_30_days;
      default:
        return growthData.last_30_days;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Analytics Dashboard
          </h1>
          <p className="text-gray-600">
            Welcome back, {userData?.first_name}! Here's your social media
            performance overview.
          </p>
        </div>

        {/* Period Selector */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-white rounded-lg p-1 shadow-sm w-fit">
            {[
              { key: "1d", label: "Last Day" },
              { key: "7d", label: "Last Week" },
              { key: "30d", label: "Last 30 Days" },
            ].map((period) => (
              <button
                key={period.key}
                onClick={() =>
                  setSelectedPeriod(period.key as "1d" | "7d" | "30d")
                }
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedPeriod === period.key
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Stats Cards */}
        {analyticsData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total Followers
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {analyticsData.total_followers}
                  </p>
                </div>
                <div className="bg-blue-100 p-3 rounded-full">
                  <svg
                    className="w-6 h-6 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total Posts
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {analyticsData.total_posts}
                  </p>
                </div>
                <div className="bg-green-100 p-3 rounded-full">
                  <svg
                    className="w-6 h-6 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total Likes
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {analyticsData.total_likes}
                  </p>
                </div>
                <div className="bg-purple-100 p-3 rounded-full">
                  <svg
                    className="w-6 h-6 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total Comments
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {analyticsData.total_comments}
                  </p>
                </div>
                <div className="bg-yellow-100 p-3 rounded-full">
                  <svg
                    className="w-6 h-6 text-yellow-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-indigo-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Engagement Rate
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {analyticsData.engagement_rate.toFixed(1)}%
                  </p>
                </div>
                <div className="bg-indigo-100 p-3 rounded-full">
                  <svg
                    className="w-6 h-6 text-indigo-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Charts Section */}
        {analyticsData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Follower Growth Chart */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Follower Growth
              </h3>
              <div className="h-80">
                <Line
                  data={getChartData(
                    getCurrentPeriodData("followers"),
                    "New Followers",
                    "#3B82F6"
                  )}
                  options={chartOptions}
                />
              </div>
            </div>

            {/* Post Activity Chart */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Post Activity
              </h3>
              <div className="h-80">
                <Bar
                  data={getBarChartData(
                    getCurrentPeriodData("posts"),
                    "Posts Created",
                    "#10B981"
                  )}
                  options={chartOptions}
                />
              </div>
            </div>

            {/* Likes Growth Chart */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Likes Growth
              </h3>
              <div className="h-80">
                <Line
                  data={getChartData(
                    getCurrentPeriodData("likes"),
                    "Likes Received",
                    "#8B5CF6"
                  )}
                  options={chartOptions}
                />
              </div>
            </div>

            {/* Engagement Distribution */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Engagement Distribution
              </h3>
              <div className="h-80 flex items-center justify-center">
                <div className="w-64 h-64">
                  <Doughnut
                    data={getDoughnutData()}
                    options={doughnutOptions}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Activity Section */}
        {analyticsData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Followers */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Recent Followers
              </h3>
              <div className="space-y-4">
                {analyticsData.recent_followers.length > 0 ? (
                  analyticsData.recent_followers.map((follower) => (
                    <div
                      key={follower.id}
                      className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                        {follower.first_name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {follower.first_name} {follower.last_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {format(
                            new Date(follower.followed_at),
                            "MMM dd, yyyy"
                          )}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    No recent followers
                  </p>
                )}
              </div>
            </div>

            {/* Top Posts */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Top Performing Posts
              </h3>
              <div className="space-y-4">
                {analyticsData.top_posts.length > 0 ? (
                  analyticsData.top_posts.map((post) => (
                    <div key={post.id} className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-2">
                        {post.title}
                      </h4>
                      <p className="text-sm text-gray-600 mb-3">
                        {post.content}
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span className="flex items-center">
                          <svg
                            className="w-4 h-4 mr-1"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {post.likes_count} likes
                        </span>
                        <span className="flex items-center">
                          <svg
                            className="w-4 h-4 mr-1"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {post.comments_count} comments
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">No posts yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link
              href="/posts"
              className="flex items-center justify-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <svg
                className="w-6 h-6 text-blue-600 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="font-medium text-blue-600">Create Post</span>
            </Link>

            <Link
              href="/profile"
              className="flex items-center justify-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              <svg
                className="w-6 h-6 text-green-600 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span className="font-medium text-green-600">Edit Profile</span>
            </Link>

            <Link
              href="/chats"
              className="flex items-center justify-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <svg
                className="w-6 h-6 text-purple-600 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <span className="font-medium text-purple-600">Messages</span>
            </Link>

            <Link
              href="/notifications"
              className="flex items-center justify-center p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
            >
              <svg
                className="w-6 h-6 text-yellow-600 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-5 5v-5zM11 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V9l-6-6z"
                />
              </svg>
              <span className="font-medium text-yellow-600">Notifications</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
