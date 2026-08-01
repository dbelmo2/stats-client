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
