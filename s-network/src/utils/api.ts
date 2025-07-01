import { logger } from "./logger";

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status: number;
  success: boolean;
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  timeout?: number;
}

class ApiClient {
  private baseUrl: string;
  private defaultTimeout: number = 10000; // 10 seconds

  constructor() {
    this.baseUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
  }

  private async request<T>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const startTime = Date.now();
    const url = `${this.baseUrl}${endpoint}`;

    const {
      method = "GET",
      body,
      headers = {},
      credentials = "include",
      timeout = this.defaultTimeout,
    } = options;

    // Default headers
    const defaultHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };

    // Remove Content-Type for FormData
    if (body instanceof FormData) {
      delete defaultHeaders["Content-Type"];
    }

    const config: RequestInit = {
      method,
      headers: defaultHeaders,
      credentials,
      body: body instanceof FormData ? body : JSON.stringify(body),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      logger.debug(`API Request: ${method} ${endpoint}`, {
        component: "ApiClient",
        action: "request",
      });

      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      logger.performance(`API ${method} ${endpoint}`, duration, {
        component: "ApiClient",
      });

      let data: T | undefined;
      const contentType = response.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
        try {
          data = await response.json();
        } catch (parseError) {
          logger.error(
            "Failed to parse JSON response",
            {
              component: "ApiClient",
              action: "parseResponse",
              metadata: { endpoint, status: response.status },
            },
            parseError
          );
        }
      }

      const apiResponse: ApiResponse<T> = {
        data,
        status: response.status,
        success: response.ok,
      };

      if (!response.ok) {
        const errorMessage =
          (data as { error?: string })?.error ||
          `Request failed with status ${response.status}`;
        apiResponse.error = errorMessage;

        logger.error(`API Error: ${method} ${endpoint}`, {
          component: "ApiClient",
          action: "request",
          metadata: {
            status: response.status,
            endpoint,
            error: errorMessage,
          },
        });
      }

      return apiResponse;
    } catch (error) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          logger.warn(`API Timeout: ${method} ${endpoint}`, {
            component: "ApiClient",
            action: "timeout",
            metadata: { timeout, duration },
          });
          return {
            error: "Request timeout",
            status: 408,
            success: false,
          };
        }

        logger.error(
          `API Network Error: ${method} ${endpoint}`,
          {
            component: "ApiClient",
            action: "networkError",
            metadata: { duration },
          },
          error
        );

        return {
          error: error.message || "Network error occurred",
          status: 0,
          success: false,
        };
      }

      logger.error(
        `API Unknown Error: ${method} ${endpoint}`,
        {
          component: "ApiClient",
          action: "unknownError",
        },
        error
      );

      return {
        error: "An unknown error occurred",
        status: 0,
        success: false,
      };
    }
  }

  // Convenience methods
  async get<T>(
    endpoint: string,
    options?: Omit<ApiRequestOptions, "method">
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  async post<T>(
    endpoint: string,
    data?: unknown,
    options?: Omit<ApiRequestOptions, "method" | "body">
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: data,
    });
  }

  async put<T>(
    endpoint: string,
    data?: unknown,
    options?: Omit<ApiRequestOptions, "method" | "body">
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "PUT", body: data });
  }

  async patch<T>(
    endpoint: string,
    data?: unknown,
    options?: Omit<ApiRequestOptions, "method" | "body">
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data,
    });
  }

  async delete<T>(
    endpoint: string,
    options?: Omit<ApiRequestOptions, "method">
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }

  // File upload utility
  async uploadFile<T>(
    endpoint: string,
    file: File,
    additionalData?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append("file", file);

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    return this.request<T>(endpoint, {
      method: "POST",
      body: formData,
    });
  }
}

// Export singleton instance
export const api = new ApiClient();
