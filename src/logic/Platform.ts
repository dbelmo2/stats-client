import { Graphics, Container } from 'pixi.js';

export class Platform extends Container {
    private body: Graphics;
    public readonly platformWidth = 200;
    public readonly platformHeight = 20;

    constructor(x: number, y: number) {
        super();
        
        this.body = new Graphics()
            .rect(0, 0, this.width, this.height)
            .fill(0x8B4513); // Brown color for the platform
        
        this.addChild(this.body);
        this.x = x;
        this.y = y;
    }

    getBounds() {
        return this.body.getBounds();
    }
}