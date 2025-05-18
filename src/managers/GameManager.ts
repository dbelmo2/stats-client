import { Application, Container, Graphics } from 'pixi.js';
import { Player } from '../logic/Player';
import { Controller } from '../logic/Controller';
import { SocketManager } from '../network/SocketManager';
import { EnemyPlayer } from '../logic/EnemyPlayer';
import { Projectile } from '../logic/Projectile';
import { EnemyProjectile } from '../logic/EnemyProjectile';

import { testForAABB } from '../logic/collision';
import { ScoreDisplay } from '../logic/ui/ScoreDisplay';
import { GameOverDisplay } from '../logic/ui/GameOverDisplay';
import { Platform } from '../logic/Platform';
import { AmmoBox } from '../logic/objects/AmmoBox';
import { KillIndicator } from '../logic/ui/KillIndicator';
import * as config from '../config.json';
import { PingDisplay } from '../logic/ui/PingDisplay';
import { FPSDisplay } from '../logic/ui/FPSDisplay';


const PROJECTILE_SPEED = 30;
const PROJECTILE_LIFESPAN = 5000;
const PROJECTILE_GRAVITY = 0.05;




// Fix issue where after the match ends, and then begins again, an enemy ( and maybe self) 
// can start with low health. Once they take damage, the health bar updates to the correct value.
// There seems to be an issue with projectiles stopping and then resuming after match ends and restarts
// (serverside related)


type PlayerState = {
  id: string;
  x: number;
  y: number;
  hp: number;
  isBystander: boolean;
  name: string;
}

