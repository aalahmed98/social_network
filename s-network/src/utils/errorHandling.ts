// Error types and utilities for handling different HTTP status codes

export interface APIError extends Error {
  status?: number;
  statusText?: string;
  url?: string;
}

export class HTTPError extends Error implements APIError {
  status: number;
  statusText: string;
  url: string;

  constructor(
    status: number,
    statusText: string,
    url: string,
    message?: string
  ) {
    super(message || `HTTP ${status}: ${statusText}`);
    this.name = "HTTPError";
    this.status = status;
    this.statusText = statusText;
    this.url = url;
  }
}

// Create HTTP error from fetch response
export const createHTTPError = async (
  response: Response
): Promise<HTTPError> => {
  let message = `HTTP ${response.status}: ${response.statusText}`;

  try {
    const errorData = await response.json();
    if (errorData.error) {
      message = errorData.error;
    } else if (errorData.message) {
      message = errorData.message;
    }
  } catch {
    // If response is not JSON, use default message
  }

  return new HTTPError(
    response.status,
    response.statusText,
    response.url,
    message
  );
};

// Enhanced fetch wrapper with error handling
export const fetchWithErrorHandling = async (
  url: string,
  options?: RequestInit
): Promise<Response> => {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      throw await createHTTPError(response);
    }

    return response;
  } catch (error) {
    if (error instanceof HTTPError) {
      throw error;
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error("Network error. Please check your internet connection.");
    }

    throw error;
  }
};

// Get user-friendly error message based on status code
export const getErrorMessage = (error: APIError): string => {
  if (!error.status) {
    return error.message || "An unexpected error occurred";
  }

  switch (error.status) {
    case 400:
      return "Bad request. Please check your input and try again.";
    case 401:
      return "You need to log in to access this resource.";
    case 403:
      return "You don't have permission to access this resource.";
    case 404:
      return "The requested resource was not found.";
    case 409:
      return "There was a conflict with your request. Please try again.";
    case 422:
      return "Invalid data provided. Please check your input.";
    case 429:
      return "Too many requests. Please wait a moment and try again.";
    case 500:
      return "Internal server error. Please try again later.";
    case 502:
      return "Bad gateway. The server is temporarily unavailable.";
    case 503:
      return "Service unavailable. Please try again later.";
    case 504:
      return "Gateway timeout. The request took too long to process.";
    default:
      return error.message || `An error occurred (${error.status})`;
  }
};

// Check if error should redirect to login
export const shouldRedirectToLogin = (error: APIError): boolean => {
  return error.status === 401;
};

// Check if error is a server error (5xx)
export const isServerError = (error: APIError): boolean => {
  return error.status ? error.status >= 500 : false;
};

// Check if error is a client error (4xx)
export const isClientError = (error: APIError): boolean => {
  return error.status ? error.status >= 400 && error.status < 500 : false;
};

// Log error with additional context
export const logError = (error: Error, context?: Record<string, unknown>) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    userAgent:
      typeof window !== "undefined" ? window.navigator.userAgent : undefined,
    url: typeof window !== "undefined" ? window.location.href : undefined,
    ...context,
  };

  console.error("Application Error:", errorInfo);

  // In production, you would send this to an error tracking service
  // like Sentry, LogRocket, or similar
  if (process.env.NODE_ENV === "production") {
    // Example: sendToErrorTrackingService(errorInfo);
  }
};
