import { Graphics, Container, Text, TextStyle, Sprite } from 'pixi.js';

export class AmmoBox extends Container {
    private body: Sprite;
    public readonly boxWidth = 100;
    public readonly boxHeight = 100;

    constructor(x: number, y: number) {
        super();
        
        // Create box
        this.body = Sprite.from('ammoBox');
        this.body.width = this.boxWidth;    
        this.body.height = this.boxHeight;

        this.addChild(this.body);

    
        this.x = x;
        this.y = y;
    }

    getBounds() {
        return this.body.getBounds();
    }

    destroy() {
        this.body.destroy();
        super.destroy();
    }
}