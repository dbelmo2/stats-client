interface Config {
    SERVER_URL: string;
    PVP_ON: boolean;
}

console.log(import.meta.env.SERVER_URL);

export const config: Config = {
    SERVER_URL: import.meta.env.VITE_SERVER_URL || "https://game-server-dev.up.railway.app",
    PVP_ON: import.meta.env.VITE_PVP_ON === "true" || false
};

