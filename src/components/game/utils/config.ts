interface Config {
    GAME_SERVER_URL: string;
    API_URL: string;
    PVP_ON: boolean;
    YOUTUBE_API_URL: string;
    // Mirrors the backend's SESSION_COOKIE_DOMAIN — must match so the anon-token cookie is
    // visible to the API's domain during the OAuth redirect. Blank for local dev (localhost).
    COOKIE_DOMAIN: string;
}


export const config: Config = {
    GAME_SERVER_URL: import.meta.env.VITE_GAME_SERVER_URL || "http://localhost:3001",
    API_URL: import.meta.env.VITE_API_URL || import.meta.env.VITE_YOUTUBE_API_URL || "http://localhost:3000",
    PVP_ON: import.meta.env.VITE_PVP_ON === "true" || false,
    YOUTUBE_API_URL: import.meta.env.VITE_YOUTUBE_API_URL || "http://localhost:3000",
    COOKIE_DOMAIN: import.meta.env.VITE_COOKIE_DOMAIN || ""
};

