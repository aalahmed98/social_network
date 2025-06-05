'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { FaHome, FaSyncAlt, FaTachometerAlt } from 'react-icons/fa';

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Dashboard Error Icon */}
        <div className="mb-8">
          <FaTachometerAlt className="text-8xl text-blue-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Dashboard Error
          </h1>
        </div>

        {/* Error Description */}
        <div className="mb-8">
          <p className="text-gray-600 mb-4">
            We encountered an issue loading your dashboard. This could be due to 
            a temporary connection problem or data loading issue.
          </p>
          
          {/* Error Details (in development) */}
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4 p-4 bg-blue-50 rounded-lg text-left border border-blue-200">
              <summary className="cursor-pointer text-blue-700 font-medium">
                Technical Details
              </summary>
              <pre className="mt-2 text-xs text-blue-600 overflow-auto max-h-32">
                {error.message}
              </pre>
              {error.digest && (
                <p className="mt-2 text-xs text-gray-500">
                  Error ID: {error.digest}
                </p>
              )}
            </details>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FaSyncAlt className="mr-2" />
            Reload Dashboard
          </button>
          
          <Link
            href="/"
            className="inline-flex items-center justify-center w-full px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            <FaHome className="mr-2" />
            Go to Feed
          </Link>
        </div>

        {/* Help Text */}
        <div className="mt-8 text-sm text-gray-500">
          <p>
            If this problem persists, try refreshing the page or 
            <Link href="/profile" className="text-blue-600 hover:underline ml-1">
              visit your profile
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
} 