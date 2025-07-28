import { Application, Container } from 'pixi.js';
import { config } from '../utils/config';
import { Player } from '../components/game/Player';
import { Controller } from '../systems/Controller';
import { SocketManager } from './SocketManager';
import { EnemyPlayer } from '../components/game/EnemyPlayer';
import { Projectile } from '../components/game/Projectile';
import { EnemyProjectile } from '../components/game/EnemyProjectile';

import { testForAABB } from '../systems/Collision';
import { ScoreDisplay } from '../components/ui/ScoreDisplay';
import { GameOverDisplay } from '../components/ui/GameOverDisplay';
import { AmmoBush } from '../components/game/AmmoBush';
import { KillIndicator } from '../components/ui/KillIndicator';
import { PingDisplay } from '../components/ui/PingDisplay';
import { FPSDisplay } from '../components/ui/FPSDisplay';
import { Vector2 } from '../systems/Vector';
import { ModalManager } from '../components/ui/Modal';

import h3Theme from '../sounds/h3-theme.mp3'
import shootingAudio from '../sounds/shoot-sound.wav';
import impactAudio from '../sounds/impact-sound.wav';
import jumpAudio from '../sounds/swipe-sound.mp3';
import walkingAudio from '../sounds/walking-grass-sound.flac'; 
import { AudioManager } from './AudioManager';
import { DevModeManager } from './DevModeManager';
import { TvManager } from './TvManager';
import { loginScreen } from '../components/ui/LoginScreen';
import type { SettingsManager } from './SettingsManager';
import type { InputPayload, NetworkState, PlayerScore, PlayerServerState, ProjectileServerState, ServerStateUpdate } from '../types/network.types';
import type { GameState, PlayerData, WorldObjects } from '../types/game.types';
import { SceneManager } from './SceneManager';


// Fix issue where after the match ends, and then begins again, an enemy ( and maybe self) 
// can start with low health. Once they take damage, the health bar updates to the correct value.
// There seems to be an issue with projectiles stopping and then resuming after match ends and restarts
// (serverside related)



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

interface CameraSettings {
  lerpFactor: number;
  currentX: number;
  currentY: number;
    // Add shake properties
    shakeIntensity: number;
    shakeDuration: number;
    shakeElapsed: number;
    baseX: number; // Store the non-shaken position
    baseY: number; // Store the non-shaken position
    }

// TODO: Implement death prediciton for enemies (and self) on client (with servber confirmation)??
// TODO: Add powerups???
// Ideas:
//  Fat Love:
// - Defense (fat love eats all projectiles)
// - offense (fat love shoots every projectile he ate in the direction of the mouse)


export class GameManager {
    private readonly GAME_WIDTH = 1920; 
    private readonly GAME_HEIGHT = 1080;
    private readonly SERVER_TICK_RATE = 60;
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

    private static instance: GameManager;

    private app: Application;
    private socketManager: SocketManager;
    private controller: Controller;

    private camera = new Container();
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
        stateBuffer: []
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
    
    private cameraSettings: CameraSettings = {
        lerpFactor: 0.1,
        currentX: 0,
        currentY: 0,
        shakeIntensity: 0,
        shakeDuration: 0,
        shakeElapsed: 0,
        baseX: 0,
        baseY: 0
    };

    private constructor(app: Application) {
        this.controller = new Controller();

        this.socketManager = new SocketManager(config.GAME_SERVER_URL);

        this.app = app;
        this.app.renderer.resize(this.GAME_WIDTH, this.GAME_HEIGHT);
        this.gameContainer = new Container();
    
        try {
            this.world = SceneManager.getInstance().initialize(
                app, 
                {
                    GAME_WIDTH: this.GAME_WIDTH,
                    GAME_HEIGHT: this.GAME_HEIGHT,
                    GAME_BOUNDS: this.GAME_BOUNDS
                },
                this.gameContainer,
                this.socketManager
            );
            
            console.log('Scene successfully initialized');
        } catch (error) {
            console.error('Failed to initialize scene:', error);
            throw new Error('Game initialization failed');
        }

        const devManager = DevModeManager.getInstance();
        devManager.initialize(app);


        this.ui.scoreDisplay = new ScoreDisplay();

        this.camera.addChild(this.gameContainer);
        this.app.stage.addChild(this.camera);
        this.app.stage.addChild(this.ui.scoreDisplay);

        // Add E key handler
        window.addEventListener('keydown', (e) => {
            if (e.key === 'e' || e.key === 'E') {
                this.controller.resetMouse()
                if (this.player.sprite) {
                    this.world.ammoBush.handleAmmoBushInteraction(this.player.sprite);
                }
            }
        });



    }
    

    
    public static async initialize(app: Application, settingsManager: SettingsManager): Promise<GameManager> {
        if (!GameManager.instance) {
            GameManager.instance = new GameManager(app);
            settingsManager.onModalOpen(() => GameManager.instance.ui.overlayActive = true);
            settingsManager.onModalClose(() => GameManager.instance.ui.overlayActive = false);
            const { name, region } = await loginScreen();
            GameManager.instance.player.name = name;

            GameManager.instance.setupEventListeners();
            GameManager.instance.setupGameLoop();
            GameManager.instance.initializeAudio();

            await GameManager.instance.socketManager.waitForConnect();
            await GameManager.instance.setupNetworking(region);
            
            TvManager.getInstance().startTv();
        }
        return GameManager.instance;
    }


