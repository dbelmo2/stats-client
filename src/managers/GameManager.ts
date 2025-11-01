import { Application, Container } from 'pixi.js';
import { config } from '../utils/config';
import { Player } from '../components/game/Player';
import { Controller } from '../systems/Controller';
import { NetworkManager } from './NetworkManager';
import { EnemyPlayer } from '../components/game/EnemyPlayer';
import { Projectile } from '../components/game/Projectile';
import { EnemyProjectile } from '../components/game/EnemyProjectile';
import { ErrorHandler, ErrorType } from '../utils/ErrorHandler';

import { testForAABB } from '../systems/Collision';
import { ScoreDisplay } from '../components/ui/ScoreDisplay';
import { GameOverDisplay } from '../components/ui/GameOverDisplay';
import { AmmoBush } from '../components/game/AmmoBush';
import { KillIndicator } from '../components/ui/KillIndicator';
import { PingDisplay } from '../components/ui/PingDisplay';
import { FPSDisplay } from '../components/ui/FPSDisplay';
import { Vector2 } from '../systems/Vector';

import { AudioManager } from './AudioManager';
import { DevModeManager } from './DevModeManager';
import { TvManager } from './TvManager';
import { BugReportManager } from './BugReportManager';
import { loginScreen } from '../components/ui/LoginScreen';
import { SettingsManager } from './SettingsManager';
import type { InputPayload, NetworkState, PlayerScore, PlayerServerState, ProjectileServerState, ServerStateUpdate } from '../types/network.types';
import type { GameState, PlayerData, WorldObjects } from '../types/game.types';
import { SceneManager } from './SceneManager';
import { CameraManager } from './CameraManager';


// Fix issue where after the match ends, and then begins again, an enemy ( and maybe self) 
// can start with low health. Once they take damage, the health bar updates to the correct value.
// There seems to be an issue with projectiles stopping and then resuming after match ends and restarts
// (serverside related)




// Look into drastric frame drop... occured when we tested laptop and desktop together in a game,
// with dev tools open on both. From mac i can see dev tools took up to 3gb memory. could this be the cause?
// both the desktop and laptop expereiced frame drops, with the laptop doing so first.


// Another issue noticed is that sometimes the ping keeps climbing...
// In one test, it started at around 300ms and climbed all the way up to 25,000 after which the
// connection was lost and the ping was then reset.

// TODO: refactor code to not use new Vector in every tick. 
interface EntityContainers {
  enemies: Map<string, EnemyPlayer>;
  enemyProjectiles: Map<string, EnemyProjectile>;
  killIndicators: KillIndicator[];
}
interface UIElements {
  gameOverDisplay: GameOverDisplay | null;
  pingDisplay: PingDisplay;
  fpsDisplay: FPSDisplay;
  scoreDisplay: ScoreDisplay;
  pingUpdateCounter: number;
  overlayActive: boolean;
}


// TODO: Implement death prediction for enemies (and self) on client (with server confirmation)??
// TODO: Add powerups???
// Ideas:
//  Fat Love:
// - Defense (fat love eats all projectiles)
// - offense (fat love shoots every projectile he ate in the direction of the mouse)


export class GameManager {
    private readonly GAME_WIDTH = 1920; 
    private readonly GAME_HEIGHT = 1080;
    private readonly SERVER_TICK_RATE = 30;
    private readonly MIN_MS_BETWEEN_TICKS = 1000 / this.SERVER_TICK_RATE; 
    private readonly MIN_S_BETWEEN_TICKS = this.MIN_MS_BETWEEN_TICKS / 1000; 
    private readonly BUFFER_SIZE = 1024;
    private readonly COLLISION_TIMEOUT = 2000; 
    private readonly GAME_BOUNDS = {
        left: 0,
        right: this.GAME_WIDTH,
        top: 0,
        bottom: this.GAME_HEIGHT
    };

    private app: Application;

    private cameraManager: CameraManager = CameraManager.getInstance();
    private devManager: DevModeManager = DevModeManager.getInstance();
    private settingsManager: SettingsManager = SettingsManager.getInstance();
    private networkManager: NetworkManager = NetworkManager.getInstance();
    private bugReportManager: BugReportManager = BugReportManager.getInstance();
    private sceneManager: SceneManager = SceneManager.getInstance();
    private audioManager: AudioManager = AudioManager.getInstance();

    private controller: Controller;

    private gameContainer: Container;

    private player: PlayerData = {
        id: '',
        name: '',
        sprite: undefined,
        disableInput: false,
        projectiles: [],
    }

