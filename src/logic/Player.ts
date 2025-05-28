import { Graphics, Container, Text, TextStyle } from 'pixi.js';
import { Controller } from './Controller'
import { Platform } from './Platform';


export interface PendingInput {
  seq: number; 
  tick: number;
  mask: number;
}

export class Player extends Container {
  private speed = 10;
  private jumpStrength = 15;
  private gravity = 0.6;
  private velocityY = 0;
  private isOnGround = false;
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
  private body: Graphics;
  private gameBounds: { left: number; right: number; top: number; bottom: number } | null = null;
  private nameText: Text;
  private maxAccelerationY: number = 9.8; // Max acceleration when moving left/right
  private lastUpdateTime: number = Date.now();
  private TIME_STEP: number = 20; // 60 FPS
  private accumulator = 0;
  private inputInterval: NodeJS.Timeout | null = null;
  private pendingInputs: PendingInput[] = [];
  private controller: Controller;
  private tempX: number = 0;
  private tempY: number = 0;

  constructor(x: number, y: number, gameBounds: any, name: string, controller: Controller) {
    super();
    this.controller = controller;
    this.gameBounds = gameBounds;
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
    this.tempX = x; // Temporary position for physics calculations
    this.y = y;
    this.tempY = y; // Temporary position for physics calculations

  }

  public applyMaskFromTick(tick: number) {
    for (let i = this.pendingInputs.length - 1; i >= 0; i--) {
      const input = this.pendingInputs[i];
      if (input.tick <= tick) {
        // Apply the mask to the controller
        this.controller.updateFromBitmask(input.mask);
        // Remove the input from pending inputs
        this.pendingInputs.splice(i, 1);
      }
    }
  }
  
  public addPendingInput(input: PendingInput): void {
      this.pendingInputs.push(input);
  }

