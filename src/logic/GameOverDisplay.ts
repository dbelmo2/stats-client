import { Application, Container, Text, TextStyle } from 'pixi.js';

type PlayerScore = {
    playerId: string;
    kills: number;
    deaths: number;
}

export class GameOverDisplay extends Container {
    
    constructor(scores: PlayerScore[], selfId: string, app: Application) {
        super();

        const winnerStyle = new TextStyle({
            fontFamily: 'Arial',
            fontSize: 40,
            fontWeight: 'bold',
            fill: '#ffffff',
            stroke: '#000000',
            align: 'center'
        });

        const scoreStyle = new TextStyle({
            fontFamily: 'Arial',
            fontSize: 20,
            fill: '#cccccc',
            align: 'center'
        });

        // Winner display
        const winner = scores[0];
        const winnerText = new Text({
            text: `${winner.playerId === selfId ? 'YOU' : 'Player ' + winner.playerId} WON!\nKills: ${winner.kills}  Deaths: ${winner.deaths}`,
            style: winnerStyle
        });
        winnerText.anchor.set(0.5);
        this.addChild(winnerText);

        // Other players scores
        scores.slice(1).forEach((score, index) => {
            const scoreText = new Text(
                `${score.playerId === selfId ? 'You' : 'Player ' + score.playerId}: ${score.kills} kills, ${score.deaths} deaths`,
                scoreStyle
            );
            scoreText.anchor.set(0.5);
            scoreText.y = winnerText.height + 20 + (index * 30);
            this.addChild(scoreText);
        });
    }

    destroy(): void {
        this.removeChildren().forEach(child => child.destroy());
        super.destroy();
    }
}