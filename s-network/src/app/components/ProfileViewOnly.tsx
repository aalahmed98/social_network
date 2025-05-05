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
  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followers, setFollowers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        // 1) Fetch user data
        const uRes = await fetch(`/api/users/${userId}`, {
          credentials: "include",
        });
        if (!uRes.ok) throw new Error("User not found");
        const uData: User = await uRes.json();
        setUser(uData);

        // 2) Fetch posts by this user
        const pRes = await fetch(`/api/posts?userId=${userId}`, {
          credentials: "include",
        });
        if (!pRes.ok) throw new Error("Failed to load posts");
        const pJson = await pRes.json();
        // Filter posts to only show the ones for this user
        const userPosts = pJson.posts
          ? pJson.posts.filter((post: Post) => post.user_id === userId)
          : [];
        setPosts(userPosts);

        // 3) Fetch followers list
        const fRes = await fetch(`/api/followers?userId=${userId}`, {
          credentials: "include",
        });
        if (!fRes.ok) throw new Error("Failed to load followers");
        const fJson = await fRes.json();
        setFollowers(fJson.followers || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [userId]);

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
        {/* Profile header */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center space-x-4">
            {user?.avatar ? (
              <Image
                src={getImageUrl(user.avatar)}
                alt={`${user.first_name} avatar`}
                width={80}
                height={80}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-300 flex items-center justify-center text-2xl text-white">
                {user?.first_name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">
                {user?.first_name} {user?.last_name}
              </h1>
              {user?.nickname && <p className="text-gray-500">@{user.nickname}</p>}
              {user?.created_at && (
                <p className="text-sm text-gray-400 flex items-center">
                  <FiCalendar className="mr-1" />
                  Joined {new Date(user.created_at).toLocaleDateString()}
                </p>
              )}
              {user?.about_me && <p className="mt-2 text-gray-700">{user.about_me}</p>}
            </div>
          </div>
          <div className="grid grid-cols-3 text-center mt-6">
            <div>
              <div className="text-xl font-bold">{posts.length}</div>
              <div className="text-gray-500">Posts</div>
            </div>
            <div>
              <div className="text-xl font-bold">{followers.length}</div>
              <div className="text-gray-500">Followers</div>
            </div>
            <div>
              <div className="text-xl font-bold">—</div>
              <div className="text-gray-500">Following</div>
            </div>
          </div>
        </div>

        {/* Posts Section */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
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
      </div>
    </div>
  );
}
