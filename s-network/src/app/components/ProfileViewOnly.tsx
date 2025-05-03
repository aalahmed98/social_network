"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  FiMessageSquare,
  FiCalendar,
  FiGlobe,
  FiUsers,
  FiLock,
} from "react-icons/fi";
import { getImageUrl } from "@/utils/image";

interface Post {
  id: number;
  title?: string;
  content: string;
  image_url?: string;
  privacy: string;
  created_at: string;
  user_id: number;
  author: {
    first_name: string;
    last_name: string;
    avatar?: string;
  };
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

// 1) Define your props interface
interface ProfileViewOnlyProps {
  username: string;
}

export default function ProfileViewOnly({
  username,
}: ProfileViewOnlyProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

        // 1) load the user by username
        const uRes = await fetch(
          `${backendUrl}/api/users/${encodeURIComponent(username)}`,
          { credentials: "include" }
        );
        if (!uRes.ok) throw new Error("User not found");
        const uData: User = await uRes.json();
        setUser(uData);

        // 2) load all posts, then filter client‐side by user_id
        const pRes = await fetch(`${backendUrl}/api/posts`, {
          credentials: "include",
        });
        if (pRes.ok) {
          const { posts: allPosts } = await pRes.json();
          const userPosts = Array.isArray(allPosts)
            ? allPosts.filter((p: Post) => p.user_id === uData.id)
            : [];
          setPosts(userPosts);
        }

        // 3) load followers count
        const fRes = await fetch(
          `${backendUrl}/api/followers?userId=${uData.id}`,
          { credentials: "include" }
        );
        if (fRes.ok) {
          const { followers } = await fRes.json();
          setFollowersCount(Array.isArray(followers) ? followers.length : 0);
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [username, router]);

  if (loading) return <div className="p-4 text-center">Loading…</div>;
  if (error)
    return (
      <div className="p-4 text-center text-red-500">
        <p>{error}</p>
        <button onClick={() => router.back()}>Go back</button>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* … your profile‐header and stats … */}

        {/* ↓↓↓ Posts Section ↓↓↓ */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-bold">Posts</h2>
          </div>

          {posts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FiMessageSquare size={32} className="mx-auto mb-2" />
              <p>No posts yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="flex p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/posts/${post.id}`)}
                >
                  {post.image_url && (
                    <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden mr-4">
                      <Image
                        src={getImageUrl(post.image_url)}
                        alt={post.title || "Post image"}
                        width={80}
                        height={80}
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    {post.title && (
                      <h3 className="text-lg font-semibold text-gray-900">
                        {post.title}
                      </h3>
                    )}
                    <p className="text-sm text-gray-700 line-clamp-2 mt-1">
                      {post.content}
                    </p>
                    <div className="mt-2 text-xs text-gray-500 flex items-center">
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
        {/* ↑↑↑ End Posts Section ↑↑↑ */}
      </div>
    </div>
  );
}
