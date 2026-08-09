import { config } from "../components/game/utils/config";

export interface AuthMeResponse {
  authenticated: boolean;
  userId: number | null;
  username: string | null;
  discriminator: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export interface GameTokenResponse {
  token: string;
  expiresAt: string;
}

export type ReturnTarget = "dashboard" | "game";

// Data-driven so a second provider (e.g. Discord) is a new array entry, not a rewrite.
// `path` is a real backend route today; the label is the only YouTube-branded part of this.
export const OAUTH_PROVIDERS = [
  { id: "google", label: "Continue with YouTube", path: "/oauth2/authorization/google" },
] as const;

const RETURN_TO_KEY = "auth:return-to";

export function getCsrfTokenFromCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function getAuthMe(): Promise<AuthMeResponse> {
  const res = await fetch(`${config.API_URL}/api/auth/me`, { credentials: "include" });
  return res.json();
}

export async function getGameToken(): Promise<GameTokenResponse> {
  const res = await fetch(`${config.API_URL}/api/auth/game-token`, { credentials: "include" });
  if (!res.ok) throw new Error(`${res.status}: Failed to fetch game token`);
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch(`${config.API_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: {
      "X-XSRF-TOKEN": getCsrfTokenFromCookie() ?? "",
    },
  });
}

export function startOAuthLogin(providerId: string, returnTo: ReturnTarget): void {
  const provider = OAUTH_PROVIDERS.find((p) => p.id === providerId);
  if (!provider) {
    console.error(`[authClient] Unknown OAuth provider: ${providerId}`);
    return;
  }
  try {
    sessionStorage.setItem(RETURN_TO_KEY, returnTo);
  } catch {
    // ignore — worst case the post-login redirect fix in main.ts falls back to default boot logic
  }
  window.location.href = `${config.API_URL}${provider.path}`;
}

export function consumeReturnTarget(): ReturnTarget | null {
  try {
    const value = sessionStorage.getItem(RETURN_TO_KEY);
    if (value === "dashboard" || value === "game") {
      sessionStorage.removeItem(RETURN_TO_KEY);
      return value;
    }
    return null;
  } catch {
    return null;
  }
}
