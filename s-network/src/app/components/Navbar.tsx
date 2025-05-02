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
      <nav className="bg-white shadow fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-indigo-600">
                S-Network
              </Link>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-white shadow fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="text-xl font-bold text-indigo-600">
              S-Network
            </Link>
          </div>

          <div className="flex items-center">
            {isLoggedIn ? (
              <>
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 mx-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Logout
                </button>
              </>
            ) : (
              pathname !== "/login" && pathname !== "/register" && <></>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
