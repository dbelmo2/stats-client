import { Graphics, Container } from 'pixi.js';

export class EnemyProjectile extends Container {
  private body: Graphics;
  private vx: number;
  private vy: number;
  public shouldBeDestroyed = false;
  private lifespan: number;
  private id: string;
  private ownerId: string;
  
  constructor(id: string, ownerId: string, x: number, y: number, vx: number, vy: number, color: number = 0xffffff, lifespan: number = 5000) {
    super();
    this.id = id;
    this.ownerId = ownerId;
    this.lifespan = lifespan;
    this.body = new Graphics().circle(0, 0, 5).fill(color);
    this.addChild(this.body);

    // Default position
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;

    this.age();
  }
  update() {
    this.vy += 0.05;
    this.x += this.vx;
    this.y += this.vy;
  }


  sync(x: number, y: number, vx: number, vy: number) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    // correct only if past threshhold
    /*
    const threshold = 10;
    if (Math.abs(this.x - serverX) > threshold) this.x = serverX;
    if (Math.abs(this.y - serverY) > threshold) this.y = serverY;
    */
  }


  destroy() {
    if (this.parent) {
      this.parent.removeChild(this);
    }
    this.body.destroy();
    super.destroy();
  }

  age() {
    setTimeout(() => {
        this.shouldBeDestroyed = true;
    }, this.lifespan)
  }

  getId() {
    return this.id;
  }
  getOwnerId() {
    return this.ownerId;
  }
}
