import { Application } from 'pixi.js';
import { Player } from '../logic/Player';
import { Controller } from '../logic/Controller';
import { SocketManager } from '../network/SocketManager';
import { EnemyPlayer } from '../logic/EnemyPlayer';
import { Projectile } from '../logic/Projectile';
import { EnemyProjectile } from '../logic/EnemyProjectile';

import { testForAABB } from '../logic/collision';
import { ScoreDisplay } from '../logic/ScoreDisplay';
import { GameOverDisplay } from '../logic/GameOverDisplay';

const PROJECTILE_SPEED = 30;
const PROJECTILE_LIFESPAN = 5000;
const PROJECTILE_GRAVITY = 0.05;


type PlayerState = {
  id: string;
  x: number;
  y: number;
  hp: number;
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
}


// TODO: When a player is repeatedly hit by a projectile, the health bar rubberbands. It eventually settles down,
// it is a bad ux. This notably does not happen when the player hits an enemy with a projectile. Pending collision logic
// needs to be added to the handleSelfUpdate method, similar to the one in updateEnemyPlayers.


// TODO: Look into mismatch between server and client collisions. PRint total number of collisions for both client and server
// Update: This improved after syncing start positons between server and client and waiting for the first stateUpdate 
// before starting the game loop. However, it still happens abit in the beginning, thought less.

// TODO: Implement death prediciton for enemies (and self) on client (with servber confirmation)??


export class GameManager {
    private static instance: GameManager;
    private app: Application;
    private socketManager: SocketManager;
    private controller: Controller;
    private self: Player | undefined;
    private selfId: string = '';
    private ownProjectiles: Projectile[] = [];
    private enemyPlayerStates: PlayerState[] = [];
    private enemyGraphics: Map<string, EnemyPlayer> = new Map();
    private enemyProjectileGraphics: Map<string, EnemyProjectile> = new Map();
    private destroyedProjectiles: Map<string, number> = new Map();
    private scoreDisplay: ScoreDisplay;
    private gameOverDisplay: GameOverDisplay | null = null;
    private pendingCollisions: Map<string, { projectileId: string, timestamp: number }> = new Map();
    private readonly COLLISION_TIMEOUT = 2000; // ms to wait before considering server missed collision
    private totalCollisions = new Set<string>();
    private gameActive: boolean = false;

    private constructor(app: Application) {
        this.app = app;
        this.controller = new Controller();
        this.socketManager = new SocketManager('http://localhost:3000');
        this.scoreDisplay = new ScoreDisplay();
        this.app.stage.addChild(this.scoreDisplay);

        // Handle resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });

    }

    private handleResize(): void {
    // Update app dimensions
    this.app.renderer.resize(window.innerWidth, window.innerHeight);
    
    // Update game over display position if it exists
    if (this.gameOverDisplay) {
        this.gameOverDisplay.x = this.app.screen.width / 2;
        this.gameOverDisplay.y = this.app.screen.height / 3;
    }
}

    public static async initialize(app: Application): Promise<GameManager> {
        if (!GameManager.instance) {
            GameManager.instance = new GameManager(app);
            await GameManager.instance.socketManager.waitForConnect();
            GameManager.instance.setupGameLoop();
            await GameManager.instance.setupNetworking();
            // After the first state update, we can start the game loop
        }
        return GameManager.instance;
    }


    // TODO: Modify client to listen for setup event from server.. upong receiving it, emit playerReady event.
    // Then listen to gameStart server to allow player input from controller... block until then but render the playars as soon as the first stateUpdate is received

    private async setupNetworking(): Promise<void> {
        const id = this.socketManager.getId();
        if (!id) throw new Error('Socket ID is undefined');
        this.selfId = id;
        
        // Join the queue
        this.socketManager.joinQueue('NA');

        // Set up state update handler - this is essential
        // Upon reveiving the first state update, we will render the initial players but ignore 
        // Player input in app ticker
        this.socketManager.on('stateUpdate', this.handleStateUpdate.bind(this));
        
        this.socketManager.on('gameOver', (scores: PlayerScore[]) => {
            console.log('Game over, stopping game loop');
            
            // First, stop all updates
            this.app.ticker.stop();
            
            // Store selfId before cleanup
            const finalSelfId = this.selfId;
            
            // Force cleanup of all game objects
            this.cleanupGame();
            
            // Clear state
            this.enemyPlayerStates = [];
            this.selfId = '';
            this.totalCollisions.clear();
            
            // Ensure score display is removed
            if (this.scoreDisplay) {
                this.app.stage.removeChild(this.scoreDisplay);
                this.scoreDisplay.destroy();
            }
            
            // Create game over display with proper positioning
            this.gameOverDisplay = new GameOverDisplay(scores, finalSelfId, this.app);
            this.gameOverDisplay.x = this.app.screen.width / 2;
            this.gameOverDisplay.y = this.app.screen.height / 3;
            
            // Add to stage last
            this.app.stage.addChild(this.gameOverDisplay);
            
            // Force a render update
            this.app.renderer.render(this.app.stage);
            
            console.log('Game over screen displayed');
        });

        await new Promise<void>(resolve => {
            this.socketManager.once('setupComplete', () => {
                this.socketManager.emit('playerReady');
                resolve();
            });
        });

        await new Promise<void>(resolve => {
            this.socketManager.once('matchStart', () => {
                console.log('Match started, player controls enabled');
                this.gameActive = true;
                resolve();
            });
        })
    }

