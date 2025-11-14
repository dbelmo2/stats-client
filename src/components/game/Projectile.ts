import { Graphics, Container, Sprite } from 'pixi.js';

export class Projectile extends Container {
  protected speed: number;
  protected vx: number = 0;
  protected vy: number = 0;
  protected body: Sprite;
  protected gravityEffect: number;
  protected gameBounds: { width: number; height: number };
  public shouldBeDestroyed = false;
  protected id: string;
  public wasAcknowledged: boolean = false;
  background: Graphics;
  protected lifespanMS: number = 4000; // in frames



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
    gameBounds: { width: number; height: number },
    id = Math.random().toString(36).substring(2, 15),
    speed = 30, 
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
    this.gravityEffect = gravityEffect;
    this.gameBounds = gameBounds;
    this.addChild(this.body);

    // Calculate direction vector
    this.calculateVelocity(spawnX, spawnY, targetX, targetY);
  
    //this.pivot.set(10, 10); // Set pivot to center of the tomato sprite
  }

  update() {
    this.vy += this.gravityEffect;
    this.x += this.vx;
    this.y += this.vy;
    if (this.isOutsideBounds()) {
      this.shouldBeDestroyed = true; // Is this causing the server to destroy it?
    }
  }

  isOutsideBounds(): boolean {
    const leftMost = (0 - (this.gameBounds.width / 2) - 50)
    const rightMost = (this.gameBounds.width + (this.gameBounds.width / 2) + 50)
    const topMost = (0 - (this.gameBounds.height / 2) - 50);
    const bottomMost = (this.gameBounds.height + (this.gameBounds.height / 2) + 50);
    return (
      this.x < leftMost ||
      this.x > rightMost ||
      this.y < topMost ||
      this.y > bottomMost
    );
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


  getId(): string {
    return this.id;
  }

  // Reset method for ObjectPool usage
  reset(): Projectile {
    // DO NOT remove from display tree - ObjectPool handles stage management
    // when keepOnStage is true, objects should remain on stage but be invisible
    
    // Reset position and movement to off-screen safe values
    this.x = -9999;
    this.y = -9999;
    this.vx = 0;
    this.vy = 0;
    
    // Reset state flags
    this.shouldBeDestroyed = false;
    this.wasAcknowledged = false;
    
    // Generate new ID for reused projectile
    this.id = Math.random().toString(36).substring(2, 15);
    
    // Reset visual state - make invisible until reinitialized
    this.visible = false;
    this.alpha = 0;
    
    return this;
  }

  // Initialize method for setting up a recycled projectile with new parameters
  initialize(
    spawnX: number, 
    spawnY: number, 
    targetX: number, 
    targetY: number,
    gameBounds: { width: number; height: number },
    id?: string,
    speed: number = 30, 
    gravityEffect: number = 0.05
  ): void {
    // Set position and properties
    this.x = spawnX;
    this.y = spawnY;
    this.speed = speed;
    this.gravityEffect = gravityEffect;
    this.gameBounds = gameBounds;
    
    if (id) {
      this.id = id;
    }
    
    // Make visible and ready for display
    this.visible = true;
    this.alpha = 1;
    
    // Calculate direction vector
    this.calculateVelocity(spawnX, spawnY, targetX, targetY);
  }


}
