import { Application, Assets, Sprite } from 'pixi.js';
import { GameManager } from './managers/GameManager';
import backgroundImg from './background-game.png'

console.log('Starting game...');

(async () => {
    const app = new Application();
    await app.init({ 
        background: '#202020',
    });
    document.body.appendChild(app.canvas);
    Assets.add({ alias: 'background', src: backgroundImg });
    await Assets.load('background');
    const background = Sprite.from('background');
    background.width = 1920;
    background.height = 1080;
    background.x = 0;
    background.y = -250;

    localStorage.debug = '*';

    app.stage.addChild(background);

    // Initialize game manager
    await GameManager.initialize(app);
})();