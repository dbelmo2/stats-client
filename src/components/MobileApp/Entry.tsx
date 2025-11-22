import React from 'react';
import ReactDOM from 'react-dom/client';
import { MobileApp } from './MobileApp';

export function renderMobileApp() {
    const root = document.createElement('div');
    root.id = 'react-root';
    document.body.innerHTML = '';
    document.body.appendChild(root);
    
    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <MobileApp />
        </React.StrictMode>
    );
}