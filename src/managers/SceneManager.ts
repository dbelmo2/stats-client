import { Application, Container, Graphics, Sprite } from 'pixi.js';
import { Platform } from '../components/game/Platform';
import { AmmoBush } from '../components/game/AmmoBush';
import { TvManager } from './TvManager';
import type { SocketManager } from './SocketManager';
import type { WorldObjects } from '../types/game.types';

export interface SceneConfig {
    GAME_WIDTH: number;
    GAME_HEIGHT: number;
    GAME_BOUNDS: {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };
}

export interface BackgroundAssets {
    j1: Sprite;
    j2: Sprite;
    j3: Sprite;
    j4: Sprite;
}

export class SceneManager {
    private static instance: SceneManager;
    
    private app: Application;
    private config: SceneConfig;
    private gameContainer: Container;
    private world: WorldObjects;
    
    // Background components
    private backgroundContainer: Container;
    private grassSprites: Sprite[] = [];
    
    private constructor() {}
    
    public static getInstance(): SceneManager {
        if (!SceneManager.instance) {
            SceneManager.instance = new SceneManager();
        }
        return SceneManager.instance;
    }
    
    /**
     * Initialize the scene manager
     */
    public initialize(
        app: Application, 
        config: SceneConfig, 
        gameContainer: Container, 
        socketManager: SocketManager
    ): WorldObjects {
        this.app = app;
        this.config = config;
        this.gameContainer = gameContainer;
        
        // Initialize world objects
        this.world = {
            platforms: [],
            ammoBush: undefined as unknown as AmmoBush,
            backgroundAssets: {}
        };
        
        this.setupScene(socketManager);
        return this.world;
    }
    
    /**
     * Main scene setup orchestration
     */
    private setupScene(socketManager: SocketManager): void {
        this.createBackground();
        this.setupParallaxBackground();
        this.createPlatforms();
        this.createAmmoBush(socketManager);
        this.initializeTvManager();
    }
    
    /**
     * Create the main background elements
     */
    private createBackground(): void {
        this.backgroundContainer = new Container();
        
        // Create extended background areas
        const leftBgTop = new Graphics()
            .rect(-this.config.GAME_WIDTH, this.config.GAME_HEIGHT, this.config.GAME_WIDTH, this.config.GAME_HEIGHT + 500)
            .fill('#1C252A');
        
        const bottomBg = new Graphics()
            .rect(0, this.config.GAME_HEIGHT, this.config.GAME_WIDTH * 2, 500)
            .fill('#1D252A');
        
        this.backgroundContainer.addChild(leftBgTop);
        this.backgroundContainer.addChild(bottomBg);
        
        // Add decorative elements
        this.addDecorations(bottomBg);
        
        // Create grass ground
        this.createGrass(bottomBg);
        
        // Add background to game container
        this.gameContainer.addChild(this.backgroundContainer);
    }
    
    /**
     * Add decorative elements to the background
     */
    private addDecorations(bottomBg: Graphics): void {
        // Bush decoration
        const bush = Sprite.from('bush');
        bush.anchor.set(1, -1);
        bush.y = bush.y + 352;
        bush.x = bush.x - 200;
        
        // Bush tree decoration
        const bushTree = Sprite.from('bushTree');
        bushTree.anchor.set(0, 0);
        bushTree.x = this.config.GAME_WIDTH - 650;
        bushTree.y = -250;
        
        bottomBg.addChild(bush);
        bottomBg.addChild(bushTree);
    }
    
    /**
     * Create grass ground tiles
     */
    private createGrass(bottomBg: Graphics): void {
        const grassHeight = this.config.GAME_HEIGHT - 47;
        const grassTileWidth = 320; // Approximate width of grass tile
        const startX = -960;
        const numberOfTiles = 8;
        
        this.grassSprites = [];
        
        for (let i = 0; i < numberOfTiles; i++) {
            const grass = Sprite.from('grassOne');
            grass.anchor.set(0, 0);
            grass.zIndex = 100; // Ensure grass is on top of background
            grass.x = startX + (i * grassTileWidth);
            grass.y = grassHeight;
            
            this.grassSprites.push(grass);
            bottomBg.addChild(grass);
        }
    }
    
    /**
     * Setup parallax background layers
     */
    private setupParallaxBackground(): void {
        // Create background sprites
        const j1Sprite = Sprite.from('j1');
        j1Sprite.x = 0 - this.config.GAME_WIDTH / 2;
        j1Sprite.y = 0;
        
        const j2Sprite = Sprite.from('j2');
        j2Sprite.x = 0 - this.config.GAME_WIDTH / 5;
        j2Sprite.y = 0;
        
        const j3Sprite = Sprite.from('j3');
        j3Sprite.x = 0 - this.config.GAME_WIDTH / 2;
        j3Sprite.y = 0;
        
        const j4Sprite = Sprite.from('j4');
        j4Sprite.x = 0;
        j4Sprite.y = 0;
        
        // Add to stage in correct order (back to front)
        this.app.stage.addChild(j4Sprite);
        this.app.stage.addChild(j3Sprite);
        this.app.stage.addChild(j2Sprite);
        this.app.stage.addChild(j1Sprite);
        
        // Store references
        this.world.backgroundAssets = {
            j1: j1Sprite,
            j2: j2Sprite,
            j3: j3Sprite,
            j4: j4Sprite,
        };
    }
    
