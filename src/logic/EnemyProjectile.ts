import { Container, Sprite } from 'pixi.js';

export class EnemyProjectile extends Container {
  private body: Sprite;
  private vx: number;
  private vy: number;
  public shouldBeDestroyed = false;
  private lifespan: number;
  private id: string;
  private ownerId: string;
  
  constructor(id: string, ownerId: string, x: number, y: number, vx: number, vy: number, lifespan: number = 5000) {
    super();
    this.id = id;
    this.ownerId = ownerId;
    this.lifespan = lifespan;
    // Create tomato sprite
    this.body = Sprite.from('tomato');
    this.body.width = 20;
    this.body.height = 20;
    this.addChild(this.body);

    // Default position
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    console.log(`EnemyProjectile created with id: ${this.id}, ownerId: ${this.ownerId}, position: (${this.x}, ${this.y}), velocity: (${this.vx}, ${this.vy})`);
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
