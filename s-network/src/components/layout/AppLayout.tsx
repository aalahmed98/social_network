"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/app/components/Navbar";
import Sidebar from "@/app/components/Sidebar";
import { usePathname } from "next/navigation";
import PageTransition from "@/components/ui/PageTransition";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { isLoggedIn, loading } = useAuth();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Don't show sidebar on login and register pages
  const showSidebar =
    isLoggedIn && pathname !== "/login" && pathname !== "/register";

  useEffect(() => {
    setIsMounted(true);

    // Set initial load complete after auth check
    if (!loading) {
      setInitialLoadComplete(true);
    }
  }, [loading]);

  // Handle initial load - show nothing to avoid flicker
  if (!isMounted) {
    return null;
  }

  // Show loading spinner only during initial auth check
  if (loading && !initialLoadComplete) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="fixed top-0 left-0 right-0 bg-white shadow h-16 z-50" />
        <div className="pt-16 flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />

      <div className="flex pt-16">
        {showSidebar && <Sidebar />}

        <main className={`flex-1 ${showSidebar ? "ml-64" : ""}`}>
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
