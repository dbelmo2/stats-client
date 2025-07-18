import { Text, Graphics, Sprite, BitmapText } from 'pixi.js';
import { CRTFilter } from 'pixi-filters';
import { TypeText } from '../logic/ui/TypeText';


export interface TvMessage {
    text: string;
    template?: 'default' | 'api'; // 'default' for regular messages, 'api' for API data
    duration?: number; // milliseconds, 0 = permanent
    priority?: number; // higher = more important
    id?: string; // unique identifier
}



// TODO: Need to fix cursor...
// Keep second text. Use this to measure 
export class TvManager {
    private static instance: TvManager;
    private tvMask: Graphics | null = null;
    private currentTextObjects: (Text | BitmapText)[] = [];

    // Message queue system
    private messageQueue: TvMessage[] = [];
    private currentMessage: TvMessage | null = null;
    private messageTimer: number = 0;
    private isDisplaying: boolean = false;
    
    // Default settings
    private readonly defaultDuration: number = 5000; // 5 seconds
    private readonly fadeSpeed: number = 0.05;

    private intervals: NodeJS.Timeout[] = [];
    private CRTFilter: CRTFilter | null = null;
    
    private constructor() {}
    
    public static getInstance(): TvManager {
        if (!TvManager.instance) {
            TvManager.instance = new TvManager();
        }
        return TvManager.instance;
    }
    
    /**
     * Initialize the TV manager with the TV mask element
     */
    public initialize(j1Sprite: Sprite, GAME_WIDTH: number, GAME_HEIGHT: number): void {
        
        this.tvMask = new Graphics().rect(0, 0, 553, 348).fill('#394241');
        this.tvMask.rotation = -0.187; // Rotate the mask to match the TV angle
        this.tvMask.x = GAME_WIDTH - 248;
        this.tvMask.y = GAME_HEIGHT / 2 - 162;
        this.tvMask.stroke({
            color: '#292826',
            width: 10
        });
        

        this.CRTFilter = new CRTFilter({
            curvature: 3,
            lineWidth: 1,
            lineContrast: 0.3,
            verticalLine: true,
            vignetting: 0.20,
            vignettingAlpha: 1,
            vignettingBlur: 0.45,
            time: 0


        });
        this.tvMask.filters = [this.CRTFilter];

        // Clear any existing text objects
        this.clearAllTextObjects();
        
        j1Sprite.addChild(this.tvMask);

    }

    public async startTv(): Promise<void> {
        if (!this.tvMask) {
            console.error('TvManager: TV mask not initialized. Call initialize() first.');
            return;
        }
        
        // Clear any existing text objects
        this.clearAllTextObjects();
        
        // Display default message
        
        console.log('TvManager initialized with TV mask');

        await this.showLoadingScreen();

        this.showMessage({
            text: 'API',
            duration: 0, // Permanent until cleared
            priority: 10,
            id: 'API data',
            template: 'api'
        }); // Show default message on init
    }   

    public async showLoadingScreen(): Promise<void> {
        if (!this.tvMask) {
            console.error('TvManager: TV mask not initialized. Call initialize() first.');
            return;
        }
        
        // Clear any existing text objects
        this.clearAllTextObjects();
        
        const logo = Sprite.from('h3Logo');
        logo.anchor.set(0.5);

    // Scale logo to fit within the TV mask while maintaining aspect ratio
    const maxWidth = this.tvMask.width * 0.8;
    const maxHeight = this.tvMask.height * 0.8;
    const scaleX = maxWidth / logo.width;
    const scaleY = maxHeight / logo.height;
    const scale = Math.min(scaleX, scaleY);
    logo.scale.set(scale);

        logo.x = this.tvMask.width / 2;
        logo.y = this.tvMask.height / 2;
        this.tvMask.addChild(logo);

        await new Promise<void>(resolve => {
            setTimeout(() => {
                if (!this.tvMask) {
                    console.error('TvManager: TV mask not initialized during loading screen.');
                    return;
                }
                this.tvMask.removeChild(logo);
                resolve();
            }, 3000);
        });
    }
    


    /**
     * Display a message on the TV screen
     */
    public displayMessage(message: TvMessage): void {
        // Add to queue if not immediate
        if (this.isDisplaying && message.priority !== undefined && message?.priority > 10) {
            // High priority message - interrupt current
            console.log(`TvManager: Interrupting current message with high priority: "${message.text}"`);

            this.messageQueue.unshift(message);
            this.skipCurrentMessage();
        } else {
            // Add to queue
                        console.log(`TvManager: Queued message: "${message.text}"`);

            this.messageQueue.push(message);
        }
        
        // Start processing if not already displaying
        if (!this.isDisplaying) {
            console.log(`TvManager: Started displaying message: "${message.text}"`);
            this.processNextMessage();
        }
    }
    

