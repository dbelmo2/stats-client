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
import { Platform } from '../logic/Platform';
import { AmmoBox } from '../logic/objects/AmmoBox';

const PROJECTILE_SPEED = 30;
const PROJECTILE_LIFESPAN = 5000;
const PROJECTILE_GRAVITY = 0.05;

// TODO: fix issue where while the player is dead, enemy projectiles spawn
// but do not moved

// Address y mismatch based on screen height

// Address projectiles remaining on screen (motionless) after match ends

// After a match ends, enemy projectiles and friendly ones should continue to move
// but should not collide with players.

// Fix issue where after the match ends, and then begins again, an enemy ( and maybe self) 
// can start with low health. Once they take damage, the health bar updates to the correct value.
// There seems to be an issue with projectiles stopping and then resuming after match ends and restarts

type PlayerState = {
  id: string;
  x: number;
  y: number;
  hp: number;
  isBystander: boolean;
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

type GamePhase = 'initializing' | 'ready' | 'active' | 'ended';

export class GameManager {
    private static instance: GameManager;
    private app: Application;
    private socketManager: SocketManager;
    private controller: Controller;

    // Game objects & state
    private self: Player | undefined;
    private selfId: string = '';
    private ownProjectiles: Projectile[] = [];
    private enemyPlayerStates: PlayerState[] = [];
    private enemyGraphics: Map<string, EnemyPlayer> = new Map();
    private enemyProjectileGraphics: Map<string, EnemyProjectile> = new Map();
    private destroyedProjectiles: Map<string, number> = new Map();
    private pendingCollisions: Map<string, { projectileId: string, timestamp: number }> = new Map();
    private gamePhase: GamePhase = 'active';

    // Map displays &d
    private scoreDisplay: ScoreDisplay;
    private gameOverDisplay: GameOverDisplay | null = null;
    private ammoBox: AmmoBox;
    //private platform: Platform;
    
    private readonly COLLISION_TIMEOUT = 2000; // ms to wait before considering server missed collision

    private constructor(app: Application) {
        this.app = app;
        this.controller = new Controller();
        this.socketManager = new SocketManager('http://localhost:3000');
        this.scoreDisplay = new ScoreDisplay();
        this.app.stage.addChild(this.scoreDisplay);

        // Create platform
        //this.platform = new Platform(300, this.app.screen.height - 600);
        //this.app.stage.addChild(this.platform);


        // Create ammo box at right side of screen
        this.ammoBox = new AmmoBox(this.app.screen.width - 100, this.app.screen.height - 150);
        this.app.stage.addChild(this.ammoBox);


        // Add E key handler
        window.addEventListener('keydown', (e) => {
            if (e.key === 'e' || e.key === 'E') {
                this.controller.resetMouse()
                this.handleAmmoBoxInteraction();
            }
        });

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
            GameManager.instance.setupPlayer();
            GameManager.instance.setupGameLoop();
            await GameManager.instance.socketManager.waitForConnect();
            await GameManager.instance.setupNetworking();
            // After the first state update, we can start the game loop
        }
        return GameManager.instance;
    }

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
            this.controller.resetMouse();
            this.gamePhase = 'ended';
            this.pendingCollisions.clear(); // ????
            // Create and display game over screen
            this.gameOverDisplay = new GameOverDisplay(scores, this.selfId, this.app);
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
        this.self = new Player(this.app.screen.height);
        // Set up platform references
        //this.self.setPlatforms([this.platform]);
        // Add to stage
        this.app.stage.addChild(this.self);
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
        this.updateEnemyPlayers(); // TODO: Move? this cleans up pending collisions but is only called when stateUpdate is received
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

        // Clear all remaining state
        this.pendingCollisions.clear();
        this.destroyedProjectiles.clear();


    }
    private updateEnemyPlayers(): void {
        // TODO: Figure out why this isnt invoked after match ends

        for (const enemyPlayer of this.enemyPlayerStates) {
            if (!this.enemyGraphics.has(enemyPlayer.id)) {
                // This doesn't trigger when match ends and player respawns immediately
                console.log(`Adding new enemy player ${enemyPlayer.id} to stage`);
                const graphic = new EnemyPlayer(enemyPlayer.id, enemyPlayer.x, enemyPlayer.y, enemyPlayer.isBystander);
                this.app.stage.addChild(graphic);
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
            this.self = new Player(this.app.screen.height);
            this.self.x = selfData.x;
            this.self.y = selfData.y;
            this.self.setIsBystander(selfData.isBystander);
            this.app.stage.addChild(this.self);
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
        this.self.syncPosition(selfData.x, selfData.y);
    }

    private setupGameLoop(): void {
        this.app.ticker.add(() => {
            
            if (this.self) {
                this.self.update(this.controller);
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
            y: this.self.y
        });
    }
}