import { Container, Sprite } from 'pixi.js';

export class EnemyProjectile extends Container {
  private body: Sprite;
  private vx: number;
  private vy: number;
  public shouldBeDestroyed = false;
  private gameBounds: { width: number; height: number };
  private id: string;
  private ownerId: string;
  
  constructor(
    id: string,
    ownerId: string,
    x: number,
    y: number,
    vx: number,
    vy: number,
    gameBounds: { width: number; height: number },
    ) {
    super();
    this.id = id;
    this.ownerId = ownerId;
    this.gameBounds = gameBounds;
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
  }
  update() {
    this.vy += 0.05;
    this.x += this.vx;
    this.y += this.vy;

    if (this.isOutsideBounds()) {
      this.shouldBeDestroyed = true;
    }
  }



  isOutsideBounds() {
    return (
      this.x < -50 || this.x > this.gameBounds.width + 50 ||
      this.y < -50 || this.y > this.gameBounds.height + 50
    );
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


  getId() {
    return this.id;
  }
  getOwnerId() {
    return this.ownerId;
  }
}
