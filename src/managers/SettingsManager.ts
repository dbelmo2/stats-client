import { Howler } from 'howler';
import settingsIcon from '../settings-icon.png';

export type Region = 'NA' | 'EU' | 'ASIA';


export interface GameSettings {
    region: Region;
    musicVolume: number;  // 0-1 range
    sfxVolume: number;    // 0-1 range
}

export class SettingsManager {
    private static instance: SettingsManager;
    private settings: GameSettings;
    private settingsButton: HTMLElement | null = null;
    private settingsModal: HTMLElement | null = null;
    private onRegionChangeCallbacks: ((region: Region) => void)[] = [];
    
    private constructor() {
        // Load settings from localStorage or use defaults
        const savedSettings = localStorage.getItem('gameSettings');
        
        if (savedSettings) {
            this.settings = JSON.parse(savedSettings);
        } else {
            this.settings = {
                region: 'NA',
                musicVolume: 0.5,
                sfxVolume: 0.5
            };
            this.saveSettings();
        }
        
        // Apply initial volume settings
        this.applyVolumeSettings();
    }
    
    public static getInstance(): SettingsManager {
        if (!SettingsManager.instance) {
            SettingsManager.instance = new SettingsManager();
        }
        return SettingsManager.instance;
    }
    
    public getSettings(): GameSettings {
        return { ...this.settings }; // Return a copy to prevent direct mutation
    }
    
    public getRegion(): Region {
        return this.settings.region;
    }
    
    public getMusicVolume(): number {
        return this.settings.musicVolume;
    }
    
    public getSfxVolume(): number {
        return this.settings.sfxVolume;
    }
    
    public setRegion(region: Region): void {
        this.settings.region = region;
        this.saveSettings();
        
        // Notify subscribers about region change
        this.onRegionChangeCallbacks.forEach(callback => callback(region));
    }
    
    public setMusicVolume(volume: number): void {
        this.settings.musicVolume = Math.max(0, Math.min(1, volume)); // Clamp between 0-1
        this.saveSettings();
        this.applyVolumeSettings();
    }
    
    public setSfxVolume(volume: number): void {
        this.settings.sfxVolume = Math.max(0, Math.min(1, volume)); // Clamp between 0-1
        this.saveSettings();
        this.applyVolumeSettings();
    }
    
    public onRegionChange(callback: (region: Region) => void): void {
        this.onRegionChangeCallbacks.push(callback);
    }
    
    public createSettingsUI(): void {
        this.createSettingsButton();
    }
    
    private createSettingsButton(): void {
        // Remove existing button if it exists
        if (this.settingsButton) {
            document.body.removeChild(this.settingsButton);
        }
        
        // Create the settings button
        const button = document.createElement('button');
        button.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.7);
            border: 2px solid #fff;
            cursor: pointer;
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s;
            padding: 0;
            overflow: hidden;
        `;
        
        // Create and add the settings icon image
        const icon = document.createElement('img');
        icon.src = settingsIcon;
        icon.alt = 'Settings';
        icon.style.cssText = `
            width: 30px;
            height: 30px;
            object-fit: contain;
            filter: invert(1); /* Make icon white */
        `;
        
        button.appendChild(icon);
        
        button.addEventListener('mouseover', () => {
            button.style.transform = 'scale(1.1)';
        });
        
        button.addEventListener('mouseout', () => {
            button.style.transform = 'scale(1)';
        });
        
        button.addEventListener('click', () => {
            this.toggleSettingsModal();
        });
        
        document.body.appendChild(button);
        this.settingsButton = button;
    }
    private toggleSettingsModal(): void {
        if (this.settingsModal) {
            this.closeSettingsModal();
        } else {
            this.openSettingsModal();
        }
    }
    
    private openSettingsModal(): void {
        // Create the modal container
        const modalContainer = document.createElement('div');
        modalContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1001;
        `;
        
