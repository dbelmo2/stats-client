import { useState } from "react";
import { config } from "../../game/utils/config";

const VOTER_TOKEN_KEY = "contest:voter-token";
const ANON_TOKEN_COOKIE_NAME = "anon_token";

// Mirrors the same value into a cookie, purely so the backend can read it during the OAuth
// redirect navigation (a top-level browser navigation to our own API domain, which carries
// cookies automatically — unlike localStorage, which never leaves the browser). SameSite=Lax is
// enough here since this cookie only needs to survive that redirect, not cross-origin fetch()
// calls — the existing request-body-token flow is unchanged for everything else. Secure is only
// set when a real cookie domain is configured (i.e. not local http dev), since Secure cookies
// are silently dropped over plain HTTP.
function mirrorTokenCookie(token: string): void {
  const domainAttr = config.COOKIE_DOMAIN ? `; domain=${config.COOKIE_DOMAIN}` : "";
  const secureAttr = config.COOKIE_DOMAIN ? "; secure" : "";
  document.cookie = `${ANON_TOKEN_COOKIE_NAME}=${token}; path=/; samesite=lax${domainAttr}${secureAttr}`;
}

export function useUserToken(): string {
  const [token] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(VOTER_TOKEN_KEY);
      const value = stored || crypto.randomUUID();
      if (!stored) {
        localStorage.setItem(VOTER_TOKEN_KEY, value);
      }
      mirrorTokenCookie(value);
      return value;
    } catch {
      const fresh = crypto.randomUUID();
      mirrorTokenCookie(fresh);
      return fresh;
    }
  });
  return token;
}