    private gameState: GameState = {
        phase: 'active',
        scores: new Map<string, number>(),
        localTick: 0,
        accumulator: 0,
        pendingCollisions: new Map(),
        destroyedProjectiles: new Map()
    }

    
    private network: NetworkState = {
        latestServerSnapshot: {
            players: [],
            projectiles: [],
            scores: [], 
            serverTick: 0
        },
        latestServerSnapshotProcessed: {
            players: [],
            projectiles: [],
            scores: [], 
            serverTick: 0
        },
        inputBuffer: [],
        stateBuffer: [],
        enemyLastKnownStates: new Map<string, { position: Vector2; hp: number, isBystander: boolean, name: string }>(),
    };

    private entities: EntityContainers = {
        enemies: new Map<string, EnemyPlayer>(),
        enemyProjectiles: new Map<string, EnemyProjectile>(),
        killIndicators: []
    };

    private world: WorldObjects = {
        platforms: [],
        ammoBush: undefined as unknown as AmmoBush, // Will be initialized in constructor
        backgroundAssets: {}
    };

    private ui: UIElements = {
        gameOverDisplay: null,
        pingDisplay: undefined as unknown as PingDisplay, // Will be initialized in constructor
        fpsDisplay: undefined as unknown as FPSDisplay,   // Will be initialized in constructor
        scoreDisplay: undefined as unknown as ScoreDisplay, // Will be initialized in constructor
        pingUpdateCounter: 0,
        overlayActive: false
    };
    
    constructor(app: Application) {
        this.app = app;
        this.app.renderer.resize(this.GAME_WIDTH, this.GAME_HEIGHT);
        this.controller = new Controller();
        this.gameContainer = new Container();
        this.ui.scoreDisplay = new ScoreDisplay();
    }

    
    
    public async initialize(): Promise<void> {
        const { name, region } = await loginScreen();
        this.player.name = name;


        this.world = this.sceneManager.initialize(
            this.app, 
            {
                GAME_WIDTH: this.GAME_WIDTH,
                GAME_HEIGHT: this.GAME_HEIGHT,
                GAME_BOUNDS: this.GAME_BOUNDS
            },
            this.gameContainer,
        );

        this.cameraManager.initialize(
            this.app,
            this.gameContainer, 
            this.GAME_WIDTH,
            this.GAME_HEIGHT,
            this.GAME_BOUNDS
        );

        this.devManager.initialize(this.app);
        this.audioManager.initialize();     

        this.settingsManager.onModalOpen(() => this.ui.overlayActive = true);
        this.settingsManager.onModalClose(() => this.ui.overlayActive = false);
        this.bugReportManager.onModalOpen(() => this.ui.overlayActive = true);
        this.bugReportManager.onModalClose(() => this.ui.overlayActive = false);

        this.setupControlListeners();
        this.setupGameLoop();

        await this.initializeNetworking(region);

        this.app.stage.addChild(this.cameraManager.getCamera());
        this.app.stage.addChild(this.ui.scoreDisplay);

        TvManager.getInstance().startTv();
    }

