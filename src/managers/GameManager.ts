import { Application, Container, Graphics, Sprite } from 'pixi.js';
import { config } from '../config';
import { Player } from '../logic/Player';
import { Controller } from '../logic/Controller';
import { SocketManager } from './SocketManager';
import { EnemyPlayer } from '../logic/EnemyPlayer';
import { Projectile } from '../logic/Projectile';
import { EnemyProjectile } from '../logic/EnemyProjectile';

import { testForAABB } from '../logic/collision';
import { ScoreDisplay } from '../logic/ui/ScoreDisplay';
import { GameOverDisplay } from '../logic/ui/GameOverDisplay';
import { Platform } from '../logic/Platform';
import { AmmoBox } from '../logic/objects/AmmoBox';
import { KillIndicator } from '../logic/ui/KillIndicator';
import { PingDisplay } from '../logic/ui/PingDisplay';
import { FPSDisplay } from '../logic/ui/FPSDisplay';
import { Vector2 } from '../logic/Vector';
import { ModalManager } from '../logic/ui/Modal';

import h3Theme from '../h3-theme.mp3'
import shootingAudio from '../shoot-sound.wav';
import impactAudio from '../impact-sound.wav';
import jumpAudio from '../swipe-sound.mp3';
import walkingAudio from '../walking-grass-sound.flac'; 
import { AudioManager } from './AudioManager';
import { DevModeManager } from './DevModeManager';
import { TvManager } from './TvManager';
import { loginScreen } from '../logic/ui/LoginScreen';
import type { SettingsManager } from './SettingsManager';

// Fix issue where after the match ends, and then begins again, an enemy ( and maybe self) 
// can start with low health. Once they take damage, the health bar updates to the correct value.
// There seems to be an issue with projectiles stopping and then resuming after match ends and restarts
// (serverside related)
interface PlayerData {
    id: string,
    name: string,
    sprite: Player | undefined,
    projectiles: Projectile[],
    disableInput: boolean
}
interface GameState {
  phase: GamePhase;
  scores: Map<string, number>;
  localTick: number;
  accumulator: number;
  pendingCollisions: Map<string, { projectileId: string, timestamp: number }>;
  destroyedProjectiles: Map<string, number>;
}

interface NetworkState {
  latestServerSnapshot: ServerStateUpdate;
  latestServerSnapshotProcessed: ServerStateUpdate;
  inputBuffer: InputPayload[];
  stateBuffer: StatePayload[];
}

interface EntityContainers {
  enemies: Map<string, EnemyPlayer>;
  enemyProjectiles: Map<string, EnemyProjectile>;
  killIndicators: KillIndicator[];
}

interface WorldObjects {
  platforms: Platform[];
  ammoBox: AmmoBox;
  backgroundAssets: { [key: string]: Sprite };
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


type PlayerServerState = {
  id: string;
  vector: Vector2;
  position: Vector2;
  hp: number;
  isBystander: boolean;
  name: string;
  tick: number;
  vx: number;
  vy: number;
}

type ProjectileServerState = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
};

type PlayerScore = {
    playerId: string;
    kills: number;
    deaths: number;
    name: string;
}

type ServerStateUpdate = {
    players: PlayerServerState[];
    projectiles: ProjectileServerState[];
    scores: PlayerScore[];
    serverTick: number;
};

type InputPayload = {
    tick: number;
    vector: Vector2;
}

type StatePayload = {
    tick: number;
    position: Vector2;
}
// TODO: Implement death prediciton for enemies (and self) on client (with servber confirmation)??
// TODO: Add powerups???
// Ideas:
//  Fat Love:
// - Defense (fat love eats all projectiles)
// - offense (fat love shoots every projectile he ate in the direction of the mouse)