    /**
     * Display immediate message (bypasses queue)
     */
    public displayImmediate(text: string, duration: number = this.defaultDuration): void {
        this.displayMessage({
            text,
            duration,
            priority: 100, // Highest priority
            id: 'immediate_' + Date.now()
        });
    }
    
    /**
     * Display game stats on the TV
     */
    public displayGameStats(stats: { 
        totalPlayers?: number, 
        matchTime?: string, 
        currentLeader?: string,
        remainingTime?: string 
    }): void {
        let message = '';
        
        if (stats.totalPlayers) {
            message += `Players Online: ${stats.totalPlayers}\n`;
        }
        
        if (stats.currentLeader) {
            message += `Leader: ${stats.currentLeader}\n`;
        }
        
        if (stats.matchTime) {
            message += `Match Time: ${stats.matchTime}\n`;
        }
        
        if (stats.remainingTime) {
            message += `Time Left: ${stats.remainingTime}`;
        }
        
        this.displayMessage({
            text: message.trim(),
            duration: 3000,
            priority: 5,
            id: 'game_stats'
        });
    }
    
    /**
     * Display kill feed messages
     */
    public displayKillFeed(killer: string, victim: string): void {
        this.displayMessage({
            text: `${killer} eliminated ${victim}!`,
            duration: 2000,
            priority: 7,
            id: 'kill_feed_' + Date.now()
        });
    }
    
    /**
     * Display match events
     */
    public displayMatchEvent(event: 'start' | 'end' | 'warning', details?: string): void {
        let message = '';
        let priority = 8;
        
        switch (event) {
            case 'start':
                message = 'Match Starting!';
                if (details) message += `\n${details}`;
                break;
            case 'end':
                message = 'Match Ended!';
                if (details) message += `\n${details}`;
                priority = 9;
                break;
            case 'warning':
                message = details || 'Warning!';
                priority = 9;
                break;
        }
        
        this.displayMessage({
            text: message,
            duration: 4000,
            priority,
            id: `match_${event}_${Date.now()}`
        });
    }
    
    /**
     * Clear all messages and display default
     */
    public clearAll(): void {
        this.messageQueue = [];
        this.skipCurrentMessage();
        this.displayDefaultMessage();
    }
    
    /**
     * Display default/idle message
     */
    public displayDefaultMessage(): void {
        this.displayMessage({
            text: 'Welcome to Tomato Arena!\nFight for glory!',
            priority: 1,
            id: 'default'
        });
    }
    
    /**
     * Update method - call this in your game loop
     */
    public update(deltaMs: number): void {
        if (!this.isDisplaying) return;
        
        // Update message timer
        if (this.currentMessage && this.currentMessage.duration && this.currentMessage.duration > 0) {
            this.messageTimer += deltaMs;
            
            if (this.messageTimer >= this.currentMessage.duration) {
                this.finishCurrentMessage();
            }
        }
    }
    
    /**
     * Process the next message in queue
     */
    private processNextMessage(): void {
        if (this.messageQueue.length === 0) {
            this.isDisplaying = false;
            return;
        }
        
        // Sort by priority (higher first)
        this.messageQueue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        
        const message = this.messageQueue.shift()!;
        this.showMessage(message);
    }
    
    /**
     * Display the actual message on screen
     */
    private showMessage(message: TvMessage): void {
        if (!this.tvMask) {
            console.warn('TvManager: TV mask not initialized');
            return;
        }
        
        // Clear any existing text objects
        this.clearAllTextObjects();
        

        switch (message.template) {
            case 'api': {
                this.useApiMessageTemplate(message);
                break;
            } 
            default: {
                this.useDefaultMessageTemplate(message);
            }


        
        console.log(`TvManager: Displaying message: "${message.text}"`);
        }
    }




 


