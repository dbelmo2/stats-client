import './style.css';
import runGame from './components/game/main';
import { consumeReturnTarget } from './shared/authClient';

const isMobile = () => window.matchMedia('(any-hover:none)').matches;

const wantsDashboard = () => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname;
    return params.get('view') === 'data' || path.startsWith('/data') || path.startsWith('/dashboard') || path.startsWith('/vote') || path.startsWith('/contest');
};

(async () => {
    // FRONTEND_POST_LOGIN_URL on the backend lands on the bare origin, which wouldn't reliably
    // return the user to whichever surface (dashboard or game) they initiated login from — this
    // sessionStorage flag (set right before the OAuth redirect) overrides that ambiguity.
    const returnTarget = consumeReturnTarget();
    if (returnTarget === 'dashboard') {
        const { renderMobileApp } = await import('./components/MobileApp/main');
        renderMobileApp();
        return;
    }

    if (isMobile() || wantsDashboard()) {
        // Render the React dashboard and exit early
        const { renderMobileApp } = await import('./components/MobileApp/main');
        renderMobileApp();
        return;
    }

    runGame();
})();