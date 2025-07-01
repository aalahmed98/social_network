"use client";

import { useEffect } from "react";
// Link import removed as it's not used
import { FaHome, FaSyncAlt, FaExclamationTriangle } from "react-icons/fa";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global application error:", error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-black flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            {/* Critical Error Icon */}
            <div className="mb-8">
              <FaExclamationTriangle className="text-8xl text-red-400 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-white mb-2">
                Critical Error
              </h1>
            </div>

            {/* Error Description */}
            <div className="mb-8">
              <p className="text-gray-300 mb-4">
                A critical error occurred that prevented the application from
                loading properly. This is usually a temporary issue.
              </p>

              {/* Error Details (in development) */}
              {process.env.NODE_ENV === "development" && (
                <details className="mt-4 p-4 bg-red-900/30 rounded-lg text-left border border-red-700">
                  <summary className="cursor-pointer text-red-300 font-medium">
                    Technical Details
                  </summary>
                  <pre className="mt-2 text-xs text-red-200 overflow-auto max-h-32">
                    {error.message}
                  </pre>
                  {error.digest && (
                    <p className="mt-2 text-xs text-gray-400">
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
                Reload Application
              </button>

              <button
                onClick={() => (window.location.href = "/")}
                className="inline-flex items-center justify-center w-full px-6 py-3 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors"
              >
                <FaHome className="mr-2" />
                Go to Homepage
              </button>
            </div>

            {/* Help Text */}
            <div className="mt-8 text-sm text-gray-400">
              <p>If this issue persists, please contact our support team.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
