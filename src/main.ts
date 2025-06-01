import { Application } from 'pixi.js';
import { GameManager } from './managers/GameManager';

console.log('Starting game...');

(async () => {
    const app = new Application();
    await app.init({ 
        background: '#202020',

    });
    document.body.appendChild(app.canvas);

    // Initialize game manager
    await GameManager.initialize(app);
})();