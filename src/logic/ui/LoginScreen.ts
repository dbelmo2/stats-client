type Region = 'NA' | 'EU' | 'ASIA' | 'GLOBAL';;

export const loginScreen = () => new Promise<{ name: string, region: Region }>((resolve) => {
    // Create modal container with dark overlay
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
        z-index: 1000;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    `;

    // Create modal content
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: #1a1a1a;
        padding: 30px;
        border-radius: 6px;
        width: 280px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        display: flex;
        flex-direction: column;
        align-items: center;
    `;

    // Create title
    const title = document.createElement('h2');
    title.textContent = 'Join Game';
    title.style.cssText = `
        margin: 0 0 48px 0;
        color: white;
        font-size: 20px;
        font-weight: 500;
        text-align: center;
    `;
    modal.appendChild(title);

    // Create name input (no label)
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Name';
    input.maxLength = 15;
    input.style.cssText = `
        width: 100%;
        padding: 12px 15px;
        font-size: 14px;
        border: none;
        border-radius: 4px;
        background: #252525;
        color: white;
        outline: none;
        box-sizing: border-box;
        margin-bottom: 12px;
        transition: background 0.2s;
    `;
    input.addEventListener('focus', () => {
        input.style.background = '#303030';
    });
    input.addEventListener('blur', () => {
        input.style.background = '#252525';
    });
    modal.appendChild(input);

    // Create region dropdown (no label)
    const regionSelect = document.createElement('select');
    regionSelect.style.cssText = `
        width: 100%;
        padding: 12px 15px;
        font-size: 14px;
        border: none;
        border-radius: 4px;
        background: #252525;
        color: white;
        outline: none;
        cursor: pointer;
        box-sizing: border-box;
        margin-bottom: 20px;
        appearance: none;
        -webkit-appearance: none;
        background-image: url("data:image/svg+xml;utf8,<svg fill='white' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/><path d='M0 0h24v24H0z' fill='none'/></svg>");
        background-repeat: no-repeat;
        background-position: right 10px center;
        transition: background 0.2s;
    `;

    regionSelect.addEventListener('focus', () => {
        regionSelect.style.background = '#303030';
        regionSelect.style.backgroundImage = "url(\"data:image/svg+xml;utf8,<svg fill='white' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/><path d='M0 0h24v24H0z' fill='none'/></svg>\")";
        regionSelect.style.backgroundRepeat = "no-repeat";
        regionSelect.style.backgroundPosition = "right 10px center";
    });
    
    regionSelect.addEventListener('blur', () => {
        regionSelect.style.background = '#252525';
        regionSelect.style.backgroundImage = "url(\"data:image/svg+xml;utf8,<svg fill='white' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/><path d='M0 0h24v24H0z' fill='none'/></svg>\")";
        regionSelect.style.backgroundRepeat = "no-repeat";
        regionSelect.style.backgroundPosition = "right 10px center";
    });

    // Create placeholder option
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = 'Select Region';
    placeholderOption.disabled = true;
    placeholderOption.selected = true;
    regionSelect.appendChild(placeholderOption);

    // Add region options
    const regions: Region[] = ['NA', 'EU', 'ASIA', 'GLOBAL'];
    regions.forEach(region => {
        const option = document.createElement('option');
        option.value = region;
        option.textContent = region === 'NA' ? 'North America' : 
                             region === 'EU' ? 'Europe' : 
                             region === 'ASIA' ? 'Asia' :
                              'Global';
        regionSelect.appendChild(option);
    });

    // Try to load previously selected region from localStorage
    try {
        const savedSettings = localStorage.getItem('gameSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            if (settings.region && regions.includes(settings.region)) {
                regionSelect.value = settings.region;
                placeholderOption.selected = false;
            }
        }
    } catch (e) {
        console.error('Error loading saved region', e);
    }

    modal.appendChild(regionSelect);

    // Create button
    const button = document.createElement('button');
    button.textContent = 'Play';
    button.style.cssText = `
        width: fit-content;
        padding: 12px 24px;
        font-size: 14px;
        font-weight: 500;
        letter-spacing: 0.5px;
        border: none;
        border-radius: 4px;
        background: #4CAF50;
        color: white;
        cursor: pointer;
        transition: all 0.2s ease;
        opacity: 0.6;
        pointer-events: none;
        align-self: center;
        margin-top: 12px;
    `;
    button.disabled = true;

    // Button effects
    button.addEventListener('mouseover', () => {
        if (!button.disabled) {
            button.style.background = '#43a047';
        }
    });
    button.addEventListener('mouseout', () => {
        if (!button.disabled) {
            button.style.background = '#4CAF50';
        }
    });

    // Add input validation
    const checkFormValidity = () => {
        const name = input.value.trim();
        const region = regionSelect.value;
        const isValid = name.length >= 3 && region !== '';
        
        button.disabled = !isValid;
        if (isValid) {
            button.style.opacity = '1';
            button.style.pointerEvents = 'auto';
        } else {
            button.style.opacity = '0.6';
            button.style.pointerEvents = 'none';
        }
    };

    input.addEventListener('input', checkFormValidity);
    regionSelect.addEventListener('change', checkFormValidity);
    checkFormValidity(); // Initial check

    // Handle form submission
    const handleSubmit = () => {
        const name = input.value.trim();
        const selectedRegion = regionSelect.value as Region;
        
        if (name.length >= 3 && selectedRegion) {
            // Save the region selection to localStorage
            try {
                const savedSettings = localStorage.getItem('gameSettings');
                let settings = savedSettings ? JSON.parse(savedSettings) : {};
                settings.region = selectedRegion;
                localStorage.setItem('gameSettings', JSON.stringify(settings));
            } catch (e) {
                console.error('Error saving region', e);
            }
            
            // Add fade out animation
            modalContainer.style.transition = 'opacity 0.3s ease';
            modalContainer.style.opacity = '0';
            
            setTimeout(() => {
                document.body.removeChild(modalContainer);
                resolve({ name, region: selectedRegion });
            }, 300);
        }
    };

    button.addEventListener('click', handleSubmit);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !button.disabled) handleSubmit();
    });

    // Add minimal version text
    const versionInfo = document.createElement('div');
    versionInfo.textContent = 'v0.1.0';
    versionInfo.style.cssText = `
        color: #666;
        font-size: 11px;
        margin-top: 16px;
        text-align: center;
        opacity: 0.7;
    `;
    modal.appendChild(button);
    modal.appendChild(versionInfo);
    
    modalContainer.appendChild(modal);
    document.body.appendChild(modalContainer);

    // Focus input with slight delay to prevent visual glitches
    setTimeout(() => input.focus(), 50);
});