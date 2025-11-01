import { Container, Sprite, Text } from 'pixi.js';
import type { Player } from '../../components/game/Player';
import { testForAABB } from '../../systems/Collision';
export class AmmoBush extends Container {
    private body: Sprite;
    private labelIsShowing: boolean = false;
    private floatingLabel: Text | null = null;
    private ammoBox: Sprite; // Assuming 'ammoBush' is the correct asset alias

    // Animation properties
    private isAnimating: boolean = false;
    private fadeSpeed: number = 0.03; // Speed of fade animation (0.01 = slow, 0.1 = fast)


    constructor(x: number, y: number) {
        super();


        // Create box
        this.body = Sprite.from('ammoBush');
        this.body.anchor.set(0.5, 1);

        this.ammoBox = Sprite.from('tomatoBasket');
        this.ammoBox.anchor.set(-1, 1);

        this.addChild(this.body);
        this.addChild(this.ammoBox);
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

    public handleAmmoBushInteraction(player: Player, onInteractionCallback: () => void): void {
        if (this.labelIsShowing === false || !player.getIsBystander()) return;
        onInteractionCallback();
        this.hideLabel();
    }

    private showLabel(): void {
        if (this.labelIsShowing) return; // Already showing

        if (!this.floatingLabel) {
            this.floatingLabel = new Text({
                text: 'Press E',
                style: {
                    fontFamily: 'Pixel',
                    fontSize: 26,
                    fill: 0xffffff,
                }   
            });
            this.floatingLabel.anchor.set(0.5);
            this.floatingLabel.position.set(135, -100);
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
            }
        }
    }

}