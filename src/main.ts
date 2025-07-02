import { Application, Assets } from 'pixi.js';
import { GameManager } from './managers/GameManager';

import j1 from './j1.png';
import j2 from './j2.png';
import j3 from './j3.png';
import j4 from './j4.png';
import tomato from './tomato.png';
import ammoBox from './ammobox.png';
import platform from './platform.png';
import { SettingsManager } from './managers/SettingsManager';

console.log('Starting game...');

(async () => {

    SettingsManager.getInstance();


    Assets.add({ alias: 'j1', src: j1 });
    Assets.add({ alias: 'j2', src: j2 });
    Assets.add({ alias: 'j3', src: j3 });
    Assets.add({ alias: 'j4', src: j4 });
    Assets.add({ alias: 'tomato', src: tomato });
    Assets.add({ alias: 'ammoBox', src: ammoBox });
    Assets.add({ alias: 'platform', src: platform });

    await Assets.load('j1');
    await Assets.load('j2');
    await Assets.load('j3');
    await Assets.load('j4');
    await Assets.load('tomato');
    await Assets.load('ammoBox');
    await Assets.load('platform');

    const settingsManager = SettingsManager.getInstance();
    settingsManager.createSettingsUI();

    const app = new Application();
    await app.init({ 
        background: '#202020',
    });

    document.body.appendChild(app.canvas);


    // Initialize game manager
    await GameManager.initialize(app, settingsManager);
})();