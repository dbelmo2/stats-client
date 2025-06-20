import { Graphics, Container, Text, TextStyle } from 'pixi.js';
import { Platform } from './Platform';
import { Vector2 } from './Vector';


export interface PendingInput {
  seq: number; 
  tick: number;
  mask: number;
}


export class Player extends Container {
  public readonly SPEED = 750;
  public readonly JUMP_STRENGTH = 750;
  public readonly GRAVITY = 1500;
  public readonly MAX_FALL_SPEED = 1500

  private velocity: Vector2;
  private canDoubleJump = true;
  private healthBar: Graphics;
  private maxHealth: number = 100;
  private serverHealth: number = 100;
  private predictedHealth: number = 100;
  private readonly HEALTH_BAR_WIDTH = 50;
  private readonly HEALTH_BAR_HEIGHT = 5;
  private damageFlashTimeout?: NodeJS.Timeout;
  private healthBarContainer: Container;
  private platforms: Platform[] = [];
  private isBystander: boolean = true;
  private isOnSurface: boolean = false;
  private body: Graphics;
  private gameBounds: { left: number; right: number; top: number; bottom: number } | null = null;
  private nameText: Text;
  private inputInterval: NodeJS.Timeout | null = null;
  private lastProcessedInputVector: Vector2 = new Vector2(0, 0);



  constructor(x: number, y: number, gameBounds: any, name: string) {
    super();
    this.gameBounds = gameBounds;
    this.velocity = new Vector2(0, 0);
    this.body = new Graphics().rect(0, 0, 50, 50).fill(0x228B22);
    this.addChild(this.body);
    // Create separate container for UI elements
    this.healthBarContainer = new Container();
    this.addChild(this.healthBarContainer);

    // Create name text
    const nameStyle = new TextStyle({
        fontFamily: 'Arial',
        fontSize: 14,
        fill: 0xFFFFFF,
        align: 'center'
    });


    this.nameText = new Text({ text: name, style: nameStyle });
    this.nameText.x = this.body.width / 2; // Center the text
    this.nameText.anchor.set(0.5, 1); // Center horizontally, align bottom
    this.nameText.y = -20; // Position above health bar
    this.healthBarContainer.addChild(this.nameText);


  

    // Create health bar background
    const healthBarBg = new Graphics()
      .rect(0, -15, this.HEALTH_BAR_WIDTH, this.HEALTH_BAR_HEIGHT)
      .fill(0x333333);
    this.healthBarContainer.addChild(healthBarBg);

    // Create health bar
    this.healthBar = new Graphics();
    this.updateHealthBar();
    this.healthBarContainer.addChild(this.healthBar);

    // Set pivot to bottom center for better physics alignment
    this.pivot.set(25, 50); // half width, full height

    // Start on the floor
    this.x = x;
    this.y = y;

  }

  public setIsBystander(value: boolean): void {
      this.isBystander = value;
      this.body.clear();
      this.body.rect(0, 0, 50, 50).fill(this.isBystander ? 0x808080 : 0x228B22);
  }

  public getIsBystander(): boolean {
      return this.isBystander;
  }

  private updateHealthBar(): void {
      this.healthBar.clear();
      const healthPercentage = this.predictedHealth / this.maxHealth;
      const barWidth = this.HEALTH_BAR_WIDTH * healthPercentage;
      
      // Health bar colors based on remaining health
      let color = 0x00ff00; // Green
      if (healthPercentage < 0.6) color = 0xffff00; // Yellow
      if (healthPercentage < 0.3) color = 0xff0000; // Red

      this.healthBar
        .rect(0, -15, barWidth, this.HEALTH_BAR_HEIGHT)
        .fill(color);
  }

  public revertPrediction(): void {
      // Revert to server-authoritative health
      this.predictedHealth = this.serverHealth;
      this.updateHealthBar();
  }

  public getPositionVector(): Vector2 {
      return new Vector2(this.x, this.y);
  }

  public getLastProcessedInputVector(): Vector2 {
      return this.lastProcessedInputVector;
  }

  public setLastProcessedInputVector(inputVector: Vector2): void {
      this.lastProcessedInputVector = inputVector;
  } 
  
  
  public setPlatforms(platforms: Platform[]) {
      this.platforms = platforms;
  }

  public syncPosition(x: number, y: number, vx: number, vy: number) {
    this.x = x; // Update temporary position for physics calculations
    this.y = y; // Update temporary position for physics calculations
    this.velocity.y = vy;
    this.velocity.x = vx; // Update velocity based on server data
    //console.log(`Syncing position to (${x}, ${y}) with velocity (${vx}, ${vy})`);
  }


  

  private isJumping = false;
  private indexPostJump = 0

