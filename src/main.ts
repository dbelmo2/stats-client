import './style.css';
import runGame from './components/game/main';

const isMobile = () => {
    if(window.matchMedia("(any-hover:none)").matches) {
        return true;
    } else {
        return false;
    }
};

(async () => {
    if (isMobile()) {
        // Render the React mobile app and exit early
        const { renderMobileApp } = await import('./components/MobileApp/main');
        renderMobileApp();
        return; // Exit early to avoid initializing the game
    }

    runGame();
})();