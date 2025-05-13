import { Graphics, Container } from 'pixi.js';

export class AmmoBox extends Container {
    private body: Graphics;
    public readonly boxWidth = 30;
    public readonly boxHeight = 30;

    constructor(x: number, y: number) {
        super();
        
        this.body = new Graphics()
            .rect(0, 0, this.boxWidth, this.boxHeight)
            .fill(0xFFD700); // Gold color
        
        this.addChild(this.body);
        this.x = x;
        this.y = y;
    }

    getBounds() {
        return this.body.getBounds();
    }
}