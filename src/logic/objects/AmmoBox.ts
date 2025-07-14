import { Container, Sprite, Text } from 'pixi.js';
import type { Player } from '../Player';
import { testForAABB } from '../collision';

export class AmmoBox extends Container {
    private body: Sprite;
    private labelIsShowing: boolean = false;
    private socketManager: any; // Replace with actual socket manager type
    private readonly labelText: string = 'Press E';
    private floatingLabel: Text | null = null;

    // Animation properties
    private isAnimating: boolean = false;
    private fadeSpeed: number = 0.03; // Speed of fade animation (0.01 = slow, 0.1 = fast)

    public readonly boxWidth = 100;
    public readonly boxHeight = 100;

    constructor(x: number, y: number, socketManager: any) {
        super();

        this.socketManager = socketManager;

        // Create box
        this.body = Sprite.from('ammoBox');
        this.body.width = this.boxWidth;    
        this.body.height = this.boxHeight;

        this.addChild(this.body);
        this.x = x;
        this.y = y;
    }

    public getBounds() {
        return this.body.getBounds();
    }

    public destroy() {
        this.body.destroy();
        if (this.floatingLabel) {
            this.floatingLabel.destroy();
            this.floatingLabel = null;
        }
        super.destroy();
    }

    
    public update(player?: Player): void {

        this.updateFadeAnimation();


        if (!player || !player.getIsBystander()) {
            this.hideLabel();
            return;
        }
        if (testForAABB(player, this)) {
            this.showLabel();
        } else {
            this.hideLabel();
        }

    }

    public handleAmmoBoxInteraction(player: Player): void {
        console.log(`Handling ammo box interaction for player`);
        if (this.labelIsShowing === false || !player.getIsBystander()) return;
        this.socketManager.emit('toggleBystander', true);
        this.hideLabel();
    }

    private showLabel(): void {
        if (this.labelIsShowing) return; // Already showing

        if (!this.floatingLabel) {
            this.floatingLabel = new Text({
                text: 'Press E',
                style: {
                    fontFamily: 'Pixel', // Ensure this font is loaded
                    fontSize: 26,
                    fill: 0xffffff,
                }   
            });
            this.floatingLabel.anchor.set(0.5);
            this.floatingLabel.position.set(50, -50);
            this.floatingLabel.alpha = 0; // Start invisible
            this.addChild(this.floatingLabel);
        }

        this.labelIsShowing = true;
        this.isAnimating = true;
    }

    private hideLabel(): void {
        if (!this.labelIsShowing && !this.floatingLabel) return;

        this.labelIsShowing = false;
        if (this.floatingLabel) {
            this.floatingLabel.destroy();
            this.removeChild(this.floatingLabel);
            this.floatingLabel = null;
        }
    }

    private updateFadeAnimation(): void {
        if (!this.isAnimating || !this.floatingLabel) return;

        if (this.labelIsShowing) {
            // Fade in
            this.floatingLabel.alpha += this.fadeSpeed;
            if (this.floatingLabel.alpha >= 1) {
                this.floatingLabel.alpha = 1;
                this.isAnimating = false;
                console.log(`Label fade in complete`);
            }
        } else {
            // Fade out
            this.floatingLabel.alpha -= this.fadeSpeed;
            if (this.floatingLabel.alpha <= 0) {
                this.floatingLabel.alpha = 0;
                this.isAnimating = false;
                
                // Destroy label when fade out is complete
                this.floatingLabel.destroy();
                this.removeChild(this.floatingLabel);
                this.floatingLabel = null;
                console.log(`Label fade out complete and destroyed`);
            }
        }
    }

}