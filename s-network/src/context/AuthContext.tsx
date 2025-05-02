"use client";

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from "react";
import { usePathname } from "next/navigation";

interface AuthContextType {
  isLoggedIn: boolean;
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
  loading: boolean;
  logout: () => Promise<void>;
  authError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      try {
        setAuthError(null);
        // Use the backend API directly
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

        const response = await fetch(`${backendUrl}/api/auth/check`, {
          method: "GET",
          credentials: "include", // Include cookies in the request
          headers: {
            Accept: "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          setIsLoggedIn(data.authenticated === true);
          setRetryCount(0); // Reset retry count on success
        } else {
          console.warn(`Auth check failed with status: ${response.status}`);
          setIsLoggedIn(false);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        setIsLoggedIn(false);

        // Set error message based on the type of error
        if (
          error instanceof TypeError &&
          error.message.includes("Failed to fetch")
        ) {
          setAuthError(
            "Cannot connect to authentication server. Please ensure the backend is running."
          );

          // Implement retry logic with exponential backoff
          if (retryCount < 3) {
            const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
            console.log(`Retrying auth check in ${delay / 1000}s...`);

            setTimeout(() => {
              setRetryCount((prev) => prev + 1);
              checkAuth();
            }, delay);
          }
        } else {
          setAuthError("Authentication error. Please try again later.");
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [pathname, retryCount]);

  const logout = async () => {
    try {
      setAuthError(null);
      // Use the backend API directly
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

      await fetch(`${backendUrl}/api/logout`, {
        method: "POST",
        credentials: "include", // Include cookies in the request
        headers: {
          Accept: "application/json",
        },
      });

      setIsLoggedIn(false);
    } catch (error) {
      console.error("Error logging out:", error);
      setAuthError("Error logging out. Please try again.");
    }
  };

  return (
    <AuthContext.Provider
      value={{ isLoggedIn, setIsLoggedIn, loading, logout, authError }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
