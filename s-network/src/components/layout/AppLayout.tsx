"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { SearchProvider, useSearch } from "@/context/SearchContext";
import { Navbar, Sidebar, MinimalSidebar } from "@/components/layout";
import { SearchSidebar } from "@/components/features/search";
import { NotificationSidebar } from "@/components/features/notifications";
import {
  NotificationProvider,
  useNotifications,
} from "@/context/NotificationContext";
import { usePathname, useRouter } from "next/navigation";
import PageTransition from "@/components/ui/PageTransition";
import ErrorNotification from "@/components/ui/ErrorNotification";

interface AppLayoutProps {
  children: React.ReactNode;
}

// Wrapper component that includes the SearchProvider
export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <NotificationProvider>
      <SearchProvider>
        <AppLayoutInner>{children}</AppLayoutInner>
      </SearchProvider>
    </NotificationProvider>
  );
}

function AppLayoutInner({ children }: AppLayoutProps) {
  const { isLoggedIn, loading } = useAuth();
  const { isSearchExpanded, collapseSearch } = useSearch();
  const { isNotificationSidebarOpen, closeNotificationSidebar } =
    useNotifications();
  const pathname = usePathname();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Don't show sidebar on login and register pages
  const showSidebar =
    isLoggedIn && pathname !== "/login" && pathname !== "/register";

  // Close search sidebar when navigating to any page
  useEffect(() => {
    if (isSearchExpanded) {
      collapseSearch();
    }
  }, [pathname, collapseSearch]);

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
        {showSidebar && (
          <>
            {/* Show minimal sidebar on mobile, full sidebar on desktop */}
            {isSearchExpanded ? (
              <>
                <MinimalSidebar />
                <SearchSidebar />
              </>
            ) : (
              <>
                {/* Hidden on mobile, visible on desktop */}
                <div className="hidden md:block">
                  <Sidebar />
                </div>
                {/* Visible on mobile, hidden on desktop */}
                <div className="md:hidden">
                  <MinimalSidebar />
                </div>
              </>
            )}
          </>
        )}

        <main
          className={`flex-1 ${
            showSidebar
              ? isSearchExpanded
                ? "ml-96" // 64px (minimal sidebar) + 320px (search sidebar) = 384px
                : "ml-16 md:ml-64" // 16px on mobile, 64px on desktop
              : ""
          }`}
        >
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      {/* Notification Sidebar */}
      {isLoggedIn && (
        <NotificationSidebar
          isOpen={isNotificationSidebarOpen}
          onClose={closeNotificationSidebar}
        />
      )}

      {/* Error Notification */}
      <ErrorNotification />
    </div>
  );
}
