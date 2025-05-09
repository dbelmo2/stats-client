import { Graphics, Container } from 'pixi.js';

export class Projectile extends Container {
  protected speed: number;
  protected lifespan: number;
  protected vx: number = 0;
  protected vy: number = 0;
  protected body: Graphics;
  protected gravityEffect: number;
  protected screenHeight: number;
  public shouldBeDestroyed = false;

  protected calculateVelocity(spawnX: number, spawnY: number, targetX: number, targetY: number): void {
    const dx = targetX - spawnX;
    const dy = targetY - spawnY;

    const mag = Math.sqrt(dx * dx + dy * dy);
    const dirX = dx / mag;
    const dirY = dy / mag;
    this.vx = dirX * this.speed;
    this.vy = dirY * this.speed;
  }


  constructor(spawnX: number, spawnY: number, targetX: number, targetY: number, speed = 5, lifespan = 2000, gravityEffect = 0.005, screenHeight: number) {
    super();

    this.body = new Graphics().circle(0, 0, 5).fill('#ffffff');
    this.addChild(this.body);

    // initialize 
    this.x = spawnX + 50;
    this.y = spawnY + -50;
    this.speed = speed;
    this.lifespan = lifespan;
    this.gravityEffect = gravityEffect;
    this.screenHeight = screenHeight;

    // Calculate direction vector
    this.calculateVelocity(spawnX, spawnY, targetX, targetY);
    

    // Begin the age process (we dont want projetiles sticking around forever)
    this.age();
  }

  update() {
    this.vy += this.gravityEffect;
    this.x += this.vx;
    this.y += this.vy;
    if (this.y > this.screenHeight + 100) {
      this.shouldBeDestroyed = true;
    }
  }

  destroy() {
    // Remove the projectile from its parent container
    if (this.parent) {
        this.parent.removeChild(this);
    }

    // Destroy the graphics body
    this.body.destroy();

    // Call the superclass destroy method
    super.destroy();
  }

  age() {
    setTimeout(() => {
        this.shouldBeDestroyed = true;
    }, this.lifespan)
  }

}