type ProjectileState = {
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

// TODO: Implement death prediciton for enemies (and self) on client (with servber confirmation)??

// TODO: Fix projectile spawn location (make dynamic based on mouse position)

// TODO: Look into having camera follow player with small width correctly. attempted but
// faced issues with rendering friendly projectiles correctly  


// TODO: Add powerups???
// Ideas:
//  Fat Love:
// - Defense (fat love eats all projectiles)
// - offense (fat love shoots every projectile he ate in the direction of the mouse)



type GamePhase = 'initializing' | 'ready' | 'active' | 'ended';

export class GameManager {
    private static instance: GameManager;
    private app: Application;
    private socketManager: SocketManager;
    private controller: Controller;
    private camera = new Container();

    private readonly GAME_WIDTH = 1920;  // Fixed game width
    private readonly GAME_HEIGHT = 1080; // Fixed game height
    private gameContainer: Container;     // Container for game objects

    // Game objects & state
    private playerName: string = '';
    private self: Player | undefined;
    private selfId: string = '';
    private ownProjectiles: Projectile[] = [];
    private enemyPlayerStates: PlayerState[] = [];
    private enemyGraphics: Map<string, EnemyPlayer> = new Map();
    private enemyProjectileGraphics: Map<string, EnemyProjectile> = new Map();
    private destroyedProjectiles: Map<string, number> = new Map();
    private pendingCollisions: Map<string, { projectileId: string, timestamp: number }> = new Map();
    private gamePhase: GamePhase = 'active';
    private currentScores: Map<string, number> = new Map();
    private killIndicators: KillIndicator[] = [];


    // Map displays &d
    private gameOverDisplay: GameOverDisplay | null = null;
    private ammoBox: AmmoBox;
    private platforms: Platform[] = [];
    private pingDisplay: PingDisplay;
    private fpsDisplay: FPSDisplay;
    private scoreDisplay: ScoreDisplay;

    private readonly COLLISION_TIMEOUT = 2000; // ms to wait before considering server missed collision
    private readonly PLAYER_SPAWN_X = 100; // X coordinate for player spawn
    private readonly PLAYER_SPAWN_Y = 100; // Y coordinate for player spawn

    private readonly GAME_BOUNDS = {
        left: 0,
        right: this.GAME_WIDTH,
        top: 0,
        bottom: this.GAME_HEIGHT
    };

    private constructor(app: Application) {
        this.controller = new Controller();

        this.socketManager = new SocketManager(config.SERVER_URL ?? 'https://yt-livestream-late-tracker-server-production.up.railway.app/');

        this.app = app;

        this.app.renderer.resize(this.GAME_WIDTH, this.GAME_HEIGHT);
        this.gameContainer = new Container();

        // Create a background that extends beyond game bounds
        const background = new Container();
        const leftBg = new Graphics()
            .rect(-this.GAME_WIDTH,  0, this.GAME_WIDTH, this.GAME_HEIGHT + 500)
            .fill(0x111111);  // Dark gray color
        const leftBgTop = new Graphics()
            .rect(-this.GAME_WIDTH,  this.GAME_HEIGHT, this.GAME_WIDTH, this.GAME_HEIGHT + 500)
            .fill(0x111111); //d  Dark gray color
        const rightBg = new Graphics()  
            .rect(this.GAME_WIDTH, 0, this.GAME_WIDTH, this.GAME_HEIGHT + 500)
            .fill(0x111111);  // Dark gray color

        const bottomBg = new Graphics()
            .rect(0, this.GAME_HEIGHT, this.GAME_WIDTH * 2, 500)
            .fill(0x111111);  // Dark gray color

        background.addChild(leftBgTop);
        background.addChild(bottomBg);
        background.addChild(leftBg);
        background.addChild(rightBg);
        
        // Add background first so it's behind everything
        this.gameContainer.addChild(background);

        // Ping display
        this.pingDisplay = new PingDisplay();
        this.fpsDisplay = new FPSDisplay();

        // Create score display
        this.scoreDisplay = new ScoreDisplay();

        // Create platforms
        this.platforms.push(new Platform(250, this.GAME_HEIGHT - 250))
        this.platforms.push(new Platform(this.GAME_WIDTH - 850, this.GAME_HEIGHT - 250))
        this.platforms.push(new Platform(250, this.GAME_HEIGHT - 500))
        this.platforms.push(new Platform(this.GAME_WIDTH - 850, this.GAME_HEIGHT - 500))

        for (const platform of this.platforms) {
            this.gameContainer.addChild(platform);
        }



        // Create ammo box at right side of screen
        this.ammoBox = new AmmoBox(this.GAME_WIDTH - 100, this.GAME_HEIGHT - 50);
        this.gameContainer.addChild(this.ammoBox);

        this.camera.addChild(this.gameContainer);
        this.app.stage.addChild(this.camera);
        this.app.stage.addChild(this.scoreDisplay);
        this.app.stage.addChild(this.pingDisplay);
        this.app.stage.addChild(this.fpsDisplay);









        // Add E key handler
        window.addEventListener('keydown', (e) => {
            if (e.key === 'e' || e.key === 'E') {
                this.controller.resetMouse()
                this.handleAmmoBoxInteraction();
            }
        });


    }
    


    public static async initialize(app: Application): Promise<GameManager> {
        if (!GameManager.instance) {
            GameManager.instance = new GameManager(app);

            // Get player name before proceeding
            const name = await GameManager.instance.getPlayerName();
            if (!name) {
                throw new Error('Player name is required');
            }
            GameManager.instance.playerName = name;

            GameManager.instance.setupPlayer();
            GameManager.instance.setupGameLoop();
            await GameManager.instance.socketManager.waitForConnect();
            await GameManager.instance.setupNetworking();
            // After the first state update, we can start the game loop
        }
        return GameManager.instance;
    }

    // Add new method
    private async getPlayerName(): Promise<string> {
        return new Promise((resolve) => {
            // Create modal container
            const modalContainer = document.createElement('div');
            modalContainer.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: #111111;
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 1000;
            `;

            // Create modal content
            const modal = document.createElement('div');
            modal.style.cssText = `
                background: #2c2c2c;
                padding: 20px;
                border-radius: 8px;
                text-align: center;
            `;

            // Create input
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'Enter your name';
            input.maxLength = 15;
            input.style.cssText = `
                margin: 10px;
                padding: 8px;
                font-size: 16px;
                border: none;
                border-radius: 4px;
                background: #1c1c1c;
                color: white;
                outline: none;
            `;

            // Create button
            const button = document.createElement('button');
            button.textContent = 'Play';
            button.style.cssText = `
                margin: 10px;
                padding: 8px 16px;
                font-size: 16px;
                border: none;
                border-radius: 4px;
                background: #4CAF50;
                color: white;
                cursor: pointer;
            `;
            button.disabled = true;

            // Add input validation
            input.addEventListener('input', () => {
                const name = input.value.trim();
                button.disabled = name.length < 3;
            });

            // Handle form submission
            const handleSubmit = () => {
                const name = input.value.trim();
                if (name.length >= 3) {
                    document.body.removeChild(modalContainer);
                    resolve(name);
                }
            };

            button.addEventListener('click', handleSubmit);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleSubmit();
            });

            // Assemble and show modal
            modal.appendChild(input);
            modal.appendChild(button);
            modalContainer.appendChild(modal);
            document.body.appendChild(modalContainer);

            // Focus input
            input.focus();
        });
    }


    private async setupNetworking(): Promise<void> {
        const id = this.socketManager.getId();
        if (!id) throw new Error('Socket ID is undefined');
        this.selfId = id;
        
        // Join the queue
        this.socketManager.joinQueue('NA', this.playerName);

        // Set up state update handler - this is essential
        // Upon reveiving the first state update, we will render the initial players but ignore 
        // Player input in app ticker
        this.socketManager.on('stateUpdate', this.handleStateUpdate.bind(this));
        
        this.socketManager.on('gameOver', (scores: PlayerScore[]) => {
            this.controller.resetMouse();
            this.gamePhase = 'ended';
            this.pendingCollisions.clear(); // ????
            // Create and display game over screen
            this.gameOverDisplay = new GameOverDisplay(scores, this.selfId);
            this.gameOverDisplay.x = this.app.screen.width / 2;
            this.gameOverDisplay.y = this.app.screen.height / 3;
            this.app.stage.addChild(this.gameOverDisplay);

                    
            // Wait for next match signal
            this.socketManager.once('matchReset', () => {
                // Clear combat-related state
                this.ownProjectiles = [];
                this.enemyProjectileGraphics.clear();
                this.pendingCollisions.clear();
                this.destroyedProjectiles.clear();


                // Remove game over display
                if (this.gameOverDisplay) {
                    this.app.stage.removeChild(this.gameOverDisplay);
                    this.gameOverDisplay.destroy();
                    this.gameOverDisplay = null;
                }
                this.gamePhase = 'active';
            });
    
            
            // Force a render update
            //this.app.renderer.render(this.app.stage);
            
        });

        this.socketManager.on('disconnect', () => this.cleanupSession());

    }

    
    private setupPlayer(): void {
        this.self = new Player(
            this.PLAYER_SPAWN_X, 
            this.PLAYER_SPAWN_Y,
            this.GAME_BOUNDS, 
            this.playerName
        );
        
        // Set up platform references
        this.self.setPlatforms(this.platforms);

        // Add to stage
        this.gameContainer.addChild(this.self);
    }

    private handleStateUpdate({ players, projectiles, scores }: { 
        players: PlayerState[], 
        projectiles: ProjectileState[],
        scores: PlayerScore[]
    }): void {
        this.enemyPlayerStates = players.filter(player => player.id !== this.selfId);
        const selfData = players.find(player => player.id === this.selfId);
        this.checkForKills(scores);
        this.scoreDisplay.updateScores(scores, this.selfId);
        this.handleSelfUpdate(selfData);
        this.handleProjectileUpdates(projectiles);
        this.updateEnemyPlayers(); 
    }
    
    private checkForKills(scores: PlayerScore[]): void {
        for (const score of scores) {
            const previousKills = this.currentScores.get(score.playerId) || 0;
            
            // If player got a new kill
            if (score.kills > previousKills) {
                // Show kill indicator
                this.showKillIndicator(score.playerId);
            }
            
            // Update stored kills
            this.currentScores.set(score.playerId, score.kills);
        }
    }

    private showKillIndicator(playerId: string): void {
        // Show indicator above player who got the kill
        if (playerId === this.selfId && this.self) {
            // Player kill
            const indicator = new KillIndicator(this.self.x, this.self.y - 50);
            this.gameContainer.addChild(indicator);
            this.killIndicators.push(indicator);
        } else {
            // Enemy kill
            const enemyGraphic = this.enemyGraphics.get(playerId);
            if (enemyGraphic) {
                const indicator = new KillIndicator(enemyGraphic.x, enemyGraphic.y - 50);
                this.gameContainer.addChild(indicator);
                this.killIndicators.push(indicator);
            }
        }
    }
    
    private handleAmmoBoxInteraction(): void {
        if (!this.self || !this.self.getIsBystander()) return;
        // Check if player is near ammo box
        if (testForAABB(this.self, this.ammoBox)) {
            this.socketManager.emit('toggleBystander', false);
        }
    }


    private handleProjectileUpdates(projectiles: ProjectileState[]): void {
        const activeProjectileIds = new Set(projectiles.map(p => p.id));
        this.cleanupProjectiles(activeProjectileIds);
        this.updateProjectiles(projectiles);
    }

    private cleanupProjectiles(activeIds: Set<string>): void {
        // Clean up enemy projectiles
        for (const [id, graphic] of this.enemyProjectileGraphics.entries()) {
            if (!activeIds.has(id)) {
                this.app.stage.removeChild(graphic);
                graphic.destroy();
                this.enemyProjectileGraphics.delete(id);
            }
        }

        // Clean up own projectiles only if they were in server state and now aren't
        for (let i = this.ownProjectiles.length - 1; i >= 0; i--) {
            const projectile = this.ownProjectiles[i];
            const projectileId = projectile.getId();
            
            // Only clean up projectiles that were previously acknowledged by server
            if (projectile.wasAcknowledged && !activeIds.has(projectileId)) {
                this.app.stage.removeChild(projectile);
                projectile.destroy();
                this.ownProjectiles.splice(i, 1);
            }
        }
    }

    private updateProjectiles(projectiles: ProjectileState[]): void {
        for (const projectile of projectiles) {
            if (projectile.ownerId === this.selfId) {
                // Mark own projectiles as acknowledged when they appear in server state
                const ownProjectile = this.ownProjectiles.find(p => p.getId() === projectile.id);
                if (ownProjectile) {
                    ownProjectile.wasAcknowledged = true;
                }
            } else if (!this.enemyProjectileGraphics.has(projectile.id) && !this.destroyedProjectiles.has(projectile.id)) {
                // Only create new projectile if it hasn't been destroyed locally
                const graphic = new EnemyProjectile(projectile.id, projectile.ownerId, projectile.x, projectile.y, projectile.vx, projectile.vy);
                this.gameContainer.addChild(graphic);
                this.enemyProjectileGraphics.set(projectile.id, graphic);
            }
        }
    }

    private cleanupPendingCollisions(): void {
        const now = Date.now();
        for (const [id, collision] of this.pendingCollisions.entries()) {
            if (now - collision.timestamp > this.COLLISION_TIMEOUT) {
                // Get the affected entity (self or enemy)
                if (this.self && id === this.selfId) {
                    this.self.revertPrediction();
                } else {
                    const graphic = this.enemyGraphics.get(id);
                    if (graphic) {
                        graphic.revertPrediction();
                    }
                }
                this.pendingCollisions.delete(id);
            }
        }
    }

    // Add cleanup for destroyed projectile IDs
    private cleanupDestroyedProjectiles(): void {
        const MAX_AGE = 5000; // 5 seconds
        const now = Date.now();
        for (const [id, timestamp] of this.destroyedProjectiles.entries()) {
            if (now - timestamp > MAX_AGE) {
                this.destroyedProjectiles.delete(id);
            }
        }
    }

    private cleanupSession(): void {
        // Clean up projectiles first
        this.app.ticker.stop();

        for (let i = this.ownProjectiles.length - 1; i >= 0; i--) {
            const projectile = this.ownProjectiles[i];
            this.app.stage.removeChild(projectile);
            projectile.destroy();
        }
        this.ownProjectiles = [];

        for (const [_, projectile] of this.enemyProjectileGraphics) {
            this.app.stage.removeChild(projectile);
            projectile.destroy();
        }
        this.enemyProjectileGraphics.clear();

        // Clean up enemy players
        for (const [_, enemy] of this.enemyGraphics) {
            this.app.stage.removeChild(enemy);
            enemy.destroy();
        }
        this.enemyGraphics.clear();

        // Clean up self
        if (this.self) {
            this.app.stage.removeChild(this.self);
            this.self.destroy();
            this.self = undefined;
        }

        for (const platform of this.platforms) {
            this.app.stage.removeChild(platform);
            platform.destroy();
        }


        // Remove ping display
        this.app.stage.removeChild(this.pingDisplay);
        this.pingDisplay.destroy();

        // Remove FPS display
        this.app.stage.removeChild(this.fpsDisplay);
        this.fpsDisplay.destroy();
        

        // Clean up kill indicators
        for (const indicator of this.killIndicators) {
            this.gameContainer.removeChild(indicator);
            indicator.destroy();
        }
        this.killIndicators = [];
        this.currentScores.clear();

        this.app.stage.removeChild(this.ammoBox);
        this.ammoBox.destroy();

        // Clear all remaining state
        this.pendingCollisions.clear();
        this.destroyedProjectiles.clear();


    }
    private updateEnemyPlayers(): void {
        for (const enemyPlayer of this.enemyPlayerStates) {
            if (!this.enemyGraphics.has(enemyPlayer.id)) {
                // This doesn't trigger when match ends and player respawns immediately
                console.log(`Adding new enemy player ${enemyPlayer.id} to stage`);
                const graphic = new EnemyPlayer(enemyPlayer.id, enemyPlayer.x, enemyPlayer.y, enemyPlayer.isBystander, enemyPlayer.name);
                this.gameContainer.addChild(graphic);
                this.enemyGraphics.set(enemyPlayer.id, graphic);
            } else {
                const graphic = this.enemyGraphics.get(enemyPlayer.id);
                if (!graphic) continue;
                graphic.setIsBystander(enemyPlayer.isBystander);
                    
                // Only update health if we don't have a pending collision
                const pendingCollision = this.pendingCollisions.get(enemyPlayer.id);
                if (!pendingCollision) {
                    graphic.setHealth(enemyPlayer.hp);
                }

                // If server health is lower or equal (NOTE: this will likely break if health regen is introduced),
                // than our prediction, collision was confirmed
                if (enemyPlayer.hp <= graphic.getPredictedHealth()) {
                    this.pendingCollisions.delete(enemyPlayer.id);
                    graphic.setHealth(enemyPlayer.hp);
                }

                graphic?.syncPosition(enemyPlayer.x, enemyPlayer.y);
            }
        }


        // Remove stale enemy players
        for (const [id, graphic] of this.enemyGraphics.entries()) {
            if (!this.enemyPlayerStates.some(player => player.id === id)) {
                console.log(`Removing enemy player ${id} from stage`);
                this.app.stage.removeChild(graphic);
                graphic.destroy();
                this.enemyGraphics.delete(id);
            }
        }
    }

    private handleSelfUpdate(selfData: PlayerState | undefined): void {
        if (!selfData && this.self) {
            // Clean up self graphics if no self data exists
            this.pendingCollisions.delete(this.selfId);
            this.app.stage.removeChild(this.self);
            this.self.destroy();
            this.self = undefined;
            return;
        }
        if (!selfData) return;
        if (selfData && !this.self) {
            // create new self if it doesn't exist
            this.self = new Player(selfData.x, selfData.y, this.GAME_BOUNDS, selfData.name);
            this.self.setPlatforms(this.platforms);
            this.self.setIsBystander(selfData.isBystander);
            this.gameContainer.addChild(this.self);
        }
        if (!this.self) return;

        
        this.self.setIsBystander(selfData.isBystander);
        
        if (this.self.getIsBystander() === false && selfData.isBystander ===  false) {
            // Only update health if we don't have a pending collision
            const pendingCollision = this.pendingCollisions.get(this.selfId);
            if (!pendingCollision) {
                this.self.setHealth(selfData.hp);
            }
            
            // If server health is lower or equal (NOTE: this will likely break if health regen is introduced),
            // than our prediction, collision was confirmed
            if (selfData.hp <= this.self.getPredictedHealth()) {
                this.pendingCollisions.delete(this.selfId);
                this.self.setHealth(selfData.hp);
            }
        }
       // this.self.syncPosition(selfData.x, selfData.y);
    }

    private setupGameLoop(): void {

        let pingUpdateCounter = 0;

        this.app.ticker.add((delta) => {
            if (this.self) {        

                this.fpsDisplay.update();

                // Update ping display (every ~60 frames = ~1 second)
                pingUpdateCounter += delta.deltaTime;
                if (pingUpdateCounter >= 60) {
                    this.pingDisplay.updatePing(this.socketManager.getPing());
                    pingUpdateCounter = 0;
                }

                this.self.update(this.controller);

                const targetX = -this.self.x + this.GAME_WIDTH / 2;
                const targetY = (-this.self.y + this.GAME_HEIGHT / 2);

                
                // Clamp camera position to stay within bounds + 250px buffer
                // In order to fix issue with camera and small window width, 
                // We need to somehow modify the 1000 value offsets here to be dynamic, based on the window width?
                // old values were 250. 
                // 1000 normal for 1920x1080 full screen
                // 250, for small window width
                // 5000 for hugeee world such as 5000x1080
                const minX = -(this.GAME_BOUNDS.right + 5000) + this.GAME_WIDTH;
                const maxX = this.GAME_BOUNDS.left + 5000;
                const minY = -(this.GAME_BOUNDS.bottom + 250) + this.GAME_HEIGHT;
                const maxY = this.GAME_BOUNDS.top + 250;
                
                // Apply clamping and set camera position
                this.camera.x = Math.max(minX, Math.min(maxX, targetX));
                this.camera.y = Math.max(minY, Math.min(maxY, targetY));
            
                this.scoreDisplay.fixPosition();
                this.fpsDisplay.fixPosition();
                this.pingDisplay.fixPosition();

                this.sendPlayerState();
            }
            
            this.updateOwnProjectiles();
            this.updateEnemyProjectiles();

            if (this.gamePhase === 'active') {
                // Only allow shooting if the game is active
                this.handleShooting();

            }

            // Move cleanup code to a less frequent loop?
            this.cleanupDestroyedProjectiles(); 
            this.cleanupPendingCollisions(); 
        });
    }

    private handleShooting(): void {
        if (!this.self || this.self.getIsBystander() || this.gamePhase !== 'active') return;
        if (this.controller.mouse.justReleased) {
            this.controller.mouse.justReleased = false;

            // Get the canvas element and its bounding rect
            const canvas = this.app.canvas as HTMLCanvasElement;
            const canvasRect = canvas.getBoundingClientRect();
            
            // Get mouse coordinates from the controller
            const mouseX = this.controller.mouse.xR ?? 0;
            const mouseY = this.controller.mouse.yR ?? 0;
            
            // 1. Convert mouse position to canvas-relative coordinates
            const canvasX = mouseX - canvasRect.left;
            const canvasY = mouseY - canvasRect.top;
            
            // 2. Calculate the scale ratio between the canvas display size and its internal size
            const scaleRatioX = canvas.width / canvasRect.width;
            const scaleRatioY = canvas.height / canvasRect.height;
            
            // 3. Scale the coordinates to the internal canvas coordinate system
            const rendererX = canvasX * scaleRatioX;
            const rendererY = canvasY * scaleRatioY;
            
            // 4. Convert to world coordinates by subtracting camera offset
            const worldX = rendererX - this.camera.x;
            const worldY = rendererY - this.camera.y;


            const target = { 
                x: worldX,
                y: worldY,
                id: ''
            };
            const projectile = new Projectile(
                this.self.x,
                this.self.y,
                target.x,
                target.y,
                PROJECTILE_SPEED,
                PROJECTILE_LIFESPAN,
                PROJECTILE_GRAVITY,
                this.app.screen.height
            );

            target.id = projectile.getId();
            this.gameContainer.addChild(projectile);
            this.ownProjectiles.push(projectile);
            this.socketManager.emit('shoot', target);
        }
    }

    private updateOwnProjectiles(): void {
        for (let i = this.ownProjectiles.length - 1; i >= 0; i--) {
            const projectile = this.ownProjectiles[i];
            projectile.update();
            // Check for collisions with enemy players
            if (this.gamePhase === 'active') {
                for (const [enemyId, enemyGraphic] of this.enemyGraphics.entries()) {
                    if (enemyGraphic.getIsBystander() === false && testForAABB(projectile, enemyGraphic)) {
                        // Record collision prediction
                        // This is required so we can reject stateUpdates that likely haven't computed
                        // the collision yet due to network latency
                        this.pendingCollisions.set(enemyId, {
                            projectileId: projectile.getId(),
                            timestamp: Date.now()
                        });

                        // Apply predicted damage (the server will confirm or correct this after a timeout)
                        enemyGraphic.damage();

                        // Mark projectile for cleanup
                        projectile.shouldBeDestroyed = true;
                        break; // Exit collision check loop once hit is found
                    }
                }
            }


            if (projectile.shouldBeDestroyed) {
                this.ownProjectiles.splice(i, 1);
                projectile.destroy();
            }

            
        }
    }

    private updateEnemyProjectiles(): void {
        for (const [projectileId, projectile] of this.enemyProjectileGraphics.entries()) {
            projectile.update();
            
            if (this.gamePhase === 'active') {
                // Check collision with self first
                if (this.self && this.self.getIsBystander() === false && testForAABB(projectile, this.self)) {
                    // Add projectile to destroyed list
                    // to avoid respawning it on delayed stateUpdates
                    this.destroyedProjectiles.set(projectileId, Date.now());

                    // Record collision prediction
                    this.pendingCollisions.set(this.selfId, {
                        projectileId: projectileId,
                        timestamp: Date.now()
                    });

                    // Apply predicted damage to self
                    this.self.damage();
                    
                    // Mark projectile for cleanup
                    projectile.shouldBeDestroyed = true;
                } else {
                    // Check collisions with other enemies
                    for (const [enemyId, enemyGraphic] of this.enemyGraphics.entries()) {
                        if (
                            enemyId !== projectile.getOwnerId() 
                            && testForAABB(projectile, enemyGraphic)
                            && enemyGraphic.getIsBystander() === false
                        ) {
                            this.destroyedProjectiles.set(projectileId, Date.now());
                            // Record collision prediction
                            this.pendingCollisions.set(enemyId, {
                                projectileId: projectileId,
                                timestamp: Date.now()
                            });

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
                this.enemyProjectileGraphics.delete(projectileId);
            }
        }
    }

    private sendPlayerState(): void {
        if (!this.self) return;
        this.socketManager.emit('playerInput', {
            x: this.self.x,
            y: this.self.y,
            vy: this.self.getVelocityY(),
        });
    }
}