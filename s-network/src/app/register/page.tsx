"use client";

import React, { useState, FormEvent, ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { validatePasswordStrength } from "@/utils/security";

export default function Register() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    dob: "",
    nickname: "",
    aboutMe: "",
    avatar: null as File | null,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState({
    isValid: false,
    score: 0,
    feedback: [] as string[],
  });
  const [showPasswordHelp, setShowPasswordHelp] = useState(false);
  const [nicknameStatus, setNicknameStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({
    checking: false,
    available: null,
    message: "",
  });

  const checkNicknameAvailability = async (nickname: string) => {
    if (!nickname || nickname.trim() === "") {
      setNicknameStatus({ checking: false, available: null, message: "" });
      return;
    }

    setNicknameStatus({ checking: true, available: null, message: "Checking availability..." });
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/auth/check-nickname?nickname=${encodeURIComponent(nickname)}`);
      
      if (response.ok) {
        const result = await response.json();
        setNicknameStatus({
          checking: false,
          available: result.available,
          message: result.available ? "Nickname is available!" : "Nickname is already taken",
        });
      } else {
        setNicknameStatus({
          checking: false,
          available: null,
          message: "Error checking nickname availability",
        });
      }
    } catch (error) {
      console.error("Error checking nickname:", error);
      setNicknameStatus({
        checking: false,
        available: null,
        message: "Error checking nickname availability",
      });
    }
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Validate password in real-time
    if (name === "password") {
      const validation = validatePasswordStrength(value);
      setPasswordValidation(validation);
    }

    // Check nickname availability in real-time
    if (name === "nickname") {
      // Debounce the nickname check
      const timeoutId = setTimeout(() => {
        checkNicknameAvailability(value);
      }, 500);

      // Clear previous timeout
      return () => clearTimeout(timeoutId);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFormData((prev) => ({ ...prev, avatar: e.target.files![0] }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validate required fields
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.email ||
      !formData.password ||
      !formData.dob
    ) {
      setError("Please fill in all required fields");
      setLoading(false);
      return;
    }

    // Validate password strength
    if (!passwordValidation.isValid) {
      setError(
        "Password does not meet security requirements. Please check the requirements below."
      );
      setLoading(false);
      return;
    }

    // Validate nickname availability
    if (formData.nickname && nicknameStatus.available === false) {
      setError("Please choose a different nickname. The current one is already taken.");
      setLoading(false);
      return;
    }

    try {
      // Create form data to handle file upload
      const data = new FormData();
      data.append("firstName", formData.firstName);
      data.append("lastName", formData.lastName);
      data.append("email", formData.email);
      data.append("password", formData.password);
      data.append("dob", formData.dob);

      if (formData.nickname) data.append("nickname", formData.nickname);
      if (formData.aboutMe) data.append("aboutMe", formData.aboutMe);
      if (formData.avatar) data.append("avatar", formData.avatar);

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/auth/register`, {
        method: "POST",
        body: data,
        credentials: "include",
      });

      let result;
      try {
        result = await response.json();
      } catch (e) {
        console.error("Failed to parse JSON response:", e);
        throw new Error("Invalid server response");
      }

      if (!response.ok) {
        // Handle different error types
        if (response.status === 409) { // Conflict - duplicate email or nickname
          throw new Error(result?.error || "Email or nickname already exists");
        }
        throw new Error(result?.error || "Registration failed");
      }

      // Navigate to login page on success
      router.push("/login?registered=true");
    } catch (err: any) {
      console.error("Registration error:", err);
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">
          Create an Account
        </h1>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="firstName"
                className="block text-sm font-medium text-gray-700"
              >
                First Name *
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label
                htmlFor="lastName"
                className="block text-sm font-medium text-gray-700"
              >
                Last Name *
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password *
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              onFocus={() => setShowPasswordHelp(true)}
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                formData.password
                  ? passwordValidation.isValid
                    ? "border-green-300"
                    : "border-red-300"
                  : "border-gray-300"
              }`}
              required
            />

            {/* Password strength indicator */}
            {formData.password && (
              <div className="mt-2">
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        passwordValidation.score <= 1
                          ? "bg-red-500 w-1/4"
                          : passwordValidation.score <= 2
                          ? "bg-yellow-500 w-2/4"
                          : passwordValidation.score <= 3
                          ? "bg-blue-500 w-3/4"
                          : "bg-green-500 w-full"
                      }`}
                    ></div>
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      passwordValidation.isValid
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {passwordValidation.isValid ? "Strong" : "Weak"}
                  </span>
                </div>
              </div>
            )}

            {/* Password requirements */}
            {(showPasswordHelp || formData.password) && (
              <div className="mt-3 p-3 bg-gray-50 rounded-md">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Password Requirements:
                </p>
                <ul className="text-xs space-y-1">
                  <li
                    className={`flex items-center ${
                      formData.password.length >= 8
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    <span className="mr-2">
                      {formData.password.length >= 8 ? "✓" : "✗"}
                    </span>
                    At least 8 characters long
                  </li>
                  <li
                    className={`flex items-center ${
                      /[A-Z]/.test(formData.password)
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    <span className="mr-2">
                      {/[A-Z]/.test(formData.password) ? "✓" : "✗"}
                    </span>
                    One uppercase letter (A-Z)
                  </li>
                  <li
                    className={`flex items-center ${
                      /[a-z]/.test(formData.password)
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    <span className="mr-2">
                      {/[a-z]/.test(formData.password) ? "✓" : "✗"}
                    </span>
                    One lowercase letter (a-z)
                  </li>
                  <li
                    className={`flex items-center ${
                      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(
                        formData.password
                      )
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    <span className="mr-2">
                      {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(
                        formData.password
                      )
                        ? "✓"
                        : "✗"}
                    </span>
                    One special character (!@#$%^&*)
                  </li>
                  <li
                    className={`flex items-center ${
                      !/\s/.test(formData.password) && formData.password
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    <span className="mr-2">
                      {!/\s/.test(formData.password) && formData.password
                        ? "✓"
                        : "✗"}
                    </span>
                    No spaces allowed
                  </li>
                </ul>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="dob"
              className="block text-sm font-medium text-gray-700"
            >
              Date of Birth *
            </label>
            <input
              type="date"
              id="dob"
              name="dob"
              value={formData.dob}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label
              htmlFor="nickname"
              className="block text-sm font-medium text-gray-700"
            >
              Nickname (Optional)
            </label>
            <div className="relative">
              <input
                type="text"
                id="nickname"
                name="nickname"
                value={formData.nickname}
                onChange={handleChange}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                  formData.nickname
                    ? nicknameStatus.available === true
                      ? "border-green-300"
                      : nicknameStatus.available === false
                      ? "border-red-300"
                      : "border-gray-300"
                    : "border-gray-300"
                }`}
              />
              {nicknameStatus.checking && (
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                </div>
              )}
            </div>
            {formData.nickname && nicknameStatus.message && (
              <p
                className={`mt-1 text-sm ${
                  nicknameStatus.available === true
                    ? "text-green-600"
                    : nicknameStatus.available === false
                    ? "text-red-600"
                    : "text-gray-600"
                }`}
              >
                {nicknameStatus.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="aboutMe"
              className="block text-sm font-medium text-gray-700"
            >
              About Me (Optional)
            </label>
            <textarea
              id="aboutMe"
              name="aboutMe"
              value={formData.aboutMe}
              onChange={handleChange}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label
              htmlFor="avatar"
              className="block text-sm font-medium text-gray-700"
            >
              Avatar (Optional)
            </label>
            <input
              type="file"
              id="avatar"
              name="avatar"
              onChange={handleFileChange}
              accept="image/*"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || !passwordValidation.isValid || (formData.nickname && nicknameStatus.available === false)}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                loading || !passwordValidation.isValid || (formData.nickname && nicknameStatus.available === false)
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700"
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
            >
              {loading ? "Registering..." : "Register"}
            </button>
          </div>
        </form>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
