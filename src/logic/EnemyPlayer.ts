
import { Graphics, Container } from 'pixi.js';

export class EnemyPlayer extends Container {
  private body: Graphics;

  constructor(spawnX: number, spawnY: number) {
    super();

    this.body = new Graphics().rect(0, 0, 50, 50).fill(0xff9900); // orange enemy
    this.addChild(this.body);

    // Set pivot to bottom center like Player class
    this.pivot.set(25, 50);

    // Default spawn location
    this.x = spawnX;
    this.y = spawnY;
  }

  // Called with updated server values
  syncPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  damage() {
    this.body.clear();
    this.body.rect(0, 0, 50, 50).fill(0xff0000);

    setTimeout(() => {
      this.body.clear();
      this.body.rect(0, 0, 50, 50).fill(0xff9900); // restore enemy color
    }, 100);
  }
}
