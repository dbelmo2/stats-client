import type { InputVector, PositionVector } from "../components/game/systems/Vector";



export interface PlayerServerState {
  id: string;
  sessionId: string;
  position: PositionVector;
  hp: number;
  isBystander: boolean;
  name: string;
  tick: number;
  vx: number;
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
    vector: InputVector;
}

export interface StatePayload {
    tick: number;
    position: PositionVector;
}

export interface NetworkState {
  latestServerSnapshot: ServerStateUpdate;
  latestServerSnapshotProcessed: ServerStateUpdate;
  enemyLastKnownStates: Map<string, { position: PositionVector; hp: number; isBystander: boolean; name: string }>;
  inputBuffer: InputPayload[];
  stateBuffer: StatePayload[];
}