import { Graphics, Container } from 'pixi.js';
import { Controller } from './Controller'

export class Player extends Container {
  private speed = 4;
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


  private body: Graphics;

  private readonly FLOOR_Y: number;

  constructor(screenHeight: number) {
    super();

    this.FLOOR_Y = screenHeight - 100;

    this.body = new Graphics().rect(0, 0, 50, 50).fill(0x228B22);
    this.addChild(this.body);

    // Create separate container for UI elements
    this.healthBarContainer = new Container();
    this.addChild(this.healthBarContainer);

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
    this.x = 100;
    this.y = 100; // TODO: Might need to adjust this when finalizing player spawning positions.
  }

  update(controller: Controller) {
    // Horizontal movement
    if (controller.keys.left.pressed) {
      this.x -= this.speed;
    }
    if (controller.keys.right.pressed) {
      this.x += this.speed;
    }

    // Jumping from ground
    if ((controller.keys.space.pressed || controller.keys.up.pressed) && this.isOnGround) {
      this.velocityY = -this.jumpStrength;
      this.isOnGround = false;
    }

    // Double jump logic, utilizes doubleJump from the controller. 
    // Might need to tweak the doubleJump time window in the controller depending on jump animation time duration. 
    if ((controller.keys.space.doubleTap || controller.keys.up.doubleTap) && !this.isOnGround && this.canDoubleJump) {
      this.velocityY = -this.jumpStrength;
      this.canDoubleJump = false;
    }


    // Apply gravity
    this.velocityY += this.gravity;
    this.y += this.velocityY;

    // Floor collision
    const bottomY = this.y;
    if (bottomY >= this.FLOOR_Y) {
      this.y = this.FLOOR_Y;
      this.velocityY = 0;
      this.isOnGround = true;
      this.canDoubleJump = true;
    }
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

  syncPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
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
    console.log(`Damaging player with predicted health: ${this.predictedHealth}. Doing ${amount} damage.`); 
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

    // Clean up graphics
    this.body.destroy();
    this.healthBar.destroy();
    this.healthBarContainer.destroy();


    // Call parent destroy method
    super.destroy({
        children: true,
        texture: true
    });
  }

  getBounds() {
    return this.body.getBounds();
  }

}
