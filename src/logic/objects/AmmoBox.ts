import { Graphics, Container, Text, TextStyle } from 'pixi.js';

export class AmmoBox extends Container {
    private body: Graphics;
    private boxLabel: Text;
    public readonly boxWidth = 35;
    public readonly boxHeight = 35;

    constructor(x: number, y: number) {
        super();
        
        // Create box
        this.body = new Graphics()
            .rect(0, 0, this.boxWidth, this.boxHeight)
            .fill(0xFFD700); // Gold color
        
        // Create boxLabel
        const boxLabelStyle = new TextStyle({
            fontFamily: 'Arial',
            fontSize: 10,
            fontWeight: 'bold',
            fill: 0x000000, // Black text
            align: 'center'
        });

        this.boxLabel = new Text({
            text: 'AMMO',
            style: boxLabelStyle
        });
        
        // Center the text in the box
        this.boxLabel.anchor.set(0.5);
        this.boxLabel.x = this.boxWidth / 2;
        this.boxLabel.y = this.boxHeight / 2;

        this.addChild(this.body);
        this.addChild(this.boxLabel);
        
        this.x = x;
        this.y = y;
    }

    getBounds() {
        return this.body.getBounds();
    }

    destroy() {
        this.body.destroy();
        this.boxLabel.destroy();
        super.destroy();
    }
}