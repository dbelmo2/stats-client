import { Application, Assets } from 'pixi.js';
import { GameManager } from './managers/GameManager';

import H3Logo from './images/h3-logo.png';
import liveBanner from './images/live-banner.png';
import ian from './images/ian.png';
import dan from './images/dan.png';
import j1 from './images/j1-corrected.png';
import j2 from './images/j2-small.png';
import j3 from './images/j3.png';
import j4 from './images/j4.png';
import bush from './images/bush.png';
import bushTree from './images/bush-right.png';
import tomato from './images/tomato.png';
import ammoBush from './images/small-bush.png';
import tomatoBasket from './images/tomato-basket.png';
import platformOne from './images/platform-one.png';
import platformTwo from './images/platform-two.png';
import grassOne from './images/grass-tile-fuller.png';


import { SettingsManager } from './managers/SettingsManager';
import { createLoadingScreen, removeLoadingScreen, updateLoadingProgress } from './components/ui/Loading';

import './style.css';

console.log('Starting game...');

const isMobile = () => {
    if(window.matchMedia("(any-hover:none)").matches) {
        return true;
    } else {
        return false;
    }
};
(async () => {

    if (isMobile()) {
        alert('Mobile devices are not supported at this time. Please play on a desktop or laptop computer.');
        return;
    }

    createLoadingScreen();

    try {
        // Initialize SettingsManager
        updateLoadingProgress(1, 10, 'Initializing settings...');
        SettingsManager.getInstance();

                // Add assets to loader
        updateLoadingProgress(2, 10, 'Preparing assets...');
        const assetList = [
            { alias: 'j1', src: j1 },
            { alias: 'j2', src: j2 },
            { alias: 'j3', src: j3 },
            { alias: 'j4', src: j4 },
            { alias: 'tomato', src: tomato },
            { alias: 'ammoBush', src: ammoBush },
            { alias: 'platformOne', src: platformOne },
            { alias: 'platformTwo', src: platformTwo },
            { alias: 'h3Logo', src: H3Logo },
            { alias: 'liveBanner', src: liveBanner },
            { alias: 'ian', src: ian },
            { alias: 'dan', src: dan },
            { alias: 'bush', src: bush },
            { alias: 'bushTree', src: bushTree },
            { alias: 'tomatoBasket', src: tomatoBasket },
            { alias: 'grassOne', src: grassOne },

        ];

        // Add all assets
        assetList.forEach(asset => {
            Assets.add(asset);
        });

        // Load assets with progress tracking
        let loadedCount = 0;
        
        for (const asset of assetList) {
            updateLoadingProgress(3 + loadedCount, 10, `Loading ${asset.alias}...`);
            await Assets.load(asset.alias);
            loadedCount++;
        }

        // Initialize PIXI Application
        updateLoadingProgress(9, 10, 'Initializing game...');
        const app = new Application();
        await app.init({ 
            background: '#202020',
        });


    
        document.body.appendChild(app.canvas);

        // Create settings UI
        const settingsManager = SettingsManager.getInstance();
        settingsManager.createSettingsUI();

        // Initialize game manager
        GameManager.initialize(app, settingsManager);

        // Complete loading
        updateLoadingProgress(10, 10, 'Ready!');
        
        // Small delay to show completion
        await new Promise(resolve => setTimeout(resolve, 500));
        


        

        // Remove loading screen
        await removeLoadingScreen();



    } catch (error) {
        console.error('Error during game initialization:', error);
        
        // Show error on loading screen
        const loadingText = document.getElementById('loading-text');
        if (loadingText) {
            loadingText.textContent = 'Error loading game. Please refresh.';
            loadingText.style.color = '#ff4444';
        }    }

})();