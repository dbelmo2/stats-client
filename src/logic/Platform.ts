import { Graphics, Container } from 'pixi.js';

export class Platform extends Container {
    private body: Graphics;
    public readonly platformWidth = 500;
    public readonly platformHeight = 30;

    constructor(x: number, y: number) {
        super();
        
        this.body = new Graphics()
            .rect(0, 0, this.platformWidth, this.platformHeight)
            .fill('#192328');
        
        this.addChild(this.body);
        this.x = x;
        this.y = y;
    }
getPlatformBounds() {
    // Use parent transform-aware position but compensate for camera movement
    return {
        left: this.x,
        right: this.x + this.platformWidth,
        top: this.y,
        bottom: this.y + this.platformHeight,
        width: this.platformWidth,
        height: this.platformHeight
    };
}
}