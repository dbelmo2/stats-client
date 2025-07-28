import { Container, Sprite } from 'pixi.js';

export class Platform extends Container {
    private body: Sprite;
    public readonly platformWidth = 500;
    public readonly platformHeight = 30;

    constructor(x: number, y: number, type: 'one' | 'two') {
        super();
        

        if (type === 'one') {
            this.body = Sprite.from('platformOne');
        } else  {
            this.body = Sprite.from('platformTwo');
        }
        
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