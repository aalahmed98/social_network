'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { FaHome, FaSyncAlt, FaBug } from 'react-icons/fa';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  // Determine error type based on error message or properties
  const getErrorInfo = () => {
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return {
        title: 'Network Error',
        description: 'Unable to connect to the server. Please check your internet connection.',
        icon: '🌐',
      };
    }
    
    if (error.message.includes('unauthorized') || error.message.includes('401')) {
      return {
        title: 'Unauthorized Access',
        description: 'You don\'t have permission to access this resource. Please log in again.',
        icon: '🔒',
      };
    }

    if (error.message.includes('forbidden') || error.message.includes('403')) {
      return {
        title: 'Access Forbidden',
        description: 'You don\'t have the necessary permissions to view this content.',
        icon: '⛔',
      };
    }

    // Default server error
    return {
      title: 'Something Went Wrong',
      description: 'An unexpected error occurred. Our team has been notified.',
      icon: '💥',
    };
  };

  const errorInfo = getErrorInfo();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Error Icon */}
        <div className="mb-8">
          <div className="text-8xl mb-4">{errorInfo.icon}</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {errorInfo.title}
          </h1>
        </div>

        {/* Error Description */}
        <div className="mb-8">
          <p className="text-gray-600 mb-4">
            {errorInfo.description}
          </p>
          
          {/* Error Details (in development) */}
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4 p-4 bg-red-50 rounded-lg text-left">
              <summary className="cursor-pointer text-red-700 font-medium">
                Technical Details
              </summary>
              <pre className="mt-2 text-xs text-red-600 overflow-auto">
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
            className="inline-flex items-center justify-center w-full px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            <FaSyncAlt className="mr-2" />
            Try Again
          </button>
          
          <Link
            href="/"
            className="inline-flex items-center justify-center w-full px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            <FaHome className="mr-2" />
            Go Home
          </Link>
        </div>

        {/* Report Bug */}
        <div className="mt-8">
          <button className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
            <FaBug className="mr-1" />
            Report this issue
          </button>
        </div>
      </div>
    </div>
  );
} 