import { Graphics, Container } from 'pixi.js';

export class Projectile extends Container {
  private speed = 4; // do we need?
  private vx;
  private vy;

  private body: Graphics;


  constructor(spawnX: number, spawnY: number, targetX: number, targetY: number) {
    super();


    this.body = new Graphics().circle(0, 0, 5).fill(0x000000);
    this.addChild(this.body);

    // Set spawn & target location
    this.x = spawnX + 50;
    this.y = spawnY + -50;


    // Calculate direction vector
    const dx = targetX - spawnX;
    const dy = targetY - spawnY;

    const mag = Math.sqrt(dx * dx + dy * dy);
    const dirX = dx / mag;
    const dirY = dy / mag;
    this.vx = dirX * this.speed;
    this.vy = dirY * this.speed;

  }

  update() {
    // Update the position of the projectile
    // For reference from google: 
    //      The trajectory of a projectile 
    //      is a parabola. The equation for 
    //      the trajectory of a projectile 
    //      launched with an initial velocity
    //      v at an angle θ above the horizontal, 
    //      neglecting air resistance, 
    //      is: y = x * tan(θ) - (g * x^2) / (2 * v^2 * cos^2(θ)).
    //      Where 'y' is the vertical displacement,
    //      'x' is the horizontal displacement, 'g' is 
    //      the acceleration due to gravity, and 'v'
    //      is the initial speed. 
    console.log('updating projectile');
    this.vy += 0.005;
    this.x += this.vx;
    this.y += this.vy;



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
}
