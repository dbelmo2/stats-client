interface Config {
    GAME_SERVER_URL: string;
    API_URL?: string;
    PVP_ON: boolean;
    YOUTUBE_API_URL: string;
}

console.log(import.meta.env.GAME_SERVER_URL);

export const config: Config = {
    GAME_SERVER_URL: import.meta.env.VITE_GAME_SERVER_URL || "http://localhost:3001",
    PVP_ON: import.meta.env.VITE_PVP_ON === "true" || false,
    YOUTUBE_API_URL: import.meta.env.VITE_YOUTUBE_API_URL || "http://localhost:3000"
};

