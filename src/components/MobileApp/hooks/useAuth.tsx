import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as authClient from "../../../shared/authClient";
import type { AuthMeResponse } from "../../../shared/authClient";
import { resolveDisplayName } from "../../../shared/identity";
import { useUserToken } from "./useVoterToken";
import { toast } from "./use-toast";

interface AuthContextValue extends AuthMeResponse {
  displayName: string;
  isLoading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const LOGGED_OUT: AuthMeResponse = {
  authenticated: false,
  userId: null,
  username: null,
  discriminator: null,
  email: null,
  avatarUrl: null,
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthMeResponse>(LOGGED_OUT);
  const [isLoading, setIsLoading] = useState(true);
  // Called for its side effect: ensures the anonymous token exists in localStorage and is
  // mirrored into the anon_token cookie the backend reads during OAuth login (see
  // useVoterToken.ts) — claiming itself now happens automatically server-side, no longer
  // triggered from here.
  useUserToken();

  const refresh = async () => {
    try {
      setAuthState(await authClient.getAuthMe());
    } catch {
      setAuthState(LOGGED_OUT);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  // One-time post-redirect signals from SecurityConfig's OAuth2 success/failure handlers — both
  // land back here as a query param rather than an API response the frontend could read directly,
  // since the whole point of claim-on-registration is that it happens inside the OAuth redirect
  // itself, with no separate call this frontend is party to.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let changed = false;

    if (params.get("linked") === "true") {
      toast({
        title: "Account history linked",
        description: "Your previous activity was linked to your account.",
      });
      params.delete("linked");
      changed = true;
    }

    if (params.get("loginError") === "true") {
      toast({
        title: "Login failed",
        variant: "destructive",
      });
      params.delete("loginError");
      changed = true;
    }

    if (!changed) return;
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
    window.history.replaceState(null, "", newUrl);
  }, []);

  const logout = async () => {
    await authClient.logout();
    await refresh();
  };

  const value: AuthContextValue = {
    ...authState,
    displayName: resolveDisplayName(authState),
    isLoading,
    refresh,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