  update(inputVector: Vector2, dt: number, isResimulating: boolean = false, localTick: number): void {
      //console.log('localTick', localTick, 'inputVector', inputVector);
      if (isResimulating) {
        this.body.clear();
        this.body.rect(0, 0, 50, 50).fill(0xff0000);
      } else {
        this.body.clear();
        this.body.rect(0, 0, 50, 50).fill(0x228B22);
      }
      // 1. First we update our velocity vector based on input and physics.
      // Horizontal Movement
      if (inputVector.x !== 0) {
        //inputVector.normalize();
        this.velocity.x = inputVector.x * this.SPEED;
      } else {
        this.velocity.x = 0;
      }

      // Jumping
      if ((inputVector.y < 0 && this.isOnSurface) || (inputVector.y < 0 && this.canDoubleJump)) {
          this.jump(inputVector);
      }



      // Gravity
      this.applyGravity(dt);

      // 2. Once the velocity is updated, we calculate the new position.
      const newX = this.x + (this.velocity.x * dt);
      const newY = this.y + (this.velocity.y * dt);

      // 3. Now we clamp the position to the game bounds.
      const { clampedX, clampedY } = this.getClampedPosition(newX, newY);
      this.x = clampedX;
      this.y = clampedY;

      if (this.y === this.gameBounds?.bottom) {
          this.canDoubleJump = true; // Reset double jump when on ground
          this.velocity.y = 0; // Reset vertical velocity when on ground
          this.isJumping = false; // Reset jumping state
          this.indexPostJump = 0; // Reset post-jump index
          this.isOnSurface = true; // Set surface state when on ground
      }

      if (this.isJumping && inputVector.y === 0 && inputVector.x === 0) {
        this.indexPostJump++;
        //console.log(`${isResimulating ? 'RES: ' : ''}Player coordinates ${this.indexPostJump} ticks after jump: ${this.x}, ${this.y}. Vy=${this.velocity.y}. local tick: ${localTick}`);
      }

      // Check platform collisions
      const { isOnPlatform, platformTop } = this.checkPlatformCollisions();            
      if (isOnPlatform && platformTop !== null) {
          this.y = platformTop;
          this.velocity.y = 0;
          this.isOnSurface = true;
      }
    
    
  }


  applyGravity(dt: number): void {
      this.velocity.y += this.GRAVITY * dt;
      this.velocity.y = Math.min(this.velocity.y, this.MAX_FALL_SPEED); 
  }

  jump(inputVector: Vector2): void {
      this.velocity.y = inputVector.y * this.JUMP_STRENGTH;
      this.canDoubleJump = this.isOnSurface;
      this.isOnSurface = false; // Player is no longer on the ground
      this.isJumping = true; // Set jumping state
  }

  getClampedPosition(newX: number, newY: number): { clampedX: number; clampedY: number } {
      if (this.gameBounds) {
        return {
          clampedX: Math.max(this.gameBounds.left + 25, Math.min(newX, this.gameBounds.right - 25)), // 50 is the width of the player
          clampedY: Math.max(this.gameBounds.top, Math.min(newY, this.gameBounds.bottom)) // 50 is the height of the player
        }
      } else {
        return {
          clampedX: newX,
          clampedY: newY
        };
      }
  }


  checkPlatformCollisions(): { isOnPlatform: boolean; platformTop: number | null } {
      for (const platform of this.platforms) {
        const platformBounds = platform.getPlatformBounds();
        const playerBounds = this.getPlayerBounds();
        
        // Check for platform collision with tunneling prevention
        const isGoingDown = this.velocity.y > 0;
        const isOnPlatform = playerBounds.bottom === platformBounds.top;
        const isFallingThroughPlatform = playerBounds.bottom > platformBounds.top && 
          playerBounds.bottom < platformBounds.bottom;

        const isWithinPlatformWidth = playerBounds.right > platformBounds.left && 
          playerBounds.left < platformBounds.right;
        

        //console.log(`Player bottom ${playerBounds.bottom} Platform top ${platformBounds.top}, Velocity Y ${this.velocity.y}`);
        // Check if we're falling, were above platform last frame, and are horizontally aligned
          
        // Check if we're falling, were above platform last frame, and are horizontally aligned
        if (isGoingDown && isWithinPlatformWidth && (isOnPlatform || isFallingThroughPlatform)) {
            return { isOnPlatform: true, platformTop: platformBounds.top };
        }
      }
      
      return { isOnPlatform: false, platformTop: null };  
  }


  setHealth(updatedServerHealth: number): void {
      this.serverHealth = updatedServerHealth;
      // Only lower predicted health if server health is lower
      // NOTE: this will likely break if health regen is introduced
  
      if (updatedServerHealth < this.predictedHealth) {
          this.predictedHealth = updatedServerHealth;
      }
      this.updateHealthBar();
  }

  getServerHealth(): number {
    return this.serverHealth;
  }

  getPredictedHealth(): number {
    return this.predictedHealth;
  }

  damage(amount: number = 10) {
    this.predictedHealth = Math.max(0, this.predictedHealth - amount);
    this.updateHealthBar();

    // Flash effect
    this.body.clear();
    this.body.rect(0, 0, 50, 50).fill(0xff0000);


    this.damageFlashTimeout = setTimeout(() => {
        this.body.clear();
        this.body.rect(0, 0, 50, 50).fill(0x228B22);
    }, 100);
  }



  destroy(): void {
    // Clear any pending timeouts
    if (this.damageFlashTimeout) {
        clearTimeout(this.damageFlashTimeout);
    }

    if (this.inputInterval) {
        clearInterval(this.inputInterval);
    }

    // Clean up graphics
    this.body.destroy();
    this.healthBar.destroy();
    this.nameText.destroy();
    this.healthBarContainer.destroy();


    // Call parent destroy method
    super.destroy({
        children: true,
        texture: true
    });
  }

getVelocityY() {
    return this.velocity.y;
}

getPlayerBounds() {
    // Use local coordinates that don't include camera movement
    return {
        left: this.x - this.pivot.x,
        right: this.x - this.pivot.x + 50, // width
        top: this.y - this.pivot.y,
        bottom: this.y - this.pivot.y + 50, // height
        width: 50,
        height: 50
    };
}

  getBounds() {
    return this.body.getBounds();
  }

}
