import { Graphics, Container, TextStyle, Text, Sprite } from 'pixi.js';

export class EnemyPlayer extends Container {
  private id: string;
  private body: Graphics;
  private healthBar: Graphics;
  private maxHealth: number = 100;
  private serverHealth: number = 100;
  private predictedHealth: number = 100;
  private readonly HEALTH_BAR_WIDTH = 50;
  private readonly HEALTH_BAR_HEIGHT = 5;
  private damageFlashTimeout?: NodeJS.Timeout;
  private healthBarContainer: Container;
  private isBystander: boolean;
  private nameText: Text;
  private readonly isSelf: boolean;
  private tomatoSprite: Sprite | null = null;


  constructor(id: string, spawnX: number, spawnY: number, isBystander: boolean = true, name: string = 'unknown player', isSelf = false) {
    
    super();
    this.isSelf = isSelf;
    this.id = id;
    this.isBystander = isBystander;
    // Create main body
    const bodyColor = isSelf ? 0x800080 : 0xff9900;
    this.body = new Graphics().rect(0, 0, 50, 50).fill(bodyColor);
    this.addChild(this.body);

    // Create separate container for UI elements
    this.healthBarContainer = new Container();
    this.addChild(this.healthBarContainer);

        // Create name text
    const nameStyle = new TextStyle({
        fontFamily: 'Arial',
        fontSize: 14,
        fill: 0xFFFFFF,
        align: 'center'
    });


    this.nameText = new Text({ text: name, style: nameStyle });
    this.nameText.x = this.body.width / 2; // Center the text
    this.nameText.anchor.set(0.5, 1); // Center horizontally, align bottom
    this.nameText.y = -20; // Position above health bar
    this.healthBarContainer.addChild(this.nameText);

    // Create health bar background
    const healthBarBg = new Graphics()
      .rect(0, -15, this.HEALTH_BAR_WIDTH, this.HEALTH_BAR_HEIGHT)
      .fill(0x333333);
    this.healthBarContainer.addChild(healthBarBg);

    // Create health bar
    this.healthBar = new Graphics();
    this.updateHealthBar();
    this.healthBarContainer.addChild(this.healthBar);

    // Set pivot to bottom center
    this.pivot.set(25, 50);

    // Default spawn location
    this.x = spawnX;
    this.y = spawnY;
  }

  private updateHealthBar(): void {
    this.healthBar.clear();
    const healthPercentage = this.predictedHealth / this.maxHealth;
    const barWidth = this.HEALTH_BAR_WIDTH * healthPercentage;
    
    // Health bar colors based on remaining health
    let color = 0x00ff00; // Green
    if (healthPercentage < 0.6) color = 0xffff00; // Yellow
    if (healthPercentage < 0.3) color = 0xff0000; // Red

    this.healthBar
      .rect(0, -15, barWidth, this.HEALTH_BAR_HEIGHT)
      .fill(color);
  }

  public revertPrediction(): void {
      // Revert to server-authoritative health
      this.predictedHealth = this.serverHealth;
      this.updateHealthBar();
  }

  public setIsBystander(value?: boolean): void {
      if (value === undefined || value === null) return;
      if (this.isBystander === value) return; // No change
      this.isBystander = value;
      // Change color based on bystander status
      this.body.clear();  

      this.body.rect(0, 0, 50, 50).fill(this.isSelf ? 0x800080 : this.isBystander ? 0x808080 : '#db70e5');


      if (this.isBystander === false) {
        this.tomatoSprite = Sprite.from('tomato');
        this.tomatoSprite.width = 30;
        this.tomatoSprite.height = 30;
        // Set anchor to center the sprite horizontally
        this.tomatoSprite.anchor.set(0, -0.5);
        
        // Set z-index of the tomato sprite itself
        this.tomatoSprite.zIndex = 10;
        this.addChild(this.tomatoSprite);
      }
  }
  
  public getIsBystander(): boolean {
      return this.isBystander;
  }

  syncPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  setHealth(updatedServerHealth?: number): void {
      if (updatedServerHealth === undefined) return;
      this.serverHealth = updatedServerHealth;
      // Only lower predicted health if server health is lower
      // NOTE: this will likely break if health regen is introduced
      if (updatedServerHealth < this.predictedHealth) {
          this.predictedHealth = updatedServerHealth;
      }
      this.updateHealthBar();
  }

  getServerHealth(): number {
    return this.serverHealth;
  }

  getPredictedHealth(): number {
    return this.predictedHealth;
  }

  damage(amount: number = 10) {
    this.predictedHealth = Math.max(0, this.predictedHealth - amount);
    this.updateHealthBar();

    // Flash effect
    this.body.clear();
    this.body.rect(0, 0, 50, 50).fill(0xff0000);

    this.damageFlashTimeout = setTimeout(() => {
      this.body.clear();
      this.body.rect(0, 0, 50, 50).fill(0xff9900);
    }, 100);
  }

  getId(): string {
    return this.id;
  }

  getBounds() {
      // Only return bounds of the body
      return this.body.getBounds();
  }
  
  destroy(): void {
    // Clear any pending timeouts
    if (this.damageFlashTimeout) {
        clearTimeout(this.damageFlashTimeout);
    }

    // Clean up graphics
    this.body.destroy();
    this.healthBar.destroy();
    this.nameText.destroy();
    this.healthBarContainer.destroy();

    // Call parent destroy method
    super.destroy({
        children: true,
        texture: true
    });
  }
  

}