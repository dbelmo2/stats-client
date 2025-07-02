import { Graphics, Container, Sprite } from 'pixi.js';

export class Projectile extends Container {
  protected speed: number;
  protected lifespan: number;
  protected vx: number = 0;
  protected vy: number = 0;
  protected body: Sprite;
  protected gravityEffect: number;
  protected screenHeight: number;
  public shouldBeDestroyed = false;
  protected id: string;
  public wasAcknowledged: boolean = false;
  background: Graphics;


  protected calculateVelocity(spawnX: number, spawnY: number, targetX: number, targetY: number): void {
    const dx = targetX - spawnX;
    const dy = targetY - spawnY;

    const mag = Math.sqrt(dx * dx + dy * dy);
    const dirX = dx / mag;
    const dirY = dy / mag;
    this.vx = dirX * this.speed;
    this.vy = dirY * this.speed;

  }


  constructor(
    spawnX: number, 
    spawnY: number, 
    targetX: number, 
    targetY: number,
    screenHeight: number,
    id = Math.random().toString(36).substring(2, 15),
    speed = 30, 
    lifespan = 5000, 
    gravityEffect = 0.05, 
  ) {
    super();

    // Create blue background
    this.background = new Graphics()
      .circle(15, 15, 5) // Create a circle with radius 20 centered at (15, 15)
      .fill(0x3498db); // Blue color
    
    // Add the background first (so it appears behind the tomato)
    //this.addChild(this.background);

    // Create tomato sprite
    this.body = Sprite.from('tomato');
    this.body.width = 20;
    this.body.height = 20;
    
    // Center the sprite on the background

    // initialize
    this.id = id;
    this.x = spawnX;
    this.y = spawnY;
    this.speed = speed;
    this.lifespan = lifespan;
    this.gravityEffect = gravityEffect;
    this.screenHeight = screenHeight;
    this.addChild(this.body);

    // Calculate direction vector
    this.calculateVelocity(spawnX, spawnY, targetX, targetY);
  
    //this.pivot.set(10, 10); // Set pivot to center of the tomato sprite

    // Begin the age process (we dont want projetiles sticking around forever)
    this.age();
  }

  update() {
    this.vy += this.gravityEffect;
    this.x += this.vx;
    this.y += this.vy;
    console.log(`Projectile ${this.id} position: (${this.x}, ${this.y}) with velocity (${this.vx}, ${this.vy})`);
    if (this.y > this.screenHeight + 100) {
      this.shouldBeDestroyed = true; // Is this causing the server to destroy it?
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

  getId(): string {
    return this.id;
  }


}
