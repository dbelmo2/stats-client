import { Graphics, Container } from 'pixi.js';
import type { Controller } from './controller';

export class Player extends Container {
  private speed = 4;
  private jumpStrength = 15;
  private gravity = 0.6;
  private velocityY = 0;
  private isOnGround = false;
  private canDoubleJump = true;

  private body: Graphics;

  private readonly FLOOR_Y: number;

  constructor(screenHeight: number) {
    super();

    this.FLOOR_Y = screenHeight - 100;

    this.body = new Graphics().rect(0, 0, 50, 50).fill(0xff0000);
    this.addChild(this.body);

    // Set pivot to bottom center for better physics alignment
    this.pivot.set(25, 50); // half width, full height

    // Start on the floor
    this.x = 100;
    this.y = this.FLOOR_Y;
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
}