  public setIsBystander(value: boolean): void {
      this.isBystander = value;
      // Change color based on bystander status
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

  public setPlatforms(platforms: Platform[]) {
      this.platforms = platforms;
  }

 // TODO: figure out why Use of tempX Nd tempY here along with reUpdate leads to desync...
  syncPosition(x: number, y: number) {
    this.x = x; // Update temporary position for physics calculations
    this.y = y; // Update temporary position for physics calculations
  }


  public updatecount = 0;
  public isMoving = false;



  reUpdate() {
      if (!this.controller.keys.left.pressed && !this.controller.keys.right.pressed) {
        this.isMoving = false;
        if (this.updatecount > 0) { 

        }
        this.updatecount = 0;
      }

      // Apply normalized movement
      if (this.controller.keys.left.pressed) {
          let xPos = Math.max(this.gameBounds?.left ?? 0, this.tempX - this.speed);
          if (xPos <= 25) xPos = 25; // This is needed for cube sprites as their pivot is the center.
          this.tempX = xPos;
          this.isMoving = true;
      }
      if (this.controller.keys.right.pressed) {
          let xPos = Math.min(this.gameBounds?.right ?? Infinity, this.tempX + this.speed);
          if (xPos >= (this.gameBounds?.right ?? 0) - 25) xPos = (this.gameBounds?.right ?? 0) - 25; // This is needed for cube sprites as their pivot is the center.
          this.tempX = xPos;
          this.isMoving = true;

      }

      if (this.isMoving) {
          this.updatecount++;
      }

      const wasOnGround = this.isOnGround;

      // Jumping from ground or platform
      if ((this.controller.keys.space.pressed || this.controller.keys.up.pressed) && this.isOnGround) {
        this.velocityY = -this.jumpStrength;
        this.isOnGround = false;

        // Reset double tap flags to prevent immediate double jump
        this.controller.keys.space.doubleTap = false;
        this.controller.keys.up.doubleTap = false;
      }

      // Double jump logic, utilizes doubleJump from the controller. 
      // Might need to tweak the doubleJump time window in the controller depending on jump animation time duration. 
      if (!this.isOnGround && this.canDoubleJump) {
        if (this.controller.keys.space.doubleTap || this.controller.keys.up.doubleTap) {
          this.velocityY = -this.jumpStrength;
          this.canDoubleJump = false;
          // Clear double tap flags after use
          this.controller.keys.space.doubleTap = false;
          this.controller.keys.up.doubleTap = false;
        }
      }


      // Apply gravity
      this.velocityY += this.gravity;
      this.velocityY = Math.min(this.velocityY, this.maxAccelerationY); // Limit max fall speed
      this.tempY += this.velocityY;

      // Check vertical bounds
      if (this.gameBounds) {
          // Floor collision
          if (this.tempY >= this.gameBounds.bottom) {
              this.tempY = this.gameBounds.bottom;
              this.velocityY = 0;
              this.isOnGround = true;
              this.canDoubleJump = true; // Reset double jump when on ground
          }

          // Ceiling collision
          if (this.tempY <= this.gameBounds.top) {
              this.tempY = this.gameBounds.top;
              this.velocityY = 0;
          }
      }
      
      // Floor collision
      let isOnSurface = this.isOnGround;

      // Check platform collisions
      for (const platform of this.platforms) {
      const platformBounds = platform.getPlatformBounds();
      const playerBounds = this.getPlayerBounds();
      
      // Calculate the previous position based on velocity
      const prevBottom = playerBounds.bottom - this.velocityY;
      
      // Check for platform collision with tunneling prevention
      const isGoingDown = this.velocityY > 0;
      const wasAbovePlatform = prevBottom <= platformBounds.top;
      const isWithinPlatformWidth = playerBounds.right > platformBounds.left && 
      playerBounds.left < platformBounds.right;
      const hasCollidedWithPlatform = playerBounds.bottom >= platformBounds.top;
      
      // Check if we're falling, were above platform last frame, and are horizontally aligned
      if (isGoingDown && wasAbovePlatform && isWithinPlatformWidth && hasCollidedWithPlatform) {
          this.tempY = platformBounds.top;
          this.velocityY = 0;
          isOnSurface = true;
          break;
      }
      }

      this.isOnGround = isOnSurface;
      if (isOnSurface && !wasOnGround) {
          this.canDoubleJump = true;
      }
  }

  applyTempPosition() {
    // Apply the temporary position to the player
    this.x = this.tempX;
    this.y = this.tempY;

    // Reset temporary position for next frame
    this.tempX = this.x;
    this.tempY = this.y;
  }

  update() {
    const now = Date.now();
    const frameTime = now - this.lastUpdateTime;
    this.lastUpdateTime = now;
    
    // Cap maximum frame time to prevent spiral of death on slow devices
    const cappedFrameTime = Math.min(frameTime, 100); 
    
    // Add elapsed time to accumulator
    this.accumulator += cappedFrameTime;
    
    while (this.accumulator >= this.TIME_STEP) {
      if (!this.controller.keys.left.pressed && !this.controller.keys.right.pressed) {
        this.isMoving = false;
        if (this.updatecount > 0) { 

        }
        this.updatecount = 0;
      }

      // Apply normalized movement
      if (this.controller.keys.left.pressed) {
          let xPos = Math.max(this.gameBounds?.left ?? 0, this.x - this.speed);
          if (xPos <= 25) xPos = 25; // This is needed for cube sprites as their pivot is the center.
          this.x = xPos;
          this.tempX = xPos;
          this.isMoving = true;
      }
      if (this.controller.keys.right.pressed) {
          let xPos = Math.min(this.gameBounds?.right ?? Infinity, this.x + this.speed);
          if (xPos >= (this.gameBounds?.right ?? 0) - 25) xPos = (this.gameBounds?.right ?? 0) - 25; // This is needed for cube sprites as their pivot is the center.
          this.x = xPos;
          this.tempX = xPos;
          this.isMoving = true;

      }

      if (this.isMoving) {
          this.updatecount++;
      }

      const wasOnGround = this.isOnGround;

      // Jumping from ground or platform
      if ((this.controller.keys.space.pressed || this.controller.keys.up.pressed) && this.isOnGround) {
        this.velocityY = -this.jumpStrength;
        this.isOnGround = false;

        // Reset double tap flags to prevent immediate double jump
        this.controller.keys.space.doubleTap = false;
        this.controller.keys.up.doubleTap = false;
      }

      // Double jump logic, utilizes doubleJump from the controller. 
      // Might need to tweak the doubleJump time window in the controller depending on jump animation time duration. 
      if (!this.isOnGround && this.canDoubleJump) {
        if (this.controller.keys.space.doubleTap || this.controller.keys.up.doubleTap) {
          this.velocityY = -this.jumpStrength;
          this.canDoubleJump = false;
          // Clear double tap flags after use
          this.controller.keys.space.doubleTap = false;
          this.controller.keys.up.doubleTap = false;
        }
      }


      // Apply gravity
      this.velocityY += this.gravity;
      this.velocityY = Math.min(this.velocityY, this.maxAccelerationY); // Limit max fall speed
      this.y += this.velocityY;

      // Check vertical bounds
      if (this.gameBounds) {
          // Floor collision
          if (this.y >= this.gameBounds.bottom) {
              this.y = this.gameBounds.bottom;
              this.tempY = this.y; // Update temporary position
              this.velocityY = 0;
              this.isOnGround = true;
              this.canDoubleJump = true; // Reset double jump when on ground
          }

          // Ceiling collision
          if (this.y <= this.gameBounds.top) {
              this.y = this.gameBounds.top;
              this.tempY = this.y; // Update temporary position
              this.velocityY = 0;
          }
      }
      
      // Floor collision
      let isOnSurface = this.isOnGround;

      // Check platform collisions
      for (const platform of this.platforms) {
      const platformBounds = platform.getPlatformBounds();
      const playerBounds = this.getPlayerBounds();
      
      // Calculate the previous position based on velocity
      const prevBottom = playerBounds.bottom - this.velocityY;
      
      // Check for platform collision with tunneling prevention
      const isGoingDown = this.velocityY > 0;
      const wasAbovePlatform = prevBottom <= platformBounds.top;
      const isWithinPlatformWidth = playerBounds.right > platformBounds.left && 
      playerBounds.left < platformBounds.right;
      const hasCollidedWithPlatform = playerBounds.bottom >= platformBounds.top;
      
      // Check if we're falling, were above platform last frame, and are horizontally aligned
      if (isGoingDown && wasAbovePlatform && isWithinPlatformWidth && hasCollidedWithPlatform) {

          this.y = platformBounds.top;
          this.tempY = this.y; // Update temporary position
          this.velocityY = 0;
          isOnSurface = true;
          break;
      }
      }

      this.isOnGround = isOnSurface;
      if (isOnSurface && !wasOnGround) {
          this.canDoubleJump = true;
      }


      this.accumulator -= this.TIME_STEP;
    }
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
    return this.velocityY;
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
