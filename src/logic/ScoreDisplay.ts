import { Container, Text, TextStyle } from 'pixi.js';

export class ScoreDisplay extends Container {
    private scores: Map<string, Text> = new Map();
    private readonly style = new TextStyle({
        fontFamily: 'Arial',
        fontSize: 14,
        fill: '#ffffff'
    });

    constructor() {
        super();
        this.x = 10;
        this.y = 10;
    }

    updateScores(scores: Array<{ playerId: string, kills: number, deaths: number }>, selfId: string): void {
        // Clear old scores that aren't in new data
        for (const [id, text] of this.scores.entries()) {
            if (!scores.some(score => score.playerId === id)) {
                this.removeChild(text);
                text.destroy();
                this.scores.delete(id);
            }
        }

        // Update or add new scores
        scores.forEach((score, index) => {
            const isPlayer = score.playerId === selfId;
            const scoreText = `${isPlayer ? 'You' : 'Player ' + score.playerId}: K:${score.kills} D:${score.deaths}`;
            
            if (this.scores.has(score.playerId)) {
                this.scores.get(score.playerId)!.text = scoreText;
            } else {
                const text = new Text(scoreText, this.style);
                text.y = index * 20;
                this.addChild(text);
                this.scores.set(score.playerId, text);
            }
        });
    }

    destroy(): void {
        for (const text of this.scores.values()) {
            text.destroy();
        }
        this.scores.clear();
        super.destroy();
    }
}