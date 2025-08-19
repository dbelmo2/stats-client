import type { Platform } from "../components/game/Platform";
import type { Player } from "../components/game/Player";
import type { Projectile } from "../components/game/Projectile";
import type { AmmoBush } from "../components/game/AmmoBush";
import type { Sprite } from "pixi.js";

export interface PlayerData {
    id: string;
    name: string;
    sprite: Player | undefined;
    projectiles: Projectile[];
    disableInput: boolean;
}

export interface GameState {
    phase: GamePhase;
    scores: Map<string, number>;
    localTick: number;
    accumulator: number;
    pendingCollisions: Map<string, { projectileId: string, timestamp: number }>;
    destroyedProjectiles: Map<string, number>;
}

export interface WorldObjects {
    platforms: Platform[];
    ammoBush: AmmoBush;
    backgroundAssets: {
        j1?: Sprite | null;
        j2?: Sprite | null;
        j3?: Sprite | null;
        j4?: Sprite | null;
    };
}

export type GamePhase = 'waiting' | 'active' | 'ended';