    private useApiMessageTemplate(message: TvMessage): void {
        if (!this.tvMask) return;
        





        
        const fullText = `The H3 Podcast has been late a total of... 3 days, 5 hours and 12 minutes!`;
        let currentText = '|';
        // Create new text


        const mainText = new Text({
            text: '',
            style: {

                align: 'left',
                fontFamily: '"Pixel", Arial, sans-serif', // Use web-safe font
                fontStyle: 'normal',
                fontSize: 32, // Smaller font size
                fill: '#ffffff',
                wordWrap: true,
                wordWrapWidth: 453, // Wrap text to fit TV screen
            }
        });


        // Center the text in the TV mask
        mainText.anchor.set(0, 0);
        mainText.x = 50;
        mainText.y = 50;

        
        
        // Add to TV mask
        this.addTextObject(mainText);
        

        // Typewriter Effect
        let index = 0;
        const typingSpeed = 150; // milliseconds per character



        let dotCount = 0;
        let isPaused = false;
        const typeInterval = setInterval(() => {

            if (index < fullText.length && isPaused === false) {
                // replace the cursor with the new character
                currentText = currentText.slice(0, -1); // Remove the cursor
                currentText += fullText[index];
                currentText += '|'; // Add the cursor back
                mainText.text = currentText;
                if (fullText[index] === '.') {
                    dotCount++;
                    if (dotCount === 3) {
                        isPaused = true;
                        setTimeout(() => {
                            isPaused = false;
                            dotCount = 0;
                        }, 2000); // Pause for 2 seconds after 3 dots
                    }
                }
                index++;
            }
        }, typingSpeed);

        // Blink cursor
        const blinkInterval = setInterval(() => {
            const isCursorVisible = mainText.text.endsWith('|');
            console.log(`Cursor is currently ${isCursorVisible ? 'visible' : 'hidden'}`);
            console.log(`Current text: "${mainText.text}"`);
            if (isCursorVisible) {
                mainText.text = mainText.text.slice(0, -1); // Remove cursor
            } else {
                mainText.text += '|'; // Add cursor back
            }
        }, 400);

        this.intervals.push(typeInterval, blinkInterval);

        // Set up message tracking
        this.currentMessage = message;
        this.messageTimer = 0;
        this.isDisplaying = true;
    }






    private useDefaultMessageTemplate(message: TvMessage): void {
        if (!this.tvMask) return;

        // Create new text
        const mainText = new Text({
            text: message.text,
            style: {
                align: 'center',
                fontFamily: '"Pixel", Arial, sans-serif', // Use web-safe font
                fontStyle: 'normal',
                fontSize: 32, // Smaller font size
                fill: '#ffffff',
                wordWrap: true,
                wordWrapWidth: 500, // Wrap text to fit TV screen
                lineHeight: 35
            }
        });
        
        // Center the text in the TV mask
        mainText.anchor.set(0.5);
        mainText.x = this.tvMask.width / 2;
        mainText.y = this.tvMask.height / 2;

        // Add to TV mask
        this.addTextObject(mainText);

        // Set up message tracking
        this.currentMessage = message;
        this.messageTimer = 0;
        this.isDisplaying = true;
    }

        /**
     * Add a text object to the TV mask and track it
     */
    private addTextObject(textObj: Text | BitmapText): void {
        if (!this.tvMask) return;
        
        this.currentTextObjects.push(textObj);
        this.tvMask.addChild(textObj);
    }

    



    private clearAllTextObjects(): void {
        if (!this.tvMask) return;

        for (const textObject of this.currentTextObjects) {
            this.tvMask.removeChild(textObject);
            textObject.destroy();
        }

        this.currentTextObjects = [];
    }


    /**
     * Finish current message and process next
     */
    private finishCurrentMessage(): void {
        this.currentMessage = null;
        this.messageTimer = 0;
        this.processNextMessage();
    }
    
    /**
     * Skip current message immediately
     */
    private skipCurrentMessage(): void {
        this.clearAllTextObjects();
        this.finishCurrentMessage();
    }


    /**
     * Get current message info
     */
    public getCurrentMessage(): TvMessage | null {
        return this.currentMessage;
    }
    
    /**
     * Get queue length
     */
    public getQueueLength(): number {
        return this.messageQueue.length;
    }
    
    /**
     * Remove specific message from queue
     */
    public removeMessage(id: string): boolean {
        const index = this.messageQueue.findIndex(msg => msg.id === id);
        if (index !== -1) {
            this.messageQueue.splice(index, 1);
            return true;
        }
        return false;
    }
    
    /**
     * Cleanup when game session ends
     */
    public cleanup(): void {
        this.messageQueue = [];
        this.currentMessage = null;
        this.messageTimer = 0;
        this.isDisplaying = false;
        this.intervals.forEach(interval => clearInterval(interval));
        this.clearAllTextObjects();

    }
}