    private async initializeNetworking(region: string): Promise<void> {
        try {
            const networkManager = NetworkManager.getInstance();
            this.player.id = await networkManager.initialize({ 
                region, playerName: this.player.name, serverUrl: config.GAME_SERVER_URL 
            });

            networkManager.on('gameOver', this.handleGameOver);
            networkManager.on('disconnect', this.handleConnectionLost);
            networkManager.on('stateUpdate', (state: ServerStateUpdate) => {
                this.network.latestServerSnapshot = state;
            });

        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.NETWORK,
                { phase: 'setup' }
            );
            throw error;
        }
    }

    private setupControlListeners(): void {
        // Add tab key event listener for spectator mode toggle
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault(); // Prevent default tab behavior (focus switching)
                this.showScoreBoard();
            } else if (e.key === 'e' || e.key === 'E') {
                this.controller.resetMouse()
                if (this.player.sprite) {
                    this.world.ammoBush.handleAmmoBushInteraction(
                        this.player.sprite,
                        () => this.networkManager.emit('toggleBystander', true)
                    );
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault(); // Prevent default tab behavior (focus switching)
                this.hideScoreBoard();
            }
        });
    }

    private handleGameOver = (scores: PlayerScore[]) => {
        try {
            this.controller.resetMouse();
            this.gameState.phase = 'ended';
            this.gameState.pendingCollisions.clear();
            this.ui.gameOverDisplay = new GameOverDisplay(scores, this.player.id);
            this.app.stage.addChild(this.ui.gameOverDisplay);
            this.networkManager.once('matchReset', this.handleMatchReset);
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.GAME_STATE,
                { event: 'gameOver', scoresCount: scores?.length || 0 }
            );
        }
    }

    private handleMatchReset = () => {
        try {
            this.player.projectiles = [];
            this.entities.enemyProjectiles.clear();
            this.gameState.pendingCollisions.clear();
            this.gameState.destroyedProjectiles.clear();
            if (this.ui.gameOverDisplay) {
                this.app.stage.removeChild(this.ui.gameOverDisplay);
                this.ui.gameOverDisplay.destroy();
                this.ui.gameOverDisplay = null;
            }
            this.gameState.phase = 'active';
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.GAME_STATE,
                { event: 'matchReset' }
            );
        }
    }


    private handleConnectionLost = (reason: string, _region: string) => {
        if (reason === "io server disconnect") {
            this.cleanupSession();
        }
    }


    private integrateStateUpdate(): void {
        const { players, projectiles } = this.network.latestServerSnapshot;
        const selfData = players.find(player => player.id === this.player.id);
        this.integrateSelfUpdate(selfData);
        this.integrateProjectileUpdates(projectiles);
        this.integrateEnemyPlayers();
    }
    
    private checkForKills(scores: PlayerScore[]): void {
        for (const score of scores) {
            const previousKills = this.gameState.scores.get(score.playerId) || 0;
            
            if (score.kills > previousKills) {
                this.showKillIndicator(score.playerId);
            }
            
            this.gameState.scores.set(score.playerId, score.kills);
        }
    }

    private showKillIndicator(playerId: string): void {
        if (playerId === this.player.id && this.player.sprite) {
            // Player kill
            const indicator = new KillIndicator(this.player.sprite.x, this.player.sprite.y - 50);
            this.gameContainer.addChild(indicator);
            this.entities.killIndicators.push(indicator);
        } else {
            // Enemy kill
            const enemyGraphic = this.entities.enemies.get(playerId);
            if (enemyGraphic) {
                const indicator = new KillIndicator(enemyGraphic.x, enemyGraphic.y - 50);
                this.gameContainer.addChild(indicator);
                // TODO: this seems to grow indefinetly even when destroy is called on kill indicators...
                // consider using a pool of kill indicators that we can recycle instead of creating new ones each time
                this.entities.killIndicators.push(indicator);
            }
        }
    }
    
    private integrateProjectileUpdates(projectiles: ProjectileServerState[]): void {
        const activeProjectileIds = new Set(projectiles.map(p => p.id));
        this.cleanupProjectiles(activeProjectileIds);

        const { enemyProjectiles } = this.entities;
        const { destroyedProjectiles } = this.gameState;

        for (const projectile of projectiles) {
            if (projectile.ownerId === this.player.id) {
                // Mark own projectiles as acknowledged when they appear in server state
                const ownProjectile = this.player.projectiles.find(p => p.getId() === projectile.id);
                if (ownProjectile) {
                    ownProjectile.wasAcknowledged = true;
                }
            } else if (!enemyProjectiles.has(projectile.id) && !destroyedProjectiles.has(projectile.id)) {
                // Only create new projectile if it hasn't been destroyed locally
                const graphic = new EnemyProjectile(
                    projectile.id, 
                    projectile.ownerId, 
                    projectile.x, 
                    projectile.y, 
                    projectile.vx, 
                    projectile.vy,
                    { width: this.app.canvas.width, height: this.app.canvas.height }
                );
                this.gameContainer.addChild(graphic);
                enemyProjectiles.set(projectile.id, graphic);
            }
        }    
    }

    private cleanupProjectiles(activeIds: Set<string>): void {
        // Clean up enemy projectiles
        for (const [id, graphic] of this.entities.enemyProjectiles.entries()) {
            if (!activeIds.has(id)) {
                this.app.stage.removeChild(graphic);
                graphic.destroy();
                this.entities.enemyProjectiles.delete(id);
            }
        }

        // Clean up own projectiles only if they were in server state and now aren't
        for (let i = this.player.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.player.projectiles[i];
            const projectileId = projectile.getId();
            
            // Only clean up projectiles that were previously acknowledged by server
            if (projectile.wasAcknowledged && !activeIds.has(projectileId)) {
                this.app.stage.removeChild(projectile);
                projectile.destroy();
                this.player.projectiles.splice(i, 1);
            }
        }
    }


    private cleanupPendingCollisions(): void {
        const now = Date.now();
        const { pendingCollisions } = this.gameState;

        for (const [id, collision] of pendingCollisions.entries()) {
            if (now - collision.timestamp > this.COLLISION_TIMEOUT) {
                // Get the affected entity (self or enemy)
                if (this.player.sprite && id === this.player.id) {
                    this.player.sprite.revertPrediction();
                } else {
                    const graphic = this.entities.enemies.get(id);
                    if (graphic) {
                        graphic.revertPrediction();
                    }
                }
                this.gameState.pendingCollisions.delete(id);
            }
        }
    }

    // Add cleanup for destroyed projectile IDs
    private cleanupDestroyedProjectiles(): void {
        const MAX_AGE = 5000; // 5 seconds
        const now = Date.now();
        const { destroyedProjectiles } = this.gameState;
        for (const [id, timestamp] of destroyedProjectiles.entries()) {
            if (now - timestamp > MAX_AGE) {
                destroyedProjectiles.delete(id);
            }
        }
    }

    private cleanupSession = (): void => {
        try {
            this.networkManager.cleanup();
            ErrorHandler.getInstance().logWarning(
                'Socket connection closed, initiating cleanup',
                ErrorType.SOCKET,
                { playerId: this.player.id }
            );

            this.app.ticker.stop();

            for (let i = this.player.projectiles.length - 1; i >= 0; i--) {
                const projectile = this.player.projectiles[i];
                this.app.stage.removeChild(projectile);
                projectile.destroy();
            }
            this.player.projectiles = [];

            const { enemyProjectiles, enemies } = this.entities;

            for (const [_, projectile] of enemyProjectiles) {
                this.app.stage.removeChild(projectile);
                projectile.destroy();
            }
            enemyProjectiles.clear();

            // Clean up enemy players
            for (const [_, enemy] of enemies) {
                this.app.stage.removeChild(enemy);
                enemy.destroy();
            }
            enemies.clear();

            // Clean up self
            if (this.player.sprite) {
                this.app.stage.removeChild(this.player.sprite);
                this.player.sprite.destroy();
                this.player.sprite = undefined;
            }

            for (const platform of this.world.platforms) {
                this.app.stage.removeChild(platform);
                platform.destroy();
            }

            DevModeManager.getInstance().cleanup();
            
            // Clean up bug report manager
            BugReportManager.getInstance().cleanup();

            // Clean up kill indicators
            for (const indicator of this.entities.killIndicators) {
                this.gameContainer.removeChild(indicator);
                indicator.destroy();
            }
            this.entities.killIndicators = [];
            this.gameState.scores.clear();

            // Clean up the scene
            SceneManager.getInstance().cleanup();

            // Clear all remaining state
            this.gameState.pendingCollisions.clear();
            this.gameState.destroyedProjectiles.clear();

        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.GAME_STATE,
                { phase: 'cleanup', playerId: this.player.id }
            );
        }
    }

    private integrateEnemyPlayers(): void {
        const enemyPlayers = this.network.latestServerSnapshot.players.filter(player => player.id !== this.player.id);
        for (const enemyPlayer of enemyPlayers) {
            // TODO: Ensure all uses of enemeyPlayer.sessionId are changed from enemyPlayer.id
            if (
                this.entities.enemies.has(enemyPlayer.sessionId) === false
                && enemyPlayer.position
            ) {
                // Spawning a new enemy player
                // This doesn't trigger when match ends and player respawns immediately
                const graphic = new EnemyPlayer(enemyPlayer.sessionId, enemyPlayer.position.x, enemyPlayer.position.y, enemyPlayer?.isBystander, enemyPlayer.name);
                this.gameContainer.addChild(graphic);
                this.entities.enemies.set(enemyPlayer.sessionId, graphic);
            } else {
                const graphic = this.entities.enemies.get(enemyPlayer.sessionId);
                if (!graphic) continue;
                graphic.setIsBystander(enemyPlayer.isBystander);
                    
                // Only update health if we don't have a pending collision
                const pendingCollision = this.gameState.pendingCollisions.get(enemyPlayer.sessionId);
                if (!pendingCollision && enemyPlayer.hp !== undefined) {
                    graphic.setHealth(enemyPlayer.hp);
                
                    // If server health is lower or equal (NOTE: this will likely break if health regen is introduced),
                    // than our prediction, collision was confirmed
                    if (enemyPlayer.hp <= graphic.getPredictedHealth()) {
                        this.gameState.pendingCollisions.delete(enemyPlayer.sessionId);
                        graphic.setHealth(enemyPlayer.hp);
                    }
                }


                if (enemyPlayer.position) {
                    graphic?.syncPosition(enemyPlayer.position.x, enemyPlayer.position.y);
                }
            }
        }


        // Remove stale enemy players
        for (const [id, graphic] of this.entities.enemies.entries()) {
            if (!enemyPlayers.some(player => player.sessionId === id)) {
                this.app.stage.removeChild(graphic);
                graphic.destroy();
                this.entities.enemies.delete(id);
            }
        }
    }

    private integrateSelfUpdate(selfData: PlayerServerState | undefined): void {
        if (!selfData && this.player.sprite) {
            // Clean up the players sprite if no self data exists
            this.handlePlayerDeath();
            return;
        }
        if (!selfData) return;
        if (selfData && !this.player.sprite) {
            // Create new player sprite if it doesn't exist
            this.spawnPlayer(selfData);
        }
        if (!this.player.sprite) return;

        const bystanderStatus = selfData.isBystander ?? this.network.enemyLastKnownStates.get(this.player.id)?.isBystander ?? true;
        this.player.sprite.setIsBystander(bystanderStatus);
        if (this.player.sprite.getIsBystander() === false && selfData.isBystander ===  false) {
            // Only update health if we don't have a pending collision
            this.updatePlayerHealth(selfData);
        }
    }
    
    private handlePlayerDeath() {
        this.gameState.pendingCollisions.delete(this.player.id);
        if (this.player.sprite) {
            this.app.stage.removeChild(this.player.sprite);
            this.player.sprite.destroy();
        }
        this.player.sprite = undefined;
    }

    private spawnPlayer(data: PlayerServerState): void {

        if (data.tick === undefined || data.position === undefined) {
            console.warn('Invalid player data, cannot spawn');
            return;
        }

        if (this.player.sprite) {
            console.warn('Self already exists, cannot spawn again');
            return;
        }

        // Force immediate reconciliation without resimulation.
        // This is an attempt to fix the issue where the player appears to respawn
        // in the wrong location after dying. (likely they spawn correctly but resimulate old input)
        this.gameState.localTick = data.tick;
        this.network.stateBuffer = [];
        this.network.latestServerSnapshotProcessed = {
            players: [],
            projectiles: [],
            scores: [],
            serverTick: 0
        };



        this.player.sprite = new Player(
            data.position.x,
            data.position.y,
            this.GAME_BOUNDS,
            data.name,
        );
        

        const bystanderStatus = data.isBystander ?? this.network.enemyLastKnownStates.get(this.player.id)?.isBystander ?? true;
        this.player.sprite.setPlatforms(this.world.platforms);
        this.player.sprite.setIsBystander(bystanderStatus);
        this.player.sprite.setLastProcessedInputVector(new Vector2(0, 0));
        this.gameContainer.addChild(this.player.sprite);
    }

    private updatePlayerHealth(selfData: PlayerServerState): void {
        if (!this.player.sprite) return;
        
        const pendingCollision = this.gameState.pendingCollisions.get(this.player.id);
        if (!pendingCollision && selfData.hp !== undefined) {
            this.player.sprite.setHealth(selfData.hp);
            // If server health is lower or equal (NOTE: this will likely break if health regen is introduced),
            // than our prediction, collision was confirmed
            if (selfData.hp <= this.player.sprite.getPredictedHealth()) {
                this.gameState.pendingCollisions.delete(this.player.id);
                this.player.sprite.setHealth(selfData.hp);
            }
        }
    }

    // Note: The visual jittering we see when the player moves seems to be
    // caused by the game rendering slower or at the same rate as the game loop.
    // When the render rate is set higher than the game loop, the jittering is reduced.
    // For example, gameloop -> 60 FPS, render -> 120 FPS.
    // Adding a log after the accumulator loop for the player position shows
    // that high jitter corresponds to the player position not being updated...
    
    // Increasing the FPS of the game loop to 120 seems to help with this jittering.
    // as well as a high FPS of the renderer. Might need to play with these values
    // with the broadcast rate to the server in mind.
    private setupGameLoop(): void {
        try {
            this.app.ticker.maxFPS = 60;

            this.app.ticker.add((delta) => {
                try {
                    const elapsedMS = delta.elapsedMS;
                    const cappedFrameTime = Math.min(elapsedMS, 100); 

                    this.gameState.accumulator += cappedFrameTime;

                    while (this.gameState.accumulator >= this.MIN_MS_BETWEEN_TICKS) {
                        this.handleTick();
                        this.gameState.accumulator -= this.MIN_MS_BETWEEN_TICKS;
                        this.gameState.localTick += 1;
                    }

                    // Note: Pixijs calls render() at the end of the ticker loop, sod we don't
                    // need to decouple rendering from the accumulator logic.
                    this.render(elapsedMS);
                } catch (error) {
                    ErrorHandler.getInstance().handleCriticalError(
                        error as Error,
                        ErrorType.GAME_STATE,
                        { phase: 'game_loop', error: 'Critical error in game loop' }
                    );
                    
                    // Stop the game loop to prevent cascading errors
                    this.app.ticker.stop();
                }
            });
        } catch (error) {
            ErrorHandler.getInstance().handleCriticalError(
                error as Error,
                ErrorType.GAME_STATE,
                { phase: 'setup_game_loop', error: 'Failed to setup game loop' }
            );
            throw error; // Re-throw as this is critical for game functionality
        }
    }

    private handleReconciliation(): void {
        this.network.latestServerSnapshotProcessed = this.network.latestServerSnapshot;
        const selfData = this.network.latestServerSnapshotProcessed.players.find(player => player.id === this.player.id);
        if (!selfData  || !this.player.sprite) {
            console.warn('Invalid self data from server, cannot reconcile');
            return;
        }

        if (selfData.position === undefined || selfData.tick === undefined || selfData.vx === undefined || selfData.vy === undefined) {
            console.warn('Invalid self data from server, cannot reconcile');
            return;
        }


        // TODO: if selfdata is undefined, do we need to do resimulation? 

        const tick = selfData.tick;
        selfData.position = new Vector2(selfData.position.x, selfData.position.y);


        let serverStateBufferIndex = tick % this.BUFFER_SIZE;
        let clientPosition = this.network.stateBuffer[serverStateBufferIndex]?.position;

        if (tick >= this.gameState.localTick) {
            //console.warn(`Server tick ${tick} is ahead of client tick ${this.gameState.localTick}. Syncing client position.`);
            // Server has marched ahead of the client...
            // As a temporary fix, we will simply sync the clint position with the server position
            console.warn(`Server tick ${tick} is ahead of client tick ${this.gameState.localTick}. Syncing client position.`);
            this.player.sprite.syncPosition(selfData.position.x, selfData.position.y, selfData.vx, selfData.vy);
            this.network.stateBuffer[serverStateBufferIndex] = selfData;
            this.gameState.localTick = tick;
            return;
        }

        // Temp fix for bug where this is undefined :()
        if (!clientPosition){
            console.warn(`No client position found for buffer index ${serverStateBufferIndex} at tick ${tick}, cannot reconcile`);
            return;
        } 


        console.log('comparing server and client positions for reconciliation at tick', tick);
        console.log(`Server position: ${selfData.position.x}, ${selfData.position.y}, Client position: ${clientPosition.x}, ${clientPosition.y}`);

        const positionError = Vector2.subtract(selfData.position, clientPosition);

        if (positionError.len() > 0.0001) {
            console.warn(`Position error detected: ${positionError}`);
            console.warn(`Reconciling to server position at tick ${tick}`);
            console.log(`Server position: ${selfData.position.x}, ${selfData.position.y}, Client position: ${clientPosition.x}, ${clientPosition.y}`);
            //console.warn(`Server position at tick client tick ${selfData.tick}: ${selfData.position.x}, ${selfData.position.y}, Client position at local tick ${ this.network.stateBuffer[serverStateBufferIndex]?.tick}: ${clientPosition.x}, ${clientPosition.y}`);
            this.player.sprite.syncPosition(selfData.position.x, selfData.position.y, selfData.vx, selfData.vy);
            this.network.stateBuffer[serverStateBufferIndex].position = selfData.position;
            let tickToResimulate = tick + 1;
            while (tickToResimulate < this.gameState.localTick) {
                const bufferIndex = tickToResimulate % this.BUFFER_SIZE;
                const inputVector = this.network.inputBuffer[bufferIndex]?.vector;
                if (!inputVector) {
                    console.warn(`No input vector found for buffer index ${bufferIndex} at tick ${tickToResimulate}`);
                    tickToResimulate++;
                    continue; // No input to resimulate for this tick
                }

                this.player.sprite.update(this.network.inputBuffer[bufferIndex].vector, this.MIN_S_BETWEEN_TICKS, true);
                this.network.stateBuffer[bufferIndex].position = this.player.sprite.getPositionVector();
                tickToResimulate++;
            }
        }
    }


    private handleTick(): void {
        try {
            if (this.player.sprite) {
                if (this.network.latestServerSnapshot.serverTick > this.network.latestServerSnapshotProcessed.serverTick) {
                    this.handleReconciliation();
                }

                const playerInput = this.handlePlayerInput();


                // Update camera position and UI elements
                this.cameraManager.updateCameraPositionLERP(this.player);
                this.ui.scoreDisplay.fixPosition();
                DevModeManager.getInstance().fixPositions();

  

   
            }

            this.integrateStateUpdate();
            this.updateOwnProjectiles();
            this.updateEnemyProjectiles();
            this.cleanupDestroyedProjectiles(); 
            this.cleanupPendingCollisions();
            this.world.ammoBush.update(this.player.sprite);
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.GAME_STATE,
                {
                    phase: 'tick',
                    localTick: this.gameState.localTick,
                    hasPlayerSprite: !!this.player.sprite
                }
            );
            
            // Log error but don't break the game loop
            console.error('Error in handleTick:', error);
        }
    }

    private handlePlayerInput(): InputPayload | undefined {
        if (!this.player.sprite) return; // No player to control

        const controllerState = this.controller.getState();
        if (controllerState.mouse.justReleased && controllerState.mouse.xR !== undefined && controllerState.mouse.yR !== undefined) {
            const { x, y } = this.cameraManager.convertCameraToWorldCoordinates(
                controllerState.mouse.xR, 
                controllerState.mouse.yR,
            );
            controllerState.mouse.xR = x;
            controllerState.mouse.yR = y;
        }

        // Convert mouse coordinates (GameManager responsibility)

        const inputVector = Vector2.createFromControllerState(controllerState);


        if (this.player.disableInput || this.ui.overlayActive) {
            inputVector.x = 0; // Prevent input when overlay is active
            inputVector.y = 0; // Prevent input when overlay is active
            inputVector.mouse = undefined; // Prevent mouse input when overlay is active
        }

        this.player.disableInput = this.ui.overlayActive;
        this.controller.resetMouse();


        const inputPayload: InputPayload = {
            vector: inputVector,
            tick: this.gameState.localTick,
        }


        // TODO: Move state and input buffers to player class. 
        const bufferIndex = this.gameState.localTick % this.BUFFER_SIZE;
        this.controller.resetJump();

        this.network.inputBuffer[bufferIndex] = inputPayload;


        this.player.sprite.update(inputVector, this.MIN_S_BETWEEN_TICKS, false);
        const stateVector = this.player.sprite.getPositionVector();

        this.network.stateBuffer[bufferIndex] = {
            tick: this.gameState.localTick,
            position: stateVector
        };

        this.handleShooting(inputPayload);

        if (this.shouldBroadcastPlayerInput(inputVector)) this.broadcastPlayerInput(inputPayload);

        // Updating this before the line above (where we broadcast) causes reconciliation issues
        // where the client is always ahead of the server by 1-2 inputs.
        this.player.sprite.setLastProcessedInputVector(inputVector); 


        return inputPayload;
    }

    private shouldBroadcastPlayerInput(inputVector: Vector2): boolean {
        if (!this.player.sprite) return false;
        const lastProcessedInputVector = this.player.sprite.getLastProcessedInputVector();
        const justStoppedMoving = lastProcessedInputVector.x !== 0 || lastProcessedInputVector.y !== 0 // This is true when jump is pressed, but the player is not moving
            && inputVector.x === 0 && inputVector.y === 0;

        if (
            (
                this.player.sprite.y !== this.GAME_HEIGHT
                && this.player.sprite.getIsOnSurface() === false
            ) // If the player is in the air TODO: Change this to isAFk === false?
            || inputVector.x !== 0 // Has horizontal input
            || inputVector.y !== 0 // Has verical input
            || inputVector.mouse // Has mouse input
            || justStoppedMoving // Or was moving last input but stopped moving this input
        ) return true;

        return false;
    }

    // Any rendering logic not related to game objects. (FPS display, ping display, camera update, etc.)
    private render(deltaMs: number): void {
        //this.updateCameraPosition();

        this.checkForKills(this.network.latestServerSnapshot.scores);
        this.ui.scoreDisplay.updateScores(this.network.latestServerSnapshot.scores, this.player.id);
        this.updateDevDisplays(deltaMs);
    }

    private broadcastPlayerInput(inputPayload: InputPayload): void {
        console.log('Broadcasting player input:', inputPayload);
        this.networkManager.emit('playerInput', inputPayload);
    }


    private updateDevDisplays(deltaMS: number): void {
        const devManager = DevModeManager.getInstance();
        devManager.updateFPS();
        devManager.updatePing(deltaMS, this.networkManager.getPing());
    }

    private showScoreBoard(): void {
        this.ui.scoreDisplay.show();
    }

    private hideScoreBoard(): void {
        this.ui.scoreDisplay.hide();
    }
    
    private handleShooting(input: InputPayload): void {
        if (
            !this.player.sprite 
            || this.player.sprite.getIsBystander() 
            || this.gameState.phase !== 'active'
            || !input.vector.mouse
        ) return;

        const projectile = new Projectile(
            this.player.sprite.x,
            this.player.sprite.y - 50,
            input.vector.mouse.x,
            input.vector.mouse.y,
            { width: this.app.canvas.width, height: this.app.canvas.height },
            input?.vector?.mouse?.id,
        );

        AudioManager.getInstance().play('shoot');
        this.player.projectiles.push(projectile);
        this.gameContainer.addChild(projectile);    
    }

    private updateOwnProjectiles(): void {
        for (let i = this.player.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.player.projectiles[i];
            projectile.update();
            // Check for collisions with enemy players
            if (this.gameState.phase === 'active') {
                for (const [enemyId, enemyGraphic] of this.entities.enemies.entries()) {
                    if (enemyGraphic.getIsBystander() === false && testForAABB(projectile, enemyGraphic)) {
                        this.networkManager.emit('projectileHit', enemyId);
                        // Record collision prediction
                        // This is required so we can reject stateUpdates that likely haven't computed
                        // the collision yet due to network latency
                        this.gameState.pendingCollisions.set(enemyId, {
                            projectileId: projectile.getId(),
                            timestamp: Date.now()
                        });

                        AudioManager.getInstance().play('impact');

                        // Apply predicted damage (the server will confirm or correct this after a timeout)
                        enemyGraphic.damage();
                        
                        // Mark projectile for cleanup
                        projectile.shouldBeDestroyed = true;
                        break; // Exit collision check loop once hit is found
                    }
                }
            }


            if (projectile.shouldBeDestroyed) {
                this.player.projectiles.splice(i, 1);
                projectile.destroy();
            }

            
        }
    }

    private updateEnemyProjectiles(): void {
        for (const [projectileId, projectile] of this.entities.enemyProjectiles.entries()) {
            projectile.update();
            
            if (this.gameState.phase === 'active') {
                // Check collision with self first
                if (this.player.sprite && this.player.sprite.getIsBystander() === false && testForAABB(projectile, this.player.sprite)) {
                    // Add projectile to destroyed list
                    // to avoid respawning it on delayed stateUpdates
                    this.gameState.destroyedProjectiles.set(projectileId, Date.now());

                    // Record collision prediction
                    this.gameState.pendingCollisions.set(this.player.id, {
                        projectileId: projectileId,
                        timestamp: Date.now()
                    });

                    AudioManager.getInstance().play('impact');
                    // Apply predicted damage to self
                    this.player.sprite.damage();
                    
                    // Mark projectile for cleanup
                    projectile.shouldBeDestroyed = true;
                } else {
                    // Check collisions with other enemies
                    for (const [enemyId, enemyGraphic] of this.entities.enemies.entries()) {
                        if (
                            enemyId !== projectile.getOwnerId() 
                            && testForAABB(projectile, enemyGraphic)
                            && enemyGraphic.getIsBystander() === false
                        ) {
                            
                            this.gameState.destroyedProjectiles.set(projectileId, Date.now());
                            // Record collision prediction
                            this.gameState.pendingCollisions.set(enemyId, {
                                projectileId: projectileId,
                                timestamp: Date.now()
                            });


                            AudioManager.getInstance().play('impact');

                            // Apply predicted damage
                            enemyGraphic.damage();

                            // Mark projectile for cleanup
                            projectile.shouldBeDestroyed = true;
                            break;
                        }
                    }
                }
            }

            // Clean up destroyed projectiles
            if (projectile.shouldBeDestroyed) {
                this.app.stage.removeChild(projectile);
                projectile.destroy();
                this.entities.enemyProjectiles.delete(projectileId);
            }
        }
    }

}
