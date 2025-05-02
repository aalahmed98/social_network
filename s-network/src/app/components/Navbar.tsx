"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoggedIn, loading, logout } = useAuth();

  const handleLogout = async () => {
    await logout();

    // If already on home page, refresh the page
    if (pathname === "/") {
      window.location.reload();
    } else {
      // If on other pages, redirect to home page
      router.push("/");
    }
  };

  if (loading) {
    return (
      <nav className="bg-white shadow fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-xl font-bold text-indigo-600">
          Social Network
        </Link>
      </nav>
    );
  }

  return (
    <nav className="bg-white shadow fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
      <Link href="/" className="text-xl font-bold text-indigo-600">
        Social Network
      </Link>

      {isLoggedIn ? (
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg"
        >
          Logout
        </button>
      ) : (
        pathname !== "/login" &&
        pathname !== "/register" && (
          <div className="flex gap-2">
            <Link
              href="/login"
              className="px-4 py-2 rounded-lg text-sm font-medium text-indigo-600 border border-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
            >
              Register
            </Link>
          </div>
        )
      )}
    </nav>
  );
}
