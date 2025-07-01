"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function ErrorNotification() {
  const { authError } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (authError) {
      setVisible(true);
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setVisible(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
    // Return undefined explicitly for other cases
    return undefined;
  }, [authError]);

  if (!authError || !visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md bg-red-50 text-red-800 px-6 py-4 rounded-lg shadow-lg border border-red-200 flex items-start">
      <div className="flex-shrink-0 mr-3 mt-0.5">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5 text-red-600"
        >
          <path
            fillRule="evenodd"
            d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <div className="flex-1">
        <p className="font-medium">{authError}</p>
        <p className="text-sm text-red-700 mt-1">
          Try refreshing the page or check your network connection.
        </p>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="flex-shrink-0 text-red-500 hover:text-red-700 ml-4"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5"
        >
          <path
            fillRule="evenodd"
            d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}
