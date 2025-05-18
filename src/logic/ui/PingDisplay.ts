import { Container, Text, Graphics } from 'pixi.js';

export class PingDisplay extends Container {
    private pingText: Text;
    private background: Graphics;
    
    constructor() {
        super();

        // Create background
        this.background = new Graphics()
            .rect(0, 0, 80, 30)
            .fill(0x000000);
            
        this.addChild(this.background);
        
        // Create text display
        this.pingText = new Text({
            text: 'Ping: --ms',
            style: {
                fontFamily: 'Arial',
                fontSize: 14,
                fill: 0xffffff
            }
        });
        
        this.pingText.position.set(5, 5);
        this.addChild(this.pingText);
        
        // Position in top right corner (will be adjusted in fixPosition)
        this.position.set(0, 0);
      
    }
    
    public updatePing(ping: number): void {
        
        // Update text color based on ping quality
        let color = 0x00ff00; // Green for good ping
        if (ping > 100) color = 0xffff00; // Yellow for medium ping
        if (ping > 200) color = 0xff0000; // Red for bad ping
        
        this.pingText.text = `Ping: ${ping}ms`;
        this.pingText.style.fill = color;
    }
    
    // This fixes the position to always be in the top-left corner of the viewport
    fixPosition(): void {
        // Position is in camera space, not world space
        this.x = 50;
        this.y = 400;
    }
    
    destroy(): void {
        this.pingText.destroy();
        this.background.destroy();
        super.destroy();
    }
}