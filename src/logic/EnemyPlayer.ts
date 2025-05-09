import { Graphics, Container } from 'pixi.js';

export class EnemyPlayer extends Container {
  private body: Graphics;
  private healthBar: Graphics;
  private maxHealth: number = 100;
  private currentHealth: number = 100;
  private readonly HEALTH_BAR_WIDTH = 50;
  private readonly HEALTH_BAR_HEIGHT = 5;

  constructor(spawnX: number, spawnY: number) {
    super();

    // Create main body
    this.body = new Graphics().rect(0, 0, 50, 50).fill(0xff9900);
    this.addChild(this.body);

    // Create health bar background
    const healthBarBg = new Graphics()
      .rect(0, -15, this.HEALTH_BAR_WIDTH, this.HEALTH_BAR_HEIGHT)
      .fill(0x333333);
    this.addChild(healthBarBg);

    // Create health bar
    this.healthBar = new Graphics();
    this.updateHealthBar();
    this.addChild(this.healthBar);

    // Set pivot to bottom center
    this.pivot.set(25, 50);

    // Default spawn location
    this.x = spawnX;
    this.y = spawnY;
  }

  private updateHealthBar(): void {
    this.healthBar.clear();
    const healthPercentage = this.currentHealth / this.maxHealth;
    const barWidth = this.HEALTH_BAR_WIDTH * healthPercentage;
    
    // Health bar colors based on remaining health
    let color = 0x00ff00; // Green
    if (healthPercentage < 0.6) color = 0xffff00; // Yellow
    if (healthPercentage < 0.3) color = 0xff0000; // Red

    this.healthBar
      .rect(0, -15, barWidth, this.HEALTH_BAR_HEIGHT)
      .fill(color);
  }

  syncPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  setHealth(health: number): void {
    this.currentHealth = Math.max(0, Math.min(health, this.maxHealth));
    this.updateHealthBar();
  }

  damage(amount: number = 10) {
    this.currentHealth = Math.max(0, this.currentHealth - amount);
    this.updateHealthBar();

    // Flash effect
    this.body.clear();
    this.body.rect(0, 0, 50, 50).fill(0xff0000);

    setTimeout(() => {
      this.body.clear();
      this.body.rect(0, 0, 50, 50).fill(0xff9900);
    }, 100);
  }
}