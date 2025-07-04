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
import { createLoadingScreen, removeLoadingScreen, updateLoadingProgress } from './logic/ui/Loading';

console.log('Starting game...');

(async () => {
    const loadingScreen = createLoadingScreen();

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
            { alias: 'ammoBox', src: ammoBox },
            { alias: 'platform', src: platform }
        ];

        // Add all assets
        assetList.forEach(asset => {
            Assets.add(asset);
        });

        // Load assets with progress tracking
        let loadedCount = 0;
        const totalAssets = assetList.length;
        
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