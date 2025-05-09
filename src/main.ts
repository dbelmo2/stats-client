import { Application } from 'pixi.js';
import { GameManager } from './managers/GameManager';

(async () => {
    const app = new Application();
    await app.init({ background: '#202020', resizeTo: window });
    document.body.appendChild(app.canvas);

    // Initialize game manager
    await GameManager.initialize(app);
})();