    /**
     * Create game platforms
     */
    private createPlatforms(): void {
        const platformConfigs = [
            { x: 115, y: this.config.GAME_HEIGHT - 250, type: 'two' as const },
            { x: this.config.GAME_WIDTH - 610, y: this.config.GAME_HEIGHT - 250, type: 'one' as const },
            { x: 115, y: this.config.GAME_HEIGHT - 500, type: 'one' as const },
            { x: this.config.GAME_WIDTH - 610, y: this.config.GAME_HEIGHT - 500, type: 'two' as const },
        ];
        
        this.world.platforms = [];
        
        for (const config of platformConfigs) {
            const platform = new Platform(config.x, config.y, config.type);
            this.world.platforms.push(platform);
            this.gameContainer.addChild(platform);
        }
    }
    
    /**
     * Create ammo bush
     */
    private createAmmoBush(socketManager: SocketManager): void {
        this.world.ammoBush = new AmmoBush(-100, this.config.GAME_HEIGHT, socketManager);
        this.gameContainer.addChild(this.world.ammoBush);
    }
    
    /**
     * Initialize TV Manager
     */
    private initializeTvManager(): void {
        if (this.world.backgroundAssets.j1) {
            TvManager.getInstance().initialize(
                this.world.backgroundAssets.j1, 
                this.config.GAME_WIDTH, 
                this.config.GAME_HEIGHT
            );
        }
    }
    
    /**
     * Update parallax background based on camera movement
     */
    public updateParallaxBackground(offsetX: number, offsetY: number): void {
        if (!this.world.backgroundAssets) return;
        
        const { j1, j2, j3, j4 } = this.world.backgroundAssets;
        
        if (j1) {
            j1.x += offsetX * 0.4;
            j1.y += offsetY * 0.4;
        }
        
        if (j2) {
            j2.x += offsetX * 0.3;
            j2.y += offsetY * 0.3;
        }
        
        if (j3) {
            j3.x += offsetX * 0.2;
            j3.y += offsetY * 0.2;
        }
        
        // j4 stays static (furthest background layer)
    }
    
    /**
     * Get all platforms for collision detection
     */
    public getPlatforms(): Platform[] {
        return this.world.platforms;
    }
    
    /**
     * Get ammo bush reference
     */
    public getAmmoBush(): AmmoBush {
        return this.world.ammoBush;
    }
    
    /**
     * Get background assets for external manipulation
     */
    public getBackgroundAssets(): BackgroundAssets {
        return this.world.backgroundAssets as BackgroundAssets;
    }
    
    /**
     * Add custom platform at runtime
     */
    public addPlatform(x: number, y: number, type: 'one' | 'two'): Platform {
        const platform = new Platform(x, y, type);
        this.world.platforms.push(platform);
        this.gameContainer.addChild(platform);
        return platform;
    }
    
    /**
     * Remove platform at runtime
     */
    public removePlatform(platform: Platform): boolean {
        const index = this.world.platforms.indexOf(platform);
        if (index !== -1) {
            this.world.platforms.splice(index, 1);
            this.gameContainer.removeChild(platform);
            platform.destroy();
            return true;
        }
        return false;
    }
    
    /**
     * Get scene bounds for camera calculations
     */
    public getSceneBounds(): typeof this.config.GAME_BOUNDS {
        return this.config.GAME_BOUNDS;
    }
    
    /**
     * Cleanup scene resources
     */
    public cleanup(): void {
        // Clean up platforms
        for (const platform of this.world.platforms) {
            this.gameContainer.removeChild(platform);
            platform.destroy();
        }
        this.world.platforms = [];
        
        // Clean up ammo bush
        if (this.world.ammoBush) {
            this.gameContainer.removeChild(this.world.ammoBush);
            this.world.ammoBush.destroy();
        }
        
        // Clean up background assets
        const { j1, j2, j3, j4 } = this.world.backgroundAssets;
        [j1, j2, j3, j4].forEach(sprite => {
            if (sprite && this.app.stage.children.includes(sprite)) {
                this.app.stage.removeChild(sprite);
                sprite.destroy();
            }
        });
        
        // Clean up grass sprites
        this.grassSprites.forEach(grass => {
            grass.destroy();
        });
        this.grassSprites = [];
        
        // Clean up background container
        if (this.backgroundContainer) {
            this.gameContainer.removeChild(this.backgroundContainer);
            this.backgroundContainer.destroy();
        }
        
        // Reset world objects
        this.world = {
            platforms: [],
            ammoBush: undefined as unknown as AmmoBush,
            backgroundAssets: {}
        };
    }
    
    /**
     * Resize scene elements when window resizes
     */
    public handleResize(newWidth: number, newHeight: number): void {
        // Update any responsive elements here
        console.log(`Scene resized to: ${newWidth}x${newHeight}`);
        
        // Update config if needed
        // this.config.GAME_WIDTH = newWidth;
        // this.config.GAME_HEIGHT = newHeight;
    }
    
    /**
     * Debug method to visualize scene bounds
     */
    public showDebugBounds(): void {
        const debugGraphics = new Graphics()
            .rect(this.config.GAME_BOUNDS.left, this.config.GAME_BOUNDS.top, 
                  this.config.GAME_BOUNDS.right - this.config.GAME_BOUNDS.left,
                  this.config.GAME_BOUNDS.bottom - this.config.GAME_BOUNDS.top)
            .stroke({ color: 0xff0000, width: 2 });
        
        this.gameContainer.addChild(debugGraphics);
        
        // Remove after 5 seconds
        setTimeout(() => {
            this.gameContainer.removeChild(debugGraphics);
            debugGraphics.destroy();
        }, 5000);
    }
}