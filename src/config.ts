interface Config {
    SERVER_URL: string;
    PVP_ON: boolean;
    YOUTUBE_API_HOST: string;
}

console.log(import.meta.env.SERVER_URL);

export const config: Config = {
    SERVER_URL: import.meta.env.VITE_SERVER_URL || "http://localhost:3001",
    PVP_ON: import.meta.env.VITE_PVP_ON === "true" || false,
    YOUTUBE_API_HOST: import.meta.env.VITE_YOUTUBE_API_HOST || "http://localhost:3000"
};

