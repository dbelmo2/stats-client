import { Container, Text, TextStyle } from 'pixi.js';
export class ScoreDisplay extends Container {
    private scores: Map<string, Text> = new Map();
    private scoreContainer: Container;
    private header: Text;
    private largestWidth: number = 1920; // make dynamic;
    
    constructor() {
        super();
        // Create a container for the scores with fixed position relative to camera
        this.scoreContainer = new Container();
        this.addChild(this.scoreContainer);
        
        // Create header
        const headerStyle = new TextStyle({
            fontFamily: 'Arial',
            fontSize: 16,
            fontWeight: 'bold',
            fill: '#FFFFFF',
        });
        
        this.header = new Text({ text: 'PLAYERS - Free for all (10 kills)', style: headerStyle});
        this.header.x = 10;
        this.header.y = 10;
        this.scoreContainer.addChild(this.header);
        
        this.x = 50 + (this.largestWidth - window.innerWidth) / 2;
        this.y = 125; // Fixed position
        this.visible = false; // Initially hidden
    }
    // Update scoreboard with new scores
    updateScores(scores: Array<{ playerId: string, kills: number, deaths: number, name: string }>, selfId: string): void {
        // Clear existing scores
        for (const [_, text] of this.scores) {
            this.scoreContainer.removeChild(text);
            text.destroy();
        }
        this.scores.clear();
        
        // Sort scores by kills (descending)
        const sortedScores = [...scores].sort((a, b) => b.kills - a.kills);
        
        let yOffset = 40; // Start below header
        
        for (const score of sortedScores) {
            const isCurrentPlayer = score.playerId === selfId;
            
            // Style based on if it's the current player
            const style = new TextStyle({
                fontFamily: 'Arial',
                fontSize: 14,
                fill: isCurrentPlayer ? '#FFFF00' : '#FFFFFF', // Yellow for self
                fontWeight: isCurrentPlayer ? 'bold' : 'normal',
            });
            
            const text = new Text(
                `${score.name}: ${score.kills} kills / ${score.deaths} deaths`,
                style
            );
            
            text.x = 10;
            text.y = yOffset;
            yOffset += 20;
            
            this.scoreContainer.addChild(text);
            this.scores.set(score.playerId, text);
        }
    }
    
    public fixPosition(): void {
        // Position in top left corner with slight margin
        const windowWidth = window.innerWidth;
        const largestWidth = this.largestWidth;

        const offset = -(windowWidth - largestWidth) / 2;
        this.x = offset < 0 ? 50 : 50 + offset;
        this.y = 125;
    }

    public show() {
        this.visible = true;
    }

    public hide() {
        // Hide the score display by removing it from the stage
        this.visible = false;
    }


    destroy(): void {
        for (const text of this.scores.values()) {
            text.destroy();
        }
        this.scores.clear();
        super.destroy();
    }
}