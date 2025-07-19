interface Config {
    SERVER_URL: string;
    PVP_ON: boolean;
}

console.log(import.meta.env.SERVER_URL);

export const config: Config = {
    SERVER_URL: import.meta.env.VITE_SERVER_URL || "http://localhost:3000",
    PVP_ON: import.meta.env.VITE_PVP_ON === "true" || false
};

