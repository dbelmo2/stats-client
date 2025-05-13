import { Graphics, Container, Text, TextStyle } from 'pixi.js';

export class AmmoBox extends Container {
    private body: Graphics;
    private label: Text;
    public readonly boxWidth = 35;
    public readonly boxHeight = 35;

    constructor(x: number, y: number) {
        super();
        
        // Create box
        this.body = new Graphics()
            .rect(0, 0, this.boxWidth, this.boxHeight)
            .fill(0xFFD700); // Gold color
        
        // Create label
        const labelStyle = new TextStyle({
            fontFamily: 'Arial',
            fontSize: 10,
            fontWeight: 'bold',
            fill: 0x000000, // Black text
            align: 'center'
        });

        this.label = new Text({
            text: 'AMMO',
            style: labelStyle
        });
        
        // Center the text in the box
        this.label.anchor.set(0.5);
        this.label.x = this.boxWidth / 2;
        this.label.y = this.boxHeight / 2;

        this.addChild(this.body);
        this.addChild(this.label);
        
        this.x = x;
        this.y = y;
    }

    getBounds() {
        return this.body.getBounds();
    }

    destroy() {
        this.body.destroy();
        this.label.destroy();
        super.destroy();
    }
}