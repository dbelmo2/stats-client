import { Text, TextStyle } from 'pixi.js';

export class KillIndicator extends Text {
    private lifespan = 2000; // 3 seconds
    private elapsed = 0;
    private speed = 0.5;
    private animationID: number | null = null;

    constructor(x: number, y: number) {
        // Style for the "+1" text
        const style = new TextStyle({
            fontFamily: 'Arial',
            fontSize: 16,
            fontWeight: 'bold',
            fill: '#00FF00',
            stroke: {
              color: '#000000',
              width: 3,
              alignment: 0.5,
            },

            align: 'center'
        });

        super({ text: "+1", style }); // Fix: Use correct constructor signature

        // Set position and anchor
        this.x = x;
        this.y = y - 30; // Start above the player
        this.anchor.set(0.5, 0.5);
        
        // Set up animation using requestAnimationFrame instead of Ticker
        this.startAnimation();
    }
    
    private startAnimation(): void {
        let lastTime = performance.now();
        
        const animate = (currentTime: number) => {
            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;
            
            // Move upward
            this.y -= this.speed;
            
            // Track elapsed time
            this.elapsed += deltaTime;
            
            // Fade out over time
            if (this.elapsed > this.lifespan / 2) {
                this.alpha = 1 - ((this.elapsed - (this.lifespan / 2)) / (this.lifespan / 2));
            }
            
            // Remove when lifetime is over
            if (this.elapsed >= this.lifespan) {
                this.destroy();
                return;
            }
            
            this.animationID = requestAnimationFrame(animate);
        };
        
        this.animationID = requestAnimationFrame(animate);
    }
    
    destroy(): void {
        // Cancel animation frame if active
        if (this.animationID !== null) {
            cancelAnimationFrame(this.animationID);
            this.animationID = null;
        }
        
        super.destroy({children: true, texture: true });
    }
}