    private handleStateUpdate({ players, projectiles, scores }: { 
        players: PlayerState[], 
        projectiles: ProjectileState[],
        scores: PlayerScore[]
    }): void {
        this.enemyPlayerStates = players.filter(player => player.id !== this.selfId);
        const selfData = players.find(player => player.id === this.selfId);
        this.scoreDisplay.updateScores(scores, this.selfId);
        this.handleSelfUpdate(selfData);
        this.handleProjectileUpdates(projectiles);
        this.updateEnemyPlayers(); // this cleans up pending collisions but is only called when stateUpdate is received
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
                console.log(`enemy player shot.. victim location when shot occured: x: ${this.self?.x}, y: ${this.self?.y}`);
                const graphic = new EnemyProjectile(projectile.id, projectile.ownerId, projectile.x, projectile.y, projectile.vx, projectile.vy);
                this.app.stage.addChild(graphic);
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

    private cleanupGame(): void {
        // Clean up projectiles first
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

        // Clear all remaining state
        this.pendingCollisions.clear();
        this.destroyedProjectiles.clear();
    }
    private updateEnemyPlayers(): void {
        for (const enemyPlayer of this.enemyPlayerStates) {
            if (!this.enemyGraphics.has(enemyPlayer.id)) {
                const graphic = new EnemyPlayer(enemyPlayer.id, enemyPlayer.x, enemyPlayer.y);
                this.app.stage.addChild(graphic);
                this.enemyGraphics.set(enemyPlayer.id, graphic);
            } else {
                const graphic = this.enemyGraphics.get(enemyPlayer.id);
                if (!graphic) continue;
                    
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
            this.self = new Player(this.app.screen.height);
            this.self.x = selfData.x;
            this.self.y = selfData.y;
            this.app.stage.addChild(this.self);
        }
        if (!this.self) return;

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

        this.self.syncPosition(selfData.x, selfData.y);
    }

    private setupGameLoop(): void {
        this.app.ticker.add(() => {
            if (this.self && this.gameActive) {
                // Only update self if it exists
                this.self.update(this.controller);
                this.handleShooting();
            }
            this.updateOwnProjectiles();
            this.cleanupPendingCollisions(); // Add cleanup to game loop
            this.cleanupDestroyedProjectiles();
            this.updateEnemyProjectiles();
            this.sendPlayerState();
        });

    }

    private handleShooting(): void {
        if (!this.self) return;
        if (this.controller.mouse.justReleased) {
            this.controller.mouse.justReleased = false;
            const target = { 
                x: this.controller.mouse.xR ?? 0,
                y: this.controller.mouse.yR ?? 0,
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
            console.log(`Player ${this.selfId} shot projectile at (${target.x}, ${target.y})`);
            console.log(`Player location when shooting: (${this.self.x}, ${this.self.y})`);
            console.log(`Projectile spawned at (${projectile.x}, ${projectile.y})`);
            target.id = projectile.getId();
            this.app.stage.addChild(projectile);
            this.ownProjectiles.push(projectile);
            this.socketManager.emit('shoot', target);
        }
    }

    private updateOwnProjectiles(): void {
        for (let i = this.ownProjectiles.length - 1; i >= 0; i--) {
            const projectile = this.ownProjectiles[i];
            projectile.update();


        // Check for collisions with enemy players
        for (const [enemyId, enemyGraphic] of this.enemyGraphics.entries()) {
            if (testForAABB(projectile, enemyGraphic)) {
                const bounds = enemyGraphic.getBounds();
                console.log(`projcetile ${projectile.getId()} hit enemy...`);
                console.log(`victim data when shot: x: ${bounds.x}, y: ${bounds.y}, width: ${bounds.width}, height: ${bounds.height}`);
                console.log(`victim location when shot: x: ${enemyGraphic.x}, y: ${enemyGraphic.y}`);
                // Record collision prediction
                // This is required so we can reject stateUpdates that likely haven't computed
                // the collision yet due to network latency
                this.totalCollisions.add(projectile.getId());
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

        if (projectile.shouldBeDestroyed) {
            this.ownProjectiles.splice(i, 1);
            projectile.destroy();
        }

            
        }
    }

    private updateEnemyProjectiles(): void {
        for (const [projectileId, projectile] of this.enemyProjectileGraphics.entries()) {
            projectile.update();

            // Check collision with self first
            if (this.self && testForAABB(projectile, this.self)) {
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
                    if (enemyId !== projectile.getOwnerId() && testForAABB(projectile, enemyGraphic)) {
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
            y: this.self.y
        });
    }
}