"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSearch } from "@/context/SearchContext";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { expandSearch, isSearchExpanded, collapseSearch } = useSearch();

  const handleSearchClick = (e: React.MouseEvent) => {
    e.preventDefault();
    expandSearch();
  };

  const handleLinkClick = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    collapseSearch();
    router.push(path);
  };

  return (
    <div className="w-64 shrink-0 h-screen fixed top-0 left-0 bg-white shadow-md border-r border-gray-200 z-30">
      <div className="p-6 h-full overflow-y-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold italic mb-6 text-indigo-600">
            Social Network
          </h1>
        </div>
        <div className="space-y-4">
          <a
            href="#"
            onClick={(e) => handleLinkClick(e, "/")}
            className={`flex items-center p-2 text-gray-800 hover:bg-gray-100 rounded-lg transition-colors ${
              pathname === "/" && !isSearchExpanded
                ? "bg-gray-100 font-medium"
                : ""
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-3"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            Home
          </a>

          <a
            href="#"
            onClick={handleSearchClick}
            className={`flex items-center p-2 text-gray-800 hover:bg-gray-100 rounded-lg transition-colors ${
              isSearchExpanded ? "bg-gray-100 font-medium" : ""
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-3"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clipRule="evenodd"
              />
            </svg>
            Search
          </a>

          <a
            href="#"
            onClick={(e) => handleLinkClick(e, "/explore")}
            className={`flex items-center p-2 text-gray-800 hover:bg-gray-100 rounded-lg transition-colors ${
              pathname === "/explore" && !isSearchExpanded
                ? "bg-gray-100 font-medium"
                : ""
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-3"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z"
                clipRule="evenodd"
              />
            </svg>
            Explore
          </a>

          <a
            href="#"
            onClick={(e) => handleLinkClick(e, "/chats")}
            className={`flex items-center p-2 text-gray-800 hover:bg-gray-100 rounded-lg transition-colors relative ${
              pathname === "/chats" && !isSearchExpanded
                ? "bg-gray-100 font-medium"
                : ""
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-3"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
              <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
            </svg>
            Messages
          </a>

          <a
            href="#"
            onClick={(e) => handleLinkClick(e, "/profile")}
            className={`flex items-center p-2 text-gray-800 hover:bg-gray-100 rounded-lg transition-colors ${
              pathname === "/profile" && !isSearchExpanded
                ? "bg-gray-100 font-medium"
                : ""
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-3"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                clipRule="evenodd"
              />
            </svg>
            Profile
          </a>

          <a
            href="#"
            onClick={(e) => handleLinkClick(e, "/posts")}
            className={`flex items-center p-2 text-gray-800 hover:bg-gray-100 rounded-lg transition-colors ${
              pathname === "/posts" && !isSearchExpanded
                ? "bg-gray-100 font-medium"
                : ""
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-3"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" />
            </svg>
            Create
          </a>

          <a
            href="#"
            onClick={(e) => handleLinkClick(e, "/dashboard")}
            className={`flex items-center p-2 text-gray-800 hover:bg-gray-100 rounded-lg transition-colors ${
              pathname === "/dashboard" && !isSearchExpanded
                ? "bg-gray-100 font-medium"
                : ""
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-3"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
            </svg>
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
