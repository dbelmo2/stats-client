import { QueryClient, type QueryFunction } from "@tanstack/react-query";
import { config } from "../../game/utils/config";
import { getCsrfTokenFromCookie } from "../../../shared/authClient";

// Get the base API URL from environment variables
const API_BASE_URL = config.API_URL;

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Construct full URL by combining base URL with the endpoint
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  if (method !== "GET") {
    const csrfToken = getCsrfTokenFromCookie();
    if (csrfToken) headers["X-XSRF-TOKEN"] = csrfToken;
  }

  const res = await fetch(fullUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    // Session cookie must be sent/received for logged-in request attribution to work.
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Construct the full URL by combining base URL with query key path
    const endpoint = queryKey.join("/");
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

    const res = await fetch(fullUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
