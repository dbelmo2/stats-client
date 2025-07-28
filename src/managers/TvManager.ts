import { Text, Graphics, Sprite, BitmapText } from 'pixi.js';
import { CRTFilter } from 'pixi-filters';
import { TypeText } from '../components/ui/TypeText';
import { YoutubeApiManager } from './YoutubeApiManager';
import { formatDuration } from '../utils/time';

export interface TvScreen {
    text: string;
    template?: 'default' | 'api' | 'live'; // 'default' for regular screens, 'api' for API data
    duration?: number; // milliseconds, 0 = permanent
    priority?: number; // higher = more important
    id?: string; // unique identifier
}

export class TvManager {
    private static instance: TvManager;
    private tvMask: Graphics | null = null;
    private currentTextObjects: (Text | BitmapText | TypeText)[] = [];
    private currentSprites: Sprite[] = [];

    // Screen queue system
    private screenQueue: TvScreen[] = [];
    private currentScreen: TvScreen | null = null;
    private screenTimer: number = 0;
    private isDisplaying: boolean = false;
    
    // Default settings
    private readonly defaultDuration: number = 5000; // 5 seconds

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
        this.clearScreen();
        
        j1Sprite.addChild(this.tvMask);

    }


    public async startTv(): Promise<void> {
        if (!this.tvMask) {
            console.error('TvManager: TV mask not initialized. Call initialize() first.');
            return;
        }
        
        // Clear any existing text objects
        this.clearScreen();
        
        // Display default screen
        
        console.log('TvManager initialized with TV mask');

        this.displayDefaultScreen();
        this.displayApiScreen();
        this.displayLiveScreen(); // Show live screen for 10 seconds

    }   


    private displayApiScreen(duration?: number): void {
        this.displayScreen({
            text: 'api',
            priority: 1,
            id: 'api',
            template: 'api',
            duration: duration ?? 2000
        });
    }

    private displayLiveScreen(duration?: number): void {
        this.displayScreen({
            text: 'live',
            priority: 1,
            id: 'live',
            template: 'live',
            duration: duration ?? 10000
        });
    }

    private async useLogoTemplate(screen: TvScreen): Promise<void> {
        if (!this.tvMask) {
            console.error('TvManager: TV mask not initialized. Call initialize() first.');
            return;
        }
        
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
        this.addSprite(logo);

        // Set up screen tracking
        this.currentScreen = screen;
        this.screenTimer = 0;
        this.isDisplaying = true;
    }
    


    /**
     * Display a screen on the TV screen
     */
    public displayScreen(screen: TvScreen): void {
        // Add to queue if not immediate
        if (this.isDisplaying && screen.priority !== undefined && screen?.priority > 10) {
            // High priority screen - interrupt current
            console.log(`TvManager: Interrupting current screen with high priority: "${screen.text}"`);

            this.screenQueue.unshift(screen);
            this.skipcurrentScreen();
        } else {
            // Add to queue
                        console.log(`TvManager: Queued screen: "${screen.text}"`);

            this.screenQueue.push(screen);
        }
        
        // Start processing if not already displaying
        if (!this.isDisplaying) {
            console.log(`TvManager: Started displaying screen: "${screen.text}"`);
            this.processNextScreen();
        }
    }
    

    /**
     * Display immediate screen (bypasses queue)
     */
    public displayImmediate(text: string, duration: number = this.defaultDuration): void {
        this.displayScreen({
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
        let screen = '';
        
        if (stats.totalPlayers) {
            screen += `Players Online: ${stats.totalPlayers}\n`;
        }
        
        if (stats.currentLeader) {
            screen += `Leader: ${stats.currentLeader}\n`;
        }
        
        if (stats.matchTime) {
            screen += `Match Time: ${stats.matchTime}\n`;
        }
        
        if (stats.remainingTime) {
            screen += `Time Left: ${stats.remainingTime}`;
        }
        
        this.displayScreen({
            text: screen.trim(),
            duration: 3000,
            priority: 5,
            id: 'game_stats'
        });
    }
    
    /**
     * Display kill feed screens
     */
    public displayKillFeed(killer: string, victim: string): void {
        this.displayScreen({
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
        let screen = '';
        let priority = 8;
        
        switch (event) {
            case 'start':
                screen = 'Match Starting!';
                if (details) screen += `\n${details}`;
                break;
            case 'end':
                screen = 'Match Ended!';
                if (details) screen += `\n${details}`;
                priority = 9;
                break;
            case 'warning':
                screen = details || 'Warning!';
                priority = 9;
                break;
        }
        
        this.displayScreen({
            text: screen,
            duration: 4000,
            priority,
            id: `match_${event}_${Date.now()}`
        });
    }
    
    /**
     * Clear all screens and display default
     */
    public clearAll(): void {
        this.screenQueue = [];
        this.skipcurrentScreen();
        this.displayDefaultScreen();
    }
    
    /**
     * Display default/idle screen
     */
    public displayDefaultScreen(duration?: number): void {
        this.displayScreen({
            text: 'default',
            priority: 1,
            id: 'default',
            duration: duration ?? 5000
        });
    }
    
    /**
     * Update method - call this in your game loop
     */
    public update(deltaMs: number): void {
        if (!this.isDisplaying) return;
        
        // Update screen timer
        if (this.currentScreen && this.currentScreen.duration && this.currentScreen.duration > 0) {
            this.screenTimer += deltaMs;
            if (this.screenTimer >= this.currentScreen.duration) {
                this.finishcurrentScreen();
            }
        }
    }
    
    /**
     * Process the next screen in queue
     */
    private processNextScreen(): void {
        if (this.screenQueue.length === 0) {
            this.isDisplaying = false;
            this.displayDefaultScreen();
            return;
        }
        
        // Sort by priority (higher first)
        this.screenQueue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        
        const screen = this.screenQueue.shift()!;
        console.log(`TvManager: Processing screen: "${screen.text}" with priority ${screen.priority} and duration ${screen.duration}`);
        this.showScreen(screen);
    }
    
    /**
     * Display the actual screen on screen
     */
    private showScreen(screen: TvScreen): void {
        if (!this.tvMask) {
            console.warn('TvManager: TV mask not initialized');
            return;
        }
        
        // Clear any existing text objects
        this.clearScreen();
        

        switch (screen.template) {
            case 'api': {
                this.useApiScreenTemplate(screen);
                break;
            }
            case 'live': {
                this.useLiveScreenTemplate(screen);
                break;
            }
            default: {
                this.useLogoTemplate(screen);
            }


        
        console.log(`TvManager: Displaying screen: "${screen.text}"`);
        }
    }




 


    private async useApiScreenTemplate(screen: TvScreen): Promise<void> {
        if (!this.tvMask) return;
        
        const apiData = await YoutubeApiManager.getInstance().getStats();

        const statSpeed = 75; // Typing speed for stats

        const introTitle = new TypeText({
            text: 'Welcome to the H3 livestream late tracker!',
            style: {
                align: 'center',
                fontFamily: '"Pixel", Arial, sans-serif',
                fontStyle: 'normal',
                fontSize: 34,
                fill: '#ffffff',
                wordWrap: true,
                wordWrapWidth: 453,
            }
        });





        const generalStatsTitle = new TypeText({
            text: 'General Stats',
            style: {
                align: 'left',
                fontFamily: '"Pixel", Arial, sans-serif',
                fontStyle: 'normal',
                fontSize: 40,
                fill: '#ffffff',
                wordWrap: true,
                wordWrapWidth: 453
            }
        });

        const totalLateTime = new TypeText({ 
            typingSpeed: statSpeed,
            text: `• Total late time: ${apiData.humanReadable}`,
            style:  {
                align: 'left',
                fontFamily: '"Pixel", Arial, sans-serif', // Use web-safe font
                fontStyle: 'normal',
                fontSize: 30, // Smaller font size
                fill: '#ffffff',
                wordWrap: true,
                wordWrapWidth: 453, // Wrap text to fit TV screen
                lineHeight: 33

            }
         })

        const averageLateTime = new TypeText({
            typingSpeed: statSpeed,
            text: `• Average late time: ${formatDuration(apiData.averageLateTime)}`,
            style:  {
                align: 'left',
                fontFamily: '"Pixel", Arial, sans-serif', // Use web-safe font
                fontStyle: 'normal',
                fontSize: 30, // Smaller font size
                fill: '#ffffff',
                wordWrap: true,
                wordWrapWidth: 453, // Wrap text to fit TV screen
                lineHeight: 33
            }
        });

        const maxLateTime = new TypeText({
            text: `• Max late time: ${formatDuration(apiData.maxLateTime)}!`,
            style:  {
                align: 'left',
                fontFamily: '"Pixel", Arial, sans-serif', // Use web-safe font
                fontStyle: 'normal',
                fontSize: 30, // Smaller font size
                fill: '#ffffff',
                wordWrap: true,
                wordWrapWidth: 453, // Wrap text to fit TV screen
                lineHeight: 33
            }
        });

        const tipText = new TypeText({
            text: 'Try picking up a tomato!',
            style: {
                align: 'left',
                fontFamily: '"Pixel", Arial, sans-serif', // Use web-safe font
                fontStyle: 'normal',
                fontSize: 36, // Smaller font size for tips
                fill: '#ffffff',
                wordWrap: true,
                wordWrapWidth: 453, // Wrap text to fit TV screen
            }
        });

        this.addTextObject(introTitle.text);
        this.currentTextObjects.push(introTitle);
        introTitle.setPosition(75, 100); // Set position within the TV mask
        introTitle.setAnchor(0, 0); // Set anchor to top-left
        await introTitle.type();
        introTitle.killCursor(); // Stop cursor blinking after intro
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait before typing
        this.clearScreen();


        this.addTextObject(generalStatsTitle.text);
        this.currentTextObjects.push(generalStatsTitle);
        generalStatsTitle.setPosition(50, 25); // Set position within the TV mask
        generalStatsTitle.setAnchor(0, 0); // Set anchor to top-left
        await generalStatsTitle.type();
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait before showing next text
        generalStatsTitle.killCursor()



        // Total late time text
        totalLateTime.setPosition(50, 80); // Set position within the TV mask
        totalLateTime.setAnchor(0, 0); // Set anchor to top-left

        this.addTextObject(totalLateTime.text);
        this.currentTextObjects.push(totalLateTime);

        await totalLateTime.type();
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait a bit before showing tip
        totalLateTime.killCursor(); // Stop cursor blinking


        this.addTextObject(averageLateTime.text);
        this.addTextObject(maxLateTime.text);   
        this.currentTextObjects.push(averageLateTime, maxLateTime);

        averageLateTime.setPosition(50, 160); 
        averageLateTime.setAnchor(0, 0); 
        maxLateTime.setPosition(50, 240); 
        maxLateTime.setAnchor(0, 0); 

        await averageLateTime.type();
        await new Promise((resolve) => setTimeout(resolve, 1000));
        averageLateTime.killCursor();
        await maxLateTime.type();
        await new Promise((resolve) => setTimeout(resolve, 15000));

        maxLateTime.killCursor();
        this.clearScreen();

        // daily stats

        const title = new TypeText({
            text: 'Daily Average Late Times',
            style: {
                align: 'left',
                fontFamily: '"Pixel", Arial, sans-serif',
                fontStyle: 'normal',
                fontSize: 40,
                fill: '#ffffff',
                wordWrap: true,
                wordWrapWidth: 453,
            }
        });

        const dailyStatTexts = Object.entries(apiData.daily).map(([day, data]) => {
            return new TypeText({
                text: `• ${day.charAt(0).toUpperCase()}: ${formatDuration(data.totalLateTime / data.count)}`,
                style: {
                    align: 'left',
                    fontFamily: '"Pixel", Arial, sans-serif',
                    fontStyle: 'normal',
                    fontSize: 30,
                    fill: '#ffffff',
                    wordWrap: true,
                    wordWrapWidth: 453,
                    
                },
                typingSpeed: 75
            });
        });

        this.addTextObject(title.text);
        this.currentTextObjects.push(title);
        title.setPosition(50, 25);
        title.setAnchor(0, 0);

        
        for (const statText of dailyStatTexts) {
            this.addTextObject(statText.text);
            this.currentTextObjects.push(statText);
            statText.setAnchor(0, 0);
            statText.setPosition(50, 75 + (dailyStatTexts.indexOf(statText) * 35));
        }



        await title.type();
        title.killCursor();
        for (const statText of dailyStatTexts) {
            await statText.type();
            await new Promise((resolve) => setTimeout(resolve, 1000)); // Delay between each daily stat
            statText.killCursor(); // Stop cursor blinking after each stat
        }
        await new Promise((resolve) => setTimeout(resolve, 15000)); // Wait before showing tip
        this.clearScreen();





        // Tip text
        tipText.setPosition(50, 50);
        tipText.setAnchor(0, 0);
        this.addTextObject(tipText.text);
        this.currentTextObjects.push(tipText);

        console.log('calling type for tipText');
        await tipText.type();

        // Set up screen tracking
        this.currentScreen = screen;
        this.screenTimer = 0;
        this.isDisplaying = true;

     
    }

    private async useLiveScreenTemplate(screen: TvScreen): Promise<void> {
        if (!this.tvMask) return;

        this.clearScreen();

        const banner = Sprite.from('liveBanner');
        const ianSprite = Sprite.from('ian');
        const danSprite = Sprite.from('dan');

        banner.anchor.set(0.5);
        ianSprite.anchor.set(0.5);
        danSprite.anchor.set(0.5);


        banner.width = this.tvMask.width * 0.65; // Scale to fit TV mask
        banner.height = this.tvMask.height * 0.65; // Adjust height to fit
        banner.x = this.tvMask.width / 2;
        banner.y = this.tvMask.height / 2 - 75; // Position above center



        // Calculate the aspect ratio for each sprite
        const ianAspectRatio = ianSprite.height / ianSprite.width;
        const danAspectRatio = danSprite.height / danSprite.width;

        // Set the desired width based on TV mask size
        const ianWidth = this.tvMask.width * 0.25;
        const danWidth = this.tvMask.width * 0.25;

        // Calculate heights that maintain the aspect ratio
        const ianHeight = ianWidth * ianAspectRatio;
        const danHeight = danWidth * danAspectRatio;


        ianSprite.width = ianWidth; // Scale to fit TV mask
        ianSprite.height = ianHeight; // Adjust height
        ianSprite.x = (ianWidth / 2) + 5;
        ianSprite.y = this.tvMask.height - (ianHeight / 2) - 15; // Position at bottom left


        danSprite.width = danWidth; // Scale to fit TV mask
        danSprite.height = danHeight; // Adjust height
        danSprite.x = this.tvMask.width - (danWidth / 2) - 15; // Position at bottom right
        danSprite.y = this.tvMask.height - (danHeight / 2) - 15; // Position at bottom right

        this.addSprite(banner);
        this.addSprite(ianSprite);
        this.addSprite(danSprite);

        // Set up screen tracking
        this.currentScreen = screen;
        this.screenTimer = 0;
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


    private addSprite(sprite: Sprite): void {
        if (!this.tvMask) return;
        this.currentSprites.push(sprite);
        this.tvMask.addChild(sprite);
    }


    private clearScreen(): void {
        if (!this.tvMask) return;

        for (const textObject of this.currentTextObjects) {
            const pixiText = textObject instanceof TypeText ? textObject.text : textObject;
            this.tvMask.removeChild(pixiText);
            textObject.destroy(); // Clean up PIXI object
        }

        this.currentTextObjects = [];

        for (const sprite of this.currentSprites) {
            this.tvMask.removeChild(sprite);
            sprite.destroy(); // Clean up PIXI object
        }
        this.currentSprites = [];
    }


    /**
     * Finish current screen and process next
     */
    private finishcurrentScreen(): void {
        this.currentScreen = null;
        this.screenTimer = 0;
        this.processNextScreen();
    }
    
    /**
     * Skip current screen immediately
     */
    private skipcurrentScreen(): void {
        this.clearScreen();
        this.finishcurrentScreen();
    }


    /**
     * Get current screen info
     */
    public getcurrentScreen(): TvScreen | null {
        return this.currentScreen;
    }
    
    /**
     * Get queue length
     */
    public getQueueLength(): number {
        return this.screenQueue.length;
    }
    
    /**
     * Remove specific screen from queue
     */
    public removeScreen(id: string): boolean {
        const index = this.screenQueue.findIndex(msg => msg.id === id);
        if (index !== -1) {
            this.screenQueue.splice(index, 1);
            return true;
        }
        return false;
    }
    
    /**
     * Cleanup when game session ends
     */
    public cleanup(): void {
        this.screenQueue = [];
        this.currentScreen = null;
        this.screenTimer = 0;
        this.isDisplaying = false;
        this.intervals.forEach(interval => clearInterval(interval));
        this.clearScreen();

    }
}