import type { AuthMeResponse } from "./authClient";

const GUEST_NAME_KEY = "guest:display-name";

function generateGuestName(): string {
  const randomSequence = Math.floor(100000 + Math.random() * 900000);
  return `FupaTroopa#${randomSequence}`;
}

export function getOrCreateGuestName(): string {
  try {
    const stored = localStorage.getItem(GUEST_NAME_KEY);
    if (stored) return stored;
    const fresh = generateGuestName();
    localStorage.setItem(GUEST_NAME_KEY, fresh);
    return fresh;
  } catch {
    return generateGuestName();
  }
}

export function resolveDisplayName(auth: AuthMeResponse): string {
  return auth.authenticated && auth.username ? auth.username : getOrCreateGuestName();
}

// Matches java.lang.String#hashCode()'s specified algorithm exactly (JLS-guaranteed stable),
// so the same guest token always hashes to the same number here as it does server-side.
function javaStringHashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return hash;
}

function floorMod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

// Used by the lateness-prediction vote feature specifically: the backend never trusts (or even
// reads) a client-supplied name for that feature, deriving it instead from the caller's resolved
// identity (see LatenessPredictionController#resolveUserName) — a logged-in user's real
// "username#discriminator", or, for guests, a "FupaTroopa#<digits>" name hashed from their guest
// token. This mirrors that exact derivation so the pre-submit "Voting As" preview matches what
// actually gets stored, without a round trip.
export function resolveVoteDisplayName(auth: AuthMeResponse, guestToken: string): string {
  if (auth.authenticated && auth.username && auth.discriminator) {
    return `${auth.username}#${auth.discriminator}`;
  }
  return `FupaTroopa#${floorMod(javaStringHashCode(guestToken), 900_000) + 100_000}`;
}