    private initializeAudio(): void {
        const audioManager = AudioManager.getInstance();
        
        // Register game sounds
        audioManager.registerSound('shoot', {
            src: [shootingAudio],
            volume: 0.30
        }, 'sfx');
        
        audioManager.registerSound('impact', {
            src: [impactAudio],
            volume: 0.35
        }, 'sfx');

        audioManager.registerSound('jump', {
            src: [jumpAudio],
            volume: 0.70
        }, 'sfx');
        
        audioManager.registerSound('walking', {
            src: [walkingAudio],
            volume: 0.50,
            loop: true
        }, 'sfx');

        audioManager.registerSound('theme', {
            src: [h3Theme],
            loop: true,
            volume: 0.50
        }, 'music');
        
        // Preload all sounds
        audioManager.preloadAll().then(() => {
            // Start background music
            audioManager.play('theme');
        });
    }


    private setupEventListeners(): void {

        // Add tab key event listener for spectator mode toggle
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault(); // Prevent default tab behavior (focus switching)
                this.showScoreBoard();
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault(); // Prevent default tab behavior (focus switching)
                this.hideScoreBoard();
            }
        });

    }

    private async setupNetworking(region: string): Promise<void> {
        const id = this.socketManager.getId();
        if (!id) throw new Error('Socket ID is undefined');
        this.player.id = id;

        this.socketManager.joinQueue(this.player.name, region);
        this.socketManager.on('gameOver', this.handleGameOver);
        this.socketManager.on('disconnect', this.cleanupSession);
        this.socketManager.on('afkWarning', this.handleAfkWarning);
        this.socketManager.on('afkRemoved', this.handleAfkRemoved);
        this.socketManager.on('stateUpdate', (data: ServerStateUpdate) => {
            this.network.latestServerSnapshot = data;
        });

    }


    private handleGameOver = (scores: PlayerScore[]) => {
        this.controller.resetMouse();
        this.gameState.phase = 'ended';
        this.gameState.pendingCollisions.clear();

        this.ui.gameOverDisplay = new GameOverDisplay(scores, this.player.id);
        this.ui.gameOverDisplay.x = this.app.screen.width / 2;
        this.ui.gameOverDisplay.y = this.app.screen.height / 3;
        this.app.stage.addChild(this.ui.gameOverDisplay);

        this.socketManager.once('matchReset', () => {
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
        });        
    }
    
    private handleAfkWarning = ({ message }: { message: string}) => {
        console.warn(`[SocketManager] AFK Warning: ${message}`);
        ModalManager.getInstance().showModal({
            title: "AFK Warning",
            message: "You have been inactive for too long. Please move or click to continue playing.",
            buttonText: "OK",
            buttonAction: () => {
                // Send a small movement to show the player is active

            },
            isWarning: true
        });
    }
    
    private handleAfkRemoved = ({ message }: { message: string}) => {
        console.warn(`[SocketManager] AFK Removed: ${message}`);
        ModalManager.getInstance().showModal({
            title: "Removed for Inactivity",
            message: "You have been removed from the game due to inactivity. Please reload the page to rejoin.",
            buttonText: "Reload Page",
            buttonAction: () => {
                window.location.reload();
            },
            isWarning: false
        });
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
                this.entities.killIndicators.push(indicator);
            }
        }
    }
    






    private integrateProjectileUpdates(projectiles: ProjectileServerState[]): void {
        const activeProjectileIds = new Set(projectiles.map(p => p.id));
        this.cleanupProjectiles(activeProjectileIds);
        this.updateProjectiles(projectiles);
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

    private updateProjectiles(projectiles: ProjectileServerState[]): void {
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
                const graphic = new EnemyProjectile(projectile.id, projectile.ownerId, projectile.x, projectile.y, projectile.vx, projectile.vy);
                this.gameContainer.addChild(graphic);
                enemyProjectiles.set(projectile.id, graphic);
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


    }

    // TODO: Update to also integrate player controller states. 
    private integrateEnemyPlayers(): void {
        const enemyPlayers = this.network.latestServerSnapshot.players.filter(player => player.id !== this.player.id);
        for (const enemyPlayer of enemyPlayers) {
            if (!this.entities.enemies.has(enemyPlayer.id)) {
                // This doesn't trigger when match ends and player respawns immediately
                const graphic = new EnemyPlayer(enemyPlayer.id, enemyPlayer.position.x, enemyPlayer.position.y, enemyPlayer.isBystander, enemyPlayer.name);
                this.gameContainer.addChild(graphic);
                this.entities.enemies.set(enemyPlayer.id, graphic);
            } else {
                const graphic = this.entities.enemies.get(enemyPlayer.id);
                if (!graphic) continue;
                graphic.setIsBystander(enemyPlayer.isBystander);
                    
                // Only update health if we don't have a pending collision
                const pendingCollision = this.gameState.pendingCollisions.get(enemyPlayer.id);
                if (!pendingCollision) {
                    graphic.setHealth(enemyPlayer.hp);
                }

                // If server health is lower or equal (NOTE: this will likely break if health regen is introduced),
                // than our prediction, collision was confirmed
                if (enemyPlayer.hp <= graphic.getPredictedHealth()) {
                    this.gameState.pendingCollisions.delete(enemyPlayer.id);
                    graphic.setHealth(enemyPlayer.hp);
                }
                graphic?.syncPosition(enemyPlayer.position.x, enemyPlayer.position.y);
            }
        }


        // Remove stale enemy players
        for (const [id, graphic] of this.entities.enemies.entries()) {
            if (!enemyPlayers.some(player => player.id === id)) {
                this.app.stage.removeChild(graphic);
                graphic.destroy();
                this.entities.enemies.delete(id);
            }
        }
    }

    private integrateSelfUpdate(selfData: PlayerServerState | undefined): void {
        if (!selfData && this.player.sprite) {
            // Clean up self graphics if no self data exists
            this.handlePlayerDeath();
            return;
        }
        if (!selfData) return;
        if (selfData && !this.player.sprite) {
            // create new self if it doesn't exist
            this.spawnPlayer(selfData);
        }
        if (!this.player.sprite) return;

        this.player.sprite.setIsBystander(selfData.isBystander);
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
        if (this.player.sprite) {
            console.warn('Self already exists, cannot spawn again');
            return;
        }

        this.player.sprite = new Player(
            data.position.x,
            data.position.y,
            this.GAME_BOUNDS,
            data.name,
        );
        
        this.player.sprite.setPlatforms(this.world.platforms);
        this.player.sprite.setIsBystander(data.isBystander);
        this.player.sprite.setLastProcessedInputVector(new Vector2(0, 0));
        this.gameContainer.addChild(this.player.sprite);
    }

    private updatePlayerHealth(selfData: PlayerServerState): void {
        if (!this.player.sprite) return;
        const pendingCollision = this.gameState.pendingCollisions.get(this.player.id);
        if (!pendingCollision) {
            this.player.sprite.setHealth(selfData.hp);
        }
        
        // If server health is lower or equal (NOTE: this will likely break if health regen is introduced),
        // than our prediction, collision was confirmed
        if (selfData.hp <= this.player.sprite.getPredictedHealth()) {
            this.gameState.pendingCollisions.delete(this.player.id);
            this.player.sprite.setHealth(selfData.hp);
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
        this.app.ticker.maxFPS = 60;

        this.app.ticker.add((delta) => {
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

        });

    }

    
    private handleReconciliation(): void {
        this.network.latestServerSnapshotProcessed = this.network.latestServerSnapshot;
        const selfData = this.network.latestServerSnapshotProcessed.players.find(player => player.id === this.player.id);
        if (!selfData  || !this.player.sprite) {
            console.log('Self data not found in latest server snapshot');
            return;
        }
        const tick = selfData.tick;
        selfData.position = new Vector2(selfData.position.x, selfData.position.y);


        let serverStateBufferIndex = tick % this.BUFFER_SIZE;
        let clientPosition = this.network.stateBuffer[serverStateBufferIndex]?.position;

        if (tick >= this.gameState.localTick) {
            //console.warn(`Server tick ${tick} is ahead of client tick ${this.gameState.localTick}. Syncing client position.`);
            // Server has marched ahead of the client...
            // As a temporary fix, we will simply sync the clint position with the server position
            this.player.sprite.syncPosition(selfData.position.x, selfData.position.y, selfData.vx, selfData.vy);
            this.network.stateBuffer[serverStateBufferIndex] = selfData;
            this.gameState.localTick = tick;
            return;
        }

        // Temp fix for bug where this is undefined :()
        if (!clientPosition){
            console.warn(`bad!`);
            return;
        } 

        const positionError = Vector2.subtract(selfData.position, clientPosition);
        
        if (positionError.len() > 0.0001) {
            //console.warn(`Server position at tick client tick ${selfData.tick}: ${selfData.position.x}, ${selfData.position.y}, Client position at local tick ${ this.network.stateBuffer[serverStateBufferIndex]?.tick}: ${clientPosition.x}, ${clientPosition.y}`);
            this.player.sprite.syncPosition(selfData.position.x, selfData.position.y, selfData.vx, selfData.vy);
            this.network.stateBuffer[serverStateBufferIndex].position = selfData.position;
            let tickToResimulate = tick + 1;
            while (tickToResimulate < this.gameState.localTick) {
                const bufferIndex = tickToResimulate % this.BUFFER_SIZE;
                // TODO: look into bug where this.network.inputBuffer[bufferIndex].vector throws cannot access property 'vector' of undefined
                // Happened after player died. 

                const inputVector = this.network.inputBuffer[bufferIndex]?.vector;
                if (!inputVector) {
                    console.warn(`No input vector found for buffer index ${bufferIndex} at tick ${tickToResimulate}`);
                    break; // No input to resimulate
                }


                this.player.sprite.update(this.network.inputBuffer[bufferIndex].vector, this.MIN_S_BETWEEN_TICKS, true);
                this.network.stateBuffer[bufferIndex].position = this.player.sprite.getPositionVector();
                tickToResimulate++;
            }
        }
    }


    private handleTick(): void {
        if (this.player.sprite) {
            if (this.network.latestServerSnapshot.serverTick > this.network.latestServerSnapshotProcessed.serverTick) {
                this.handleReconciliation();
            }

            const playerInput = this.handlePlayerInput();
            this.updateCameraPositionLERP(); // If we dont update the camera here, it jitters
            if (playerInput) {
                this.handleShooting(playerInput);
                this.player.sprite.setLastProcessedInputVector(playerInput.vector);
            }     
        }

        this.integrateStateUpdate();
        this.updateOwnProjectiles();
        this.updateEnemyProjectiles();
        this.cleanupDestroyedProjectiles(); 
        this.cleanupPendingCollisions();
        this.world.ammoBush.update(this.player.sprite);

    }

    private handlePlayerInput(): InputPayload | undefined {


        if (!this.player.sprite) return; // No player to control

        const controllerState = this.controller.getState();
        // Convert mouse coordinates (GameManager responsibility)
        if (controllerState.mouse) {
            const { x, y } = this.convertCameraToWorldCoordinates(
                controllerState.mouse.xR ?? 0, 
                controllerState.mouse.yR ?? 0
            );
            controllerState.mouse.x = x;
            controllerState.mouse.y = y;
        }



        const { inputPayload, inputVector } = this.player.sprite.processInput(
            controllerState,
            this.MIN_S_BETWEEN_TICKS,
            this.gameState.localTick,
            this.BUFFER_SIZE,
            this.player.disableInput,
            this.ui.overlayActive
        )

        this.player.disableInput = this.ui.overlayActive;
        this.controller.resetJump();
        this.controller.resetMouse();


        // TODO: Move state and input buffers to player class. 
        const bufferIndex = this.gameState.localTick % this.BUFFER_SIZE;
        const stateVector = this.player.sprite.getPositionVector();
        this.network.inputBuffer[bufferIndex] = inputPayload;
        this.network.stateBuffer[bufferIndex] = {
            tick: this.gameState.localTick,
            position: stateVector
        };

      this.player.sprite.update(inputVector, this.MIN_S_BETWEEN_TICKS, false);

        if (this.shouldBroadcastPlayerInput(inputVector)) this.broadcastPlayerInput(inputPayload);
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

        TvManager.getInstance().update(deltaMs);
    }

    private broadcastPlayerInput(inputPayload: InputPayload): void {
        this.socketManager.emit('playerInput', inputPayload);
    }


    private updateDevDisplays(deltaMS: number): void {
        const devManager = DevModeManager.getInstance();
        devManager.updateFPS();
        devManager.updatePing(deltaMS, this.socketManager.getPing());
    }

    private showScoreBoard(): void {
        this.ui.scoreDisplay.show();
    }

    private hideScoreBoard(): void {
        this.ui.scoreDisplay.hide();
    }
    

    private convertCameraToWorldCoordinates(x: number, y: number): { x: number, y: number } {
        // Get the canvas element and its bounding rect
        const canvas = this.app.canvas as HTMLCanvasElement;
        const canvasRect = canvas.getBoundingClientRect();
        
        // 1. Convert mouse position to canvas-relative coordinates
        const canvasX = x - canvasRect.left;
        const canvasY = y - canvasRect.top;
        
        // 2. Calculate the scale ratio between the canvas display size and its internal size
        const scaleRatioX = canvas.width / canvasRect.width;
        const scaleRatioY = canvas.height / canvasRect.height;
        
        // 3. Scale the coordinates to the internal canvas coordinate system
        const rendererX = canvasX * scaleRatioX;
        const rendererY = canvasY * scaleRatioY;
        
        // 4. Convert to world coordinates by subtracting camera offset
        const worldX = rendererX - this.camera.x;
        const worldY = rendererY - this.camera.y;

        return {
            x: worldX,
            y: worldY
        }
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
            this.app.screen.height,
            input?.vector?.mouse?.id,
        );

        AudioManager.getInstance().play('shoot');
        this.player.projectiles.push(projectile);
        this.gameContainer.addChild(projectile);    
    }

    // Note: This is causing jitter.
    private updateCameraPositionLERP(): void {
        if (!this.player.sprite) return;
        // Calculate target camera position (centered on player)
        const targetX = -this.player.sprite.x + this.GAME_WIDTH / 2;
        const targetY = -this.player.sprite.y + (this.GAME_HEIGHT / 2);


        // Calculate responsive offsets based on screen size
        const screenHeight = window.innerHeight;
        
        // Calculate scale ratio between game resolution and actual screen
        const scaleY = screenHeight / this.GAME_HEIGHT;

        // Clamp camera position to stay within bounds + buffer
        const minX = -(this.GAME_BOUNDS.right + 5000) + this.GAME_WIDTH;
        const maxX = this.GAME_BOUNDS.left + 5000;
        const minY = -(150 / scaleY);

        const maxY = this.GAME_BOUNDS.top + 250;
        // Apply clamping to target position
        const clampedTargetX = Math.max(minX, Math.min(maxX, targetX));
        const clampedTargetY = Math.max(minY, Math.min(maxY, targetY));
        
        // Initialize camera position if not set
        if (this.cameraSettings.currentX === 0 && this.cameraSettings.currentY === 0) {
            this.cameraSettings.currentX = clampedTargetX;
            this.cameraSettings.currentY = clampedTargetY;
        }
        
        // Smoothly interpolate between current position and target position
        this.cameraSettings.currentX += (clampedTargetX - this.cameraSettings.currentX) * this.cameraSettings.lerpFactor;
        this.cameraSettings.currentY += (clampedTargetY - this.cameraSettings.currentY) * this.cameraSettings.lerpFactor;

            
        // Store the base (non-shaken) camera position
        this.cameraSettings.baseX = this.cameraSettings.currentX;
        this.cameraSettings.baseY = this.cameraSettings.currentY;

        const xOffset = this.cameraSettings.currentX - this.camera.x;
        const yOffset = this.cameraSettings.currentY - this.camera.y;
        
        // Apply the smoothed camera position
        this.camera.x = this.cameraSettings.currentX;
        this.camera.y = this.cameraSettings.currentY;

        SceneManager.getInstance().updateParallaxBackground(xOffset, yOffset);

        // Update position of UI elements relative to the camera
        this.ui.scoreDisplay.fixPosition();
        DevModeManager.getInstance().fixPositions();
    }




    private updateOwnProjectiles(): void {
        for (let i = this.player.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.player.projectiles[i];
            projectile.update();
            // Check for collisions with enemy players
            if (this.gameState.phase === 'active') {
                for (const [enemyId, enemyGraphic] of this.entities.enemies.entries()) {
                    if (enemyGraphic.getIsBystander() === false && testForAABB(projectile, enemyGraphic)) {
                        this.socketManager.emit('projectileHit', enemyId);
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
