import { Application } from 'pixi.js';
import { Player } from '../logic/Player';
import { Controller } from '../logic/controller';
import { SocketManager } from '../network/SocketManager';
import { EnemyPlayer } from '../logic/EnemyPlayer';
import { Projectile } from '../logic/Projectile';
import { EnemyProjectile } from '../logic/EnemyProjectile';



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

export class GameManager {
    private static instance: GameManager;
    private app: Application;
    private socketManager: SocketManager;
    private controller: Controller;
    private self: Player;
    private selfId: string = '';
    
    private ownProjectiles: Projectile[] = [];
    private enemyPlayerStates: PlayerState[] = [];
    private enemyGraphics: Map<string, EnemyPlayer> = new Map();
    private enemyProjectileGraphics: Map<string, EnemyProjectile> = new Map();

    private constructor(app: Application) {
        this.app = app;
        this.controller = new Controller();
        this.socketManager = new SocketManager('http://localhost:3000');
        this.self = new Player(app.screen.height);

    }

    public static async initialize(app: Application): Promise<GameManager> {
        if (!GameManager.instance) {
            GameManager.instance = new GameManager(app);
            await GameManager.instance.socketManager.waitForConnect();
            GameManager.instance.setupPlayer();
            GameManager.instance.setupNetworking();
            GameManager.instance.setupGameLoop();
        }
        return GameManager.instance;
    }

    private setupPlayer(): void {
        this.self.x = 400;
        this.self.y = 300;
        this.app.stage.addChild(this.self);
    }

    private setupNetworking(): void {
        const id = this.socketManager.getId();
        if (!id) throw new Error('Socket ID is undefined');
        this.selfId = id;
        this.socketManager.joinQueue('NA');
        
        this.socketManager.on('stateUpdate', this.handleStateUpdate.bind(this));
    }

    private handleStateUpdate({ players, projectiles }: { players: PlayerState[], projectiles: ProjectileState[] }): void {
        this.enemyPlayerStates = players.filter(player => player.id !== this.selfId);
        console.log(`Number projectiles active: ${projectiles.length}`);
        this.handleProjectileUpdates(projectiles);
        this.updateEnemyPlayers();
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

        // Clean up own projectiles
        for (let i = this.ownProjectiles.length - 1; i >= 0; i--) {
            const projectile = this.ownProjectiles[i];
            if (!activeIds.has(projectile.getId())) {
                console.log('destroying projectile due to stateUpdate', projectile.getId());
                this.app.stage.removeChild(projectile);
                projectile.destroy();
                this.ownProjectiles.splice(i, 1);
            }
        }
    }

    private updateProjectiles(projectiles: ProjectileState[]): void {
        for (const projectile of projectiles) {
            if (!this.enemyProjectileGraphics.has(projectile.id) && projectile.ownerId !== this.selfId) {
                const graphic = new EnemyProjectile(projectile.x, projectile.y, projectile.vx, projectile.vy);
                this.app.stage.addChild(graphic);
                this.enemyProjectileGraphics.set(projectile.id, graphic);
            }
        }
    }

    private updateEnemyPlayers(): void {
        for (const enemyPlayer of this.enemyPlayerStates) {
            if (!this.enemyGraphics.has(enemyPlayer.id)) {
                const graphic = new EnemyPlayer(enemyPlayer.x, enemyPlayer.y);
                this.app.stage.addChild(graphic);
                this.enemyGraphics.set(enemyPlayer.id, graphic);
            } else {
                const graphic = this.enemyGraphics.get(enemyPlayer.id);
                graphic?.syncPosition(enemyPlayer.x, enemyPlayer.y);
                graphic?.setHealth(enemyPlayer.hp);
            }
        }
    }

    private setupGameLoop(): void {
        this.app.ticker.add(() => {
            this.self.update(this.controller);
            this.handleShooting();
            this.updateOwnProjectiles();
            this.updateEnemyProjectiles();
            this.sendPlayerState();
        });
    }

    private handleShooting(): void {
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
                5,
                5000,
                0.05,
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
            if (projectile.shouldBeDestroyed) {
                this.ownProjectiles.splice(i, 1);
                projectile.destroy();
            }
        }
    }

    private updateEnemyProjectiles(): void {
        for (const graphic of this.enemyProjectileGraphics.values()) {
            graphic.update();
        }
    }

    private sendPlayerState(): void {
        this.socketManager.emit('playerInput', {
            x: this.self.x,
            y: this.self.y
        });
    }
}