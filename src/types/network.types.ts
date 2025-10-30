import type { Vector2 } from "../systems/Vector";

export interface PlayerServerState {
  id?: string;
  sessionIdb: string;
  vector?: {
    x: number;
    y: number;
  }
  position?: Vector2;
  hp?: number;
  isBystander?: boolean;
  name?: string;
  tick?: number;
  vx?: number;
  vy: number;
}

export interface ServerStateUpdate {
    players: PlayerServerState[];
    projectiles: ProjectileServerState[];
    scores: PlayerScore[];
    serverTick: number;
}

export interface ProjectileServerState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
};

export interface ServerStateUpdate {
    players: PlayerServerState[];
    projectiles: ProjectileServerState[];
    scores: PlayerScore[];
    serverTick: number;
};

export interface PlayerScore {
    playerId: string;
    kills: number;
    deaths: number;
    name: string;
}

export interface InputPayload {
    tick: number;
    vector: Vector2;
}

export interface StatePayload {
    tick: number;
    position: Vector2;
}

export interface NetworkState {
  latestServerSnapshot: ServerStateUpdate;
  latestServerSnapshotProcessed: ServerStateUpdate;
  enemyLastKnownStates: Map<string, { position: Vector2; hp: number; isBystander: boolean; name: string }>;
  inputBuffer: InputPayload[];
  stateBuffer: StatePayload[];
}