        // Create the modal content
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: #2c2c2c;
            padding: 30px;
            border-radius: 8px;
            width: 400px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            position: relative;
            color: white;
            font-family: Arial, sans-serif;
        `;
        
        // Create title
        const title = document.createElement('h2');
        title.textContent = 'Game Settings';
        title.style.cssText = `
            margin-top: 0;
            margin-bottom: 20px;
            text-align: center;
            color: #fff;
        `;
        
        // Create close button
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '&times;';
        closeButton.style.cssText = `
            position: absolute;
            top: 15px;
            right: 15px;
            background: none;
            border: none;
            font-size: 24px;
            color: #999;
            cursor: pointer;
        `;
        closeButton.addEventListener('click', () => this.closeSettingsModal());
        
        
        // Create volume sliders
        const volumeSection = this.createVolumeSection();
        
        // Assemble modal
        modal.appendChild(title);
        modal.appendChild(closeButton);
        modal.appendChild(volumeSection);
        
        // Add save button
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save Settings';
        saveButton.style.cssText = `
            background: #4CAF50;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            margin-top: 20px;
            cursor: pointer;
            width: 100%;
            font-size: 16px;
            transition: background 0.3s;
        `;
        saveButton.addEventListener('mouseover', () => {
            saveButton.style.background = '#3e8e41';
        });
        saveButton.addEventListener('mouseout', () => {
            saveButton.style.background = '#4CAF50';
        });
        saveButton.addEventListener('click', () => this.closeSettingsModal());
        
        modal.appendChild(saveButton);
        modalContainer.appendChild(modal);
        
        // Add to DOM
        document.body.appendChild(modalContainer);
        this.settingsModal = modalContainer;
        
        // Prevent clicks from propagating to game
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.closeSettingsModal();
            }
        });
    }

    
    private createVolumeSection(): HTMLElement {
        const section = document.createElement('div');
        
        // Music volume slider
        const musicLabel = document.createElement('label');
        musicLabel.textContent = 'Music Volume:';
        musicLabel.style.cssText = `
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        `;
        
        const musicSlider = document.createElement('input');
        musicSlider.type = 'range';
        musicSlider.min = '0';
        musicSlider.max = '100';
        musicSlider.value = String(this.settings.musicVolume * 100);
        musicSlider.style.cssText = `
            width: 100%;
            margin-bottom: 15px;
        `;
        
        const musicValue = document.createElement('span');
        musicValue.textContent = `${Math.round(this.settings.musicVolume * 100)}%`;
        musicValue.style.cssText = `
            display: inline-block;
            margin-left: 10px;
            width: 40px;
        `;
        
        musicSlider.addEventListener('input', () => {
            const volume = parseInt(musicSlider.value) / 100;
            this.setMusicVolume(volume);
            musicValue.textContent = `${Math.round(volume * 100)}%`;
        });
        
        // SFX volume slider
        const sfxLabel = document.createElement('label');
        sfxLabel.textContent = 'Sound Effects Volume:';
        sfxLabel.style.cssText = `
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        `;
        
        const sfxSlider = document.createElement('input');
        sfxSlider.type = 'range';
        sfxSlider.min = '0';
        sfxSlider.max = '100';
        sfxSlider.value = String(this.settings.sfxVolume * 100);
        sfxSlider.style.cssText = `
            width: 100%;
            margin-bottom: 15px;
        `;
        
        const sfxValue = document.createElement('span');
        sfxValue.textContent = `${Math.round(this.settings.sfxVolume * 100)}%`;
        sfxValue.style.cssText = `
            display: inline-block;
            margin-left: 10px;
            width: 40px;
        `;
        
        sfxSlider.addEventListener('input', () => {
            const volume = parseInt(sfxSlider.value) / 100;
            this.setSfxVolume(volume);
            sfxValue.textContent = `${Math.round(volume * 100)}%`;
        });
        
        // Music volume container
        const musicContainer = document.createElement('div');
        musicContainer.style.marginBottom = '20px';
        musicContainer.appendChild(musicLabel);
        
        const musicRow = document.createElement('div');
        musicRow.style.display = 'flex';
        musicRow.style.alignItems = 'center';
        musicRow.appendChild(musicSlider);
        musicRow.appendChild(musicValue);
        musicContainer.appendChild(musicRow);
        
        // SFX volume container
        const sfxContainer = document.createElement('div');
        sfxContainer.appendChild(sfxLabel);
        
        const sfxRow = document.createElement('div');
        sfxRow.style.display = 'flex';
        sfxRow.style.alignItems = 'center';
        sfxRow.appendChild(sfxSlider);
        sfxRow.appendChild(sfxValue);
        sfxContainer.appendChild(sfxRow);
        
        section.appendChild(musicContainer);
        section.appendChild(sfxContainer);
        
        return section;
    }
    
    private closeSettingsModal(): void {
        if (this.settingsModal && this.settingsModal.parentNode) {
            document.body.removeChild(this.settingsModal);
            this.settingsModal = null;
        }
    }
    
    private saveSettings(): void {
        localStorage.setItem('gameSettings', JSON.stringify(this.settings));
    }
    
    private applyVolumeSettings(): void {
        // Set global Howler volume for music (assumes music uses Howler)
        Howler.volume(this.settings.musicVolume);
        
        // SFX volume will be applied when individual sounds are played
        // This would need game-specific implementation to differentiate music/sfx
    }
}