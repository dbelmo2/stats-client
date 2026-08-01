import { useState } from "react";

const VOTER_TOKEN_KEY = "contest:voter-token";

export function useUserToken(): string {
  const [token] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(VOTER_TOKEN_KEY);
      if (stored) return stored;
      const fresh = crypto.randomUUID();
      localStorage.setItem(VOTER_TOKEN_KEY, fresh);
      return fresh;
    } catch {
      return crypto.randomUUID();
    }
  });
  return token;
}
