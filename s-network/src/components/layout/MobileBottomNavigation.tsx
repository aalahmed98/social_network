"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSearch } from "@/context/SearchContext";

export default function MobileBottomNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { toggleSearchExpanded, isSearchExpanded, collapseSearch } = useSearch();

  const handleSearchClick = (e: React.MouseEvent) => {
    e.preventDefault();
    toggleSearchExpanded();
  };

  const handleLinkClick = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    collapseSearch();
    router.push(path);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 md:hidden">
      <div className="flex justify-around items-center h-16 px-2">
        {/* Home Button */}
        <button
          onClick={(e) => handleLinkClick(e, "/")}
          className={`flex flex-col items-center justify-center p-3 transition-colors duration-200 ${
            pathname === "/" && !isSearchExpanded
              ? "text-indigo-600"
              : "text-gray-600 hover:text-indigo-500"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
          <span className="text-xs mt-1 font-medium">Home</span>
        </button>

        {/* Search Button */}
        <button
          onClick={handleSearchClick}
          className={`flex flex-col items-center justify-center p-3 transition-colors duration-200 ${
            isSearchExpanded ? "text-indigo-600" : "text-gray-600 hover:text-indigo-500"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs mt-1 font-medium">Search</span>
        </button>

        {/* Create Post Button */}
        <button
          onClick={(e) => handleLinkClick(e, "/posts")}
          className={`flex flex-col items-center justify-center p-3 transition-colors duration-200 ${
            pathname === "/posts" && !isSearchExpanded
              ? "text-indigo-600"
              : "text-gray-600 hover:text-indigo-500"
          }`}
        >
          <div className={`p-1 rounded-lg ${
            pathname === "/posts" && !isSearchExpanded
              ? "bg-indigo-600 text-white"
              : "bg-gray-100 text-gray-600"
          }`}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
            </svg>
          </div>
          <span className="text-xs mt-1 font-medium">Create</span>
        </button>

        {/* Profile Button */}
        <button
          onClick={(e) => handleLinkClick(e, "/profile")}
          className={`flex flex-col items-center justify-center p-3 transition-colors duration-200 ${
            pathname === "/profile" && !isSearchExpanded
              ? "text-indigo-600"
              : "text-gray-600 hover:text-indigo-500"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs mt-1 font-medium">Profile</span>
        </button>
      </div>
    </div>
  );
} 