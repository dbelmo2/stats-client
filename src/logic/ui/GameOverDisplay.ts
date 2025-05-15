import { Application, Container, Text, TextStyle } from 'pixi.js';

type PlayerScore = {
    playerId: string;
    name: string;
    kills: number;
    deaths: number;
}

export class GameOverDisplay extends Container {

    private timerId: NodeJS.Timeout | null = null;
    
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
            text: `${winner.playerId === selfId ? 'YOU' : 'Player ' + winner.name} WON!\nKills: ${winner.kills}  Deaths: ${winner.deaths}`,
            style: winnerStyle
        });
        winnerText.anchor.set(0.5);
        this.addChild(winnerText);

        // Other players scores
        scores.forEach((score, index) => {
            const scoreText = new Text({
                text: `${score.name}: ${score.kills} kills, ${score.deaths} deaths`,
                style: scoreStyle
            });
            scoreText.anchor.set(0.5);
            scoreText.y = winnerText.height + 20 + (index * 30);
            this.addChild(scoreText);
        });

        let secondCount = 10;
        const nextRoundText = new Text({
            text: `Next round starting ${secondCount} seconds...`,
            style: new TextStyle({
                fontFamily: 'Arial',
                fontSize: 20,
                fill: '#ffffff',
                align: 'center'
            })
        });

        nextRoundText.anchor.set(0.5);
        nextRoundText.y = winnerText.height + 20 + (scores.length * 30) + 40;
        this.addChild(nextRoundText);

        this.timerId = setInterval(() => {
            if (secondCount <= 0) {
                clearInterval(this.timerId!);
                this.timerId = null;
                return;
            }
            secondCount--;
            nextRoundText.text = `Next round starting ${secondCount} seconds...`;
        }, 1000);
    }

    destroy(): void {
        this.removeChildren().forEach(child => child.destroy());
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }   
        super.destroy();
    }
}