type GamePhase = 'initializing' | 'ready' | 'active' | 'ended';





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
        projectiles: [],
        disableInput: false
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
        ammoBox: undefined as unknown as AmmoBox, // Will be initialized in constructor
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

        this.socketManager = new SocketManager(config.SERVER_URL);

        this.app = app;
        this.setupGameWorld()
        this.app.renderer.resize(this.GAME_WIDTH, this.GAME_HEIGHT);
        this.gameContainer = new Container();

        const devManager = DevModeManager.getInstance();
        devManager.initialize(app);
        
        // Create a background that extends beyond game bounds
        const background = new Container();
        const leftBgTop = new Graphics()
            .rect(-this.GAME_WIDTH,  this.GAME_HEIGHT, this.GAME_WIDTH, this.GAME_HEIGHT + 500)
            .fill('#192328');; //d  Dark gray color

        const bottomBg = new Graphics()
          .rect(0, this.GAME_HEIGHT, this.GAME_WIDTH * 2, 500)
          .fill('#192328');  // Dark gray color

        background.addChild(leftBgTop);
        background.addChild(bottomBg);

        
        // Add background first so it's behind everything
        this.gameContainer.addChild(background);


        this.ui.scoreDisplay = new ScoreDisplay();

        // Create platforms
        this.world.platforms.push(new Platform(0, this.GAME_HEIGHT - 250))
        this.world.platforms.push(new Platform(this.GAME_WIDTH - 500, this.GAME_HEIGHT - 250))
        this.world.platforms.push(new Platform(0, this.GAME_HEIGHT - 500))
        this.world.platforms.push(new Platform(this.GAME_WIDTH - 500, this.GAME_HEIGHT - 500))

        for (const platform of this.world.platforms) {
            this.gameContainer.addChild(platform);
        }

        // Create ammo box at right side of screen
        this.world.ammoBox = new AmmoBox(150, this.GAME_HEIGHT - 80, this.socketManager);
        this.gameContainer.addChild(this.world.ammoBox);

        this.camera.addChild(this.gameContainer);
        this.app.stage.addChild(this.camera);
        this.app.stage.addChild(this.ui.scoreDisplay);

        // Add E key handler
        window.addEventListener('keydown', (e) => {
            if (e.key === 'e' || e.key === 'E') {
                this.controller.resetMouse()
                if (this.player.sprite) {
                    this.world.ammoBox.handleAmmoBoxInteraction(this.player.sprite);
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

private async setupGameWorld() {

        const j1Sprite = Sprite.from('j1');
        j1Sprite.x = 0 - this.GAME_WIDTH / 2;
        j1Sprite.y = 0;

        const j2Sprite = Sprite.from('j2');
        j2Sprite.x = 0 - this.GAME_WIDTH / 5;
        j2Sprite.y = 0;

        const j3Sprite = Sprite.from('j3');
        j3Sprite.x = 0 - this.GAME_WIDTH / 2 ;
        j3Sprite.y = 0;

        const j4Sprite = Sprite.from('j4');
        j4Sprite.x = 0;
        j4Sprite.y = 0;

        localStorage.debug = '*';

        TvManager.getInstance().initialize(j1Sprite, this.GAME_WIDTH, this.GAME_HEIGHT);
        this.app.stage.addChild(j4Sprite);
        this.app.stage.addChild(j3Sprite);
        this.app.stage.addChild(j2Sprite);
        this.app.stage.addChild(j1Sprite);

        this.world.backgroundAssets = {
            j1: j1Sprite,
            j2: j2Sprite,
            j3: j3Sprite,
            j4: j4Sprite
        }

        

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

        this.app.stage.removeChild(this.world.ammoBox);
        this.world.ammoBox.destroy();

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
                this.handleTick(this.MIN_S_BETWEEN_TICKS);
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


    private handleTick(dt: number): void {
        if (this.player.sprite) {
            if (this.network.latestServerSnapshot.serverTick > this.network.latestServerSnapshotProcessed.serverTick) {
                this.handleReconciliation();
            }

            const playerInput = this.handlePlayerInput(dt);
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
        this.world.ammoBox.update(this.player.sprite);

    }

    private handlePlayerInput(dt: number): InputPayload | undefined {


        if (!this.player.sprite) return; // No player to control

        const controllerState = this.controller.getState();
        const inputVector = Vector2.createFromControllerState(controllerState);

        if (this.player.disableInput) {
            inputVector.x = 0; // Prevent input when overlay is active
            inputVector.y = 0; // Prevent input when overlay is active
            inputVector.mouse = undefined; // Prevent mouse input when overlay is active
        }

        this.player.disableInput = this.ui.overlayActive; // Disable input when overlay is active
        if (this.player.disableInput) inputVector.mouse = undefined; // Prevent mouse input when overlay is active

        this.controller.resetMouse();
        if (inputVector.mouse) { // Convert camera to world coordinates
            const { x, y } = this.convertCameraToWorldCoordinates(inputVector.mouse.x, inputVector.mouse.y);
            inputVector.mouse.x = x;
            inputVector.mouse.y = y;
        }
        const inputPayload: InputPayload = {
            tick: this.gameState.localTick,
            vector: inputVector,
        };

        const bufferIndex = this.gameState.localTick % this.BUFFER_SIZE;
        this.controller.keys.up.pressed = false; // Reset up keys to prevent double jump
        this.controller.keys.space.pressed = false; 


        this.network.inputBuffer[bufferIndex] = inputPayload;
        // We apply the input to the player
        this.player.sprite.update(inputVector, dt, false);

        // Add the updated state to the state buffer
        const stateVector = this.player.sprite.getPositionVector();
        this.network.stateBuffer[bufferIndex] = {
            tick: this.gameState.localTick,
            position: stateVector
        };

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
        ) this.broadcastPlayerInput(inputPayload);

        return inputPayload;
    }

    // Any rendering logic not related to game objects. (FPS display, ping display, camera update, etc.)
    private render(deltaMs: number): void {
        //this.updateCameraPosition();
        this.updateCameraShake(deltaMs);

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
        this.triggerCameraShake(4, 80); // 6 pixels intensity, 120ms duration
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

        this.updateBackground(xOffset, yOffset);

        // Update position of UI elements relative to the camera
        this.ui.scoreDisplay.fixPosition();
        DevModeManager.getInstance().fixPositions();
    }

        /**
     * Trigger camera shake effect
     * @param intensity - How strong the shake is (in pixels)
     * @param duration - How long the shake lasts (in milliseconds)
     */
    private triggerCameraShake(intensity: number = 8, duration: number = 150): void {
        //this.cameraSettings.shakeIntensity = intensity;
        //this.cameraSettings.shakeDuration = duration;
        //this.cameraSettings.shakeElapsed = 0;
        console.log(`Camera shake triggered with intensity ${intensity} and duration ${duration}`);
    }

    /**
     * Update camera shake - call this in your game loop
     */
    private updateCameraShake(deltaMs: number): void {
        if (this.cameraSettings.shakeElapsed < this.cameraSettings.shakeDuration) {
            this.cameraSettings.shakeElapsed += deltaMs;
            
            // Calculate shake progress (0 to 1)
            const progress = this.cameraSettings.shakeElapsed / this.cameraSettings.shakeDuration;
            
            // Use easing function to make shake feel more natural (strong start, fade out)
            const easedProgress = 1 - Math.pow(progress, 2);
            const currentIntensity = this.cameraSettings.shakeIntensity * easedProgress;
            
            // Generate random shake offset
            const shakeX = (Math.random() - 0.5) * 2 * currentIntensity;
            const shakeY = (Math.random() - 0.5) * 2 * currentIntensity;
            
            // Apply shake to camera position
            this.camera.x = this.cameraSettings.baseX + shakeX;
            this.camera.y = this.cameraSettings.baseY + shakeY;
        } else {
            // Shake finished, reset to base position
            this.camera.x = this.cameraSettings.baseX;
            this.camera.y = this.cameraSettings.baseY;
            this.cameraSettings.shakeIntensity = 0;
        }
    }

    private updateBackground(offsetX: number, offsetY: number): void {
        // Update background position based on camera offset
        if (!this.world.backgroundAssets
            || !this.world.backgroundAssets.j1
            || !this.world.backgroundAssets.j2
            || !this.world.backgroundAssets.j3
            || !this.world.backgroundAssets.j4
        ) return;
        
        this.world.backgroundAssets.j1.x += offsetX * 0.4;
        this.world.backgroundAssets.j2.x += offsetX * 0.3;
        this.world.backgroundAssets.j3.x += offsetX * 0.2;

        this.world.backgroundAssets.j1.y += offsetY * 0.4;
        this.world.backgroundAssets.j2.y += offsetY * 0.3;
        this.world.backgroundAssets.j3.y += offsetY * 0.2;

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
