import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
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
  const anonymousToken = useUserToken();
  const hasAttemptedClaimRef = useRef(false);

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

  useEffect(() => {
    if (!authState.authenticated || hasAttemptedClaimRef.current) return;
    hasAttemptedClaimRef.current = true;

    authClient
      .claimAnonymousToken(anonymousToken)
      .then((result) => {
        const totalClaimed = result.clipsClaimed + result.votesClaimed + result.reportsClaimed;
        if (totalClaimed === 0) return;
        toast({
          title: "Account history linked",
          description: `Linked ${result.clipsClaimed} clip(s), ${result.votesClaimed} vote(s), and ${result.reportsClaimed} report(s) to your account.`,
        });
      })
      .catch((err) => {
        if (err instanceof authClient.ClaimConflictError) {
          toast({
            title: "Couldn't link this device",
            description: "This device's history is already linked to a different account.",
            variant: "destructive",
          });
        }
      });
  }, [authState.authenticated, anonymousToken]);

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
