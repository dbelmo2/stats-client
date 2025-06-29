export class ModalManager {
    private static instance: ModalManager;
    private activeModal: HTMLElement | null = null;
    
    private constructor() {}
    
    public static getInstance(): ModalManager {
        if (!ModalManager.instance) {
            ModalManager.instance = new ModalManager();
        }
        return ModalManager.instance;
    }
    
    public showModal(options: {
        title: string,
        message: string,
        buttonText: string,
        buttonAction: () => void,
        isWarning?: boolean
    }): void {
        // Remove any existing modal
        this.closeModal();
        
        // Create modal container
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
            z-index: 2000;
        `;
        
        // Create modal content
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: #2c2c2c;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            max-width: 400px;
            width: 100%;
            border: ${options.isWarning ? '2px solid #ff6b6b' : '2px solid #4CAF50'};
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        `;
        
        // Create title
        const title = document.createElement('h2');
        title.textContent = options.title;
        title.style.cssText = `
            color: ${options.isWarning ? '#ff6b6b' : 'white'};
            margin-top: 0;
            font-size: 24px;
        `;
        
        // Create message
        const message = document.createElement('p');
        message.textContent = options.message;
        message.style.cssText = `
            color: white;
            margin: 15px 0;
            font-size: 16px;
            line-height: 1.5;
        `;
        
        // Create button
        const button = document.createElement('button');
        button.textContent = options.buttonText;
        button.style.cssText = `
            margin: 10px 0 0;
            padding: 10px 20px;
            font-size: 16px;
            border: none;
            border-radius: 4px;
            background: ${options.isWarning ? '#ff6b6b' : '#4CAF50'};
            color: white;
            cursor: pointer;
            transition: background 0.3s;
        `;
        
        button.addEventListener('mouseover', () => {
            button.style.background = options.isWarning ? '#ff4949' : '#3e8e41';
        });
        
        button.addEventListener('mouseout', () => {
            button.style.background = options.isWarning ? '#ff6b6b' : '#4CAF50';
        });
        
        button.addEventListener('click', () => {
            this.closeModal();
            options.buttonAction();
        });
        
        // Assemble modal
        modal.appendChild(title);
        modal.appendChild(message);
        modal.appendChild(button);
        modalContainer.appendChild(modal);
        
        // Add to DOM
        document.body.appendChild(modalContainer);
        
        // Store reference to active modal
        this.activeModal = modalContainer;


        if (options.isWarning) {
            // Create pulsing animation for warning
            const style = document.createElement('style');
            style.textContent = `
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(255, 107, 107, 0.7); }
                    70% { box-shadow: 0 0 0 15px rgba(255, 107, 107, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(255, 107, 107, 0); }
                }
            `;
            document.head.appendChild(style);
            modal.style.animation = 'pulse 1.5s infinite';
            
            // Remove style element when modal is closed
            const originalCloseModal = this.closeModal.bind(this);
            this.closeModal = () => {
                originalCloseModal();
                document.head.removeChild(style);
                this.closeModal = originalCloseModal;
            };
        }

    }
    
    public closeModal(): void {
        if (this.activeModal && this.activeModal.parentNode) {
            document.body.removeChild(this.activeModal);
            this.activeModal = null;
        }
    }
}