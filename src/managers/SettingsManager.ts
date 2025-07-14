import settingsIcon from '../settings-icon.png';

export type Region = 'NA' | 'EU' | 'ASIA';


export interface GameSettings {
    region: Region;
    musicVolume: number;  // 0-1 range
    sfxVolume: number;    // 0-1 range
    muteAll: boolean;
    muteMusic: boolean;
    muteSfx: boolean;
    devMode: boolean;
}

export class SettingsManager {
    private static instance: SettingsManager;
    private settings: GameSettings;
    private settingsButton: HTMLElement | null = null;
    private settingsModal: HTMLElement | null = null;
    private onSettingsChangeCallbacks: ((type: string, value: any) => void)[] = [];
    private onModalOpenCallback: any;
    private onModalCloseCallback: any;

    private constructor() {
        // Load settings from localStorage or use defaults
        const savedSettings = localStorage.getItem('gameSettings');
        console.log('Saved settings:', savedSettings);
        if (savedSettings) {
            this.settings = JSON.parse(savedSettings);
        } else {
            this.settings = {
                region: 'NA',
                musicVolume: 0.5,
                sfxVolume: 0.5,
                muteAll: false,
                muteMusic: false,
                muteSfx: false,
                devMode: false,
            };
            this.saveSettings();
        }
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
    }
    
    public onModalOpen(callback: any) {
        this.onModalOpenCallback = callback;
    }

    public onModalClose(callback: any) {
        this.onModalCloseCallback = callback;
    }

    public setMusicVolume(volume: number): void {
        this.settings.musicVolume = Math.max(0, Math.min(1, volume)); // Clamp between 0-1
        for (const callback of this.onSettingsChangeCallbacks) {
            callback('Music Volume', this.settings.musicVolume);
        }
    }
    
    public setSfxVolume(volume: number): void {
        this.settings.sfxVolume = Math.max(0, Math.min(1, volume)); // Clamp between 0-1
        for (const callback of this.onSettingsChangeCallbacks) {
            callback('Sound Effects Volume', this.settings.sfxVolume);
        }
    }
    
    public createSettingsUI(): void {
        this.createSettingsButton();
    }

    public onSettingsChange(callback: (type: string, value: any) => void): void {
        this.onSettingsChangeCallbacks.push(callback);
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
            top: 30px;
            right: 30px;
            border: none;
            background: rgba(0, 0, 0, 0.0);
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
            width: 40px;
            height: 40px;
            object-fit: contain;
        `;
        
        button.appendChild(icon);
        
        button.addEventListener('mouseover', () => {
            button.style.transform = 'scale(1.1)';
            icon.style.filter = 'invert(1)'; // Invert colors on hover
        });
        
        button.addEventListener('mouseout', () => {
            button.style.transform = 'scale(1)';
            icon.style.filter = 'none'; // Reset filter on mouse out
            icon.style.filter = 'invert(0)'; // Invert colors on hover

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
            background: rgba(0, 0, 0, 0.85);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1001;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        `;
        
        // Create the modal content
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: #1a1a1a;
            padding: 30px;
            border-radius: 6px;
            width: 320px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
            position: relative;
            color: white;
            max-height: 80vh;
            overflow-y: auto;
        `;
        
        // Create title
        const title = document.createElement('h2');
        title.textContent = 'Settings';
        title.style.cssText = `
            margin: 0 0 24px 0;
            color: white;
            font-size: 20px;
            font-weight: 500;
            text-align: center;
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
            color: #666;
            cursor: pointer;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: color 0.2s;
        `;

        closeButton.addEventListener('mouseover', () => {
            closeButton.style.color = '#fff';
        });
        closeButton.addEventListener('mouseout', () => {
            closeButton.style.color = '#666';
        });
        closeButton.addEventListener('click', () => this.closeSettingsModal());
        
        
        // Volume controls
        const volumeSection = this.createVolumeSection();
        const checkboxSection = this.createCheckboxSection();

        // Assemble modal
        modal.appendChild(title);
        modal.appendChild(closeButton);
        modal.appendChild(volumeSection);
        modal.appendChild(checkboxSection);

        // Add save button
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.style.cssText = `
            width: 100%;
            padding: 12px;
            font-size: 14px;
            font-weight: 500;
            letter-spacing: 0.5px;
            border: none;
            border-radius: 4px;
            background: #4CAF50;
            color: white;
            cursor: pointer;
            transition: all 0.2s ease;
            margin-top: 20px;
        `;
        saveButton.addEventListener('mouseover', () => {
            saveButton.style.background = '#43a047';
        });
        saveButton.addEventListener('mouseout', () => {
            saveButton.style.background = '#4CAF50';
        });
        saveButton.addEventListener('click', () => {
            // Add fade out animation
            modalContainer.style.transition = 'opacity 0.3s ease';
            modalContainer.style.opacity = '0';
            this.saveSettings();
            setTimeout(() => {
                this.closeSettingsModal();
            }, 300);
        });

        
        modal.appendChild(saveButton);
        modalContainer.appendChild(modal);
        
        // Add to DOM
        document.body.appendChild(modalContainer);
        this.settingsModal = modalContainer;
        this.onModalOpenCallback?.(); // Call the open callback if set
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

    private createCheckboxSection(): HTMLElement {
        const section = document.createElement('div');
        section.style.cssText = `
            margin-top: 24px;
            padding-top: 20px;
            border-top: 1px solid #333;
        `;
        
        // Helper function to create a checkbox
        const createCheckbox = (label: string, checked: boolean, onChange: (checked: boolean) => void) => {
            const container = document.createElement('div');
            container.style.cssText = `
                display: flex;
                align-items: center;
                margin-bottom: 12px;
                cursor: pointer;
            `;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = checked;
            checkbox.style.cssText = `
                width: 16px;
                height: 16px;
                margin-right: 10px;
                cursor: pointer;
                accent-color: #4CAF50;
            `;
            
            const labelElement = document.createElement('label');
            labelElement.textContent = label;
            labelElement.style.cssText = `
                font-size: 14px;
                color: #ddd;
                cursor: pointer;
                user-select: none;
            `;
            
            // Handle change events
            checkbox.addEventListener('change', () => {
                onChange(checkbox.checked);
                this.onSettingsChangeCallbacks.forEach(callback => callback(label, checkbox.checked));
            });
            
            // Make the entire container clickable
            container.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    onChange(checkbox.checked);
                    this.onSettingsChangeCallbacks.forEach(callback => callback(label, checkbox.checked));

                }
            });
            
            container.appendChild(checkbox);
            container.appendChild(labelElement);
            return container;
        };
        
        // Create all checkboxes
        const muteAllCheckbox = createCheckbox('Mute All Sound', this.settings.muteAll, (checked) => {
            console.log(`Mute All Sound changed to: ${checked}`);
            this.settings.muteAll = checked;
            console.log('settings after muteAll change:', this.settings);
        });
        
        const muteMusicCheckbox = createCheckbox('Mute Music', this.settings.muteMusic, (checked) => {
            this.settings.muteMusic = checked;
        });
        
        const muteSfxCheckbox = createCheckbox('Mute Sound Effects', this.settings.muteSfx, (checked) => {
            this.settings.muteSfx = checked;
        });
        
        const devModeCheckbox = createCheckbox('Developer Mode', this.settings.devMode, (checked) => {
            this.settings.devMode = checked;
        });
        
        // Add all checkboxes to section
        section.appendChild(muteAllCheckbox);
        section.appendChild(muteMusicCheckbox);
        section.appendChild(muteSfxCheckbox);
        section.appendChild(devModeCheckbox);
        
        return section;
    }
    
    private closeSettingsModal(): void {
        if (this.settingsModal && this.settingsModal.parentNode) {
            document.body.removeChild(this.settingsModal);
            this.settingsModal = null;
            this.onModalCloseCallback?.(); // Call the close callback if set
        }
    }
    
    private saveSettings(): void {
        console.log('Saving settings:', this.settings);
        localStorage.setItem('gameSettings', JSON.stringify(this.settings));
    }
    

}