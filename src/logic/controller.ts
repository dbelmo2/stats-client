const keyMap: Record<string, keyof Controller['keys']> = {
  Space: 'space',
  KeyW: 'up',
  ArrowUp: 'up',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyD: 'right',
  ArrowRight: 'right',
};


export type ControllerState = {
  keys: Record<string, boolean>;
  mouse: {
    pressed: boolean;
    x: number | undefined;
    y: number | undefined;
    xR: number | undefined;
    yR: number | undefined;
    justReleased: boolean;
  };
};

export class Controller {
  public readonly keys: Record<
    'up' | 'down' | 'left' | 'right' | 'space',
    { pressed: boolean }
  >;

  public readonly mouse: {
    pressed: boolean;
    x: number | undefined,
    y: number | undefined,
    xR: number | undefined,
    yR: number | undefined,
    justReleased: boolean

  };
  

  private boundBlur: () => void;
  private boundContextMenu: (event: MouseEvent) => void;
  private boundKeyDown: (event: KeyboardEvent) => void;
  private boundKeyUp: (event: KeyboardEvent) => void;
  private boundMouseDown: (event: MouseEvent) => void;
  private boundMouseUp: (event: MouseEvent) => void;
  private customKeyHandler?: (event: KeyboardEvent) => void;
  private customKeyUpHandler?: (event: KeyboardEvent) => void;
  private customMouseUpHandler?: (event: MouseEvent) => void;

  constructor() {
    this.keys = {
      up: { pressed: false },
      down: { pressed: false },
      left: { pressed: false },
      right: { pressed: false },
      space: { pressed: false },
    };
    


    this.mouse = { pressed: false, x: undefined, y: undefined, justReleased: false, xR: undefined, yR: undefined };

    // Bind all handlers
    this.boundKeyDown = this.keydownHandler.bind(this);
    this.boundKeyUp = this.keyupHandler.bind(this);
    this.boundMouseDown = this.mouseDownHandler.bind(this);
    this.boundMouseUp = this.mouseUpHandler.bind(this);
    this.boundBlur = this.handleBlur.bind(this);
    this.boundContextMenu = this.contextMenuHandler.bind(this);

    // Register event listeners
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('mousedown', this.boundMouseDown);
    window.addEventListener('mouseup', this.boundMouseUp);
    window.addEventListener('blur', this.boundBlur);
    window.addEventListener('contextmenu', this.boundContextMenu);

    // Register mouse click release event handler
    
  }




  public setCustomKeyDownHandler(handler: (event: KeyboardEvent) => void): void {
    this.customKeyHandler = handler;
  }
  public setCustomKeyUpHandler(handler: (event: KeyboardEvent) => void): void {
    this.customKeyUpHandler = handler;
  }
  public setCustomMouseUpHandler(handler: (event: MouseEvent) => void): void {
    this.customMouseUpHandler = handler;
  }


  public resetMouse(): void {
    this.mouse.pressed = false;
    this.mouse.x = undefined;
    this.mouse.y = undefined;
    this.mouse.justReleased = false;
    this.mouse.xR = undefined;
    this.mouse.yR = undefined;
  }


  public getState(): ControllerState {
    return {
      keys: Object.fromEntries(
        Object.entries(this.keys).map(([key, value]) => [key, value.pressed])
      ),
      mouse: { ...this.mouse },
    };
  }


  private keydownHandler(event: KeyboardEvent): void {
    const key = keyMap[event.code];
    if (!key) return;

    const state = this.keys[key];
    if (state.pressed) return; // Ignore if already pressed


    state.pressed = true;

    // Call custom key handler if defined
    // Note: This needs to happen after the state is updated.
    if (this.customKeyHandler) {
      this.customKeyHandler(event);
    }

  }

  private keyupHandler(event: KeyboardEvent): void {
    const key = keyMap[event.code];
    if (!key) return;

    // Call custom key up handler if defined
    if (this.customKeyUpHandler) {
      this.customKeyUpHandler(event);
    }

    const state = this.keys[key];

    state.pressed = false;

  }
   
  private mouseDownHandler(_: MouseEvent): void {
    // Check if it's a left click (main button)
    if (_.button !== 0) return;
    this.mouse.pressed = true;
    this.mouse.x = _.clientX;
    this.mouse.y = _.clientY;
  }

  private mouseUpHandler(_: MouseEvent): void {
    if (_.button !== 0) return;

    // Call custom mouse up handler if defined
    if (this.customMouseUpHandler) {
      this.customMouseUpHandler(_);
    }

    this.mouse.pressed = false;
    this.mouse.justReleased = true;
    this.mouse.xR = _.clientX;
    this.mouse.yR = _.clientY;
  }



    // Add a new method to handle window blur
  private handleBlur(): void {
    // Reset all key states when window loses focus
    for (const key in this.keys) {
      const keyName = key as keyof typeof this.keys;
      this.keys[keyName].pressed = false;
    }
    
    // Also reset mouse statea
    this.resetMouse();
  }

  
  // Add handler for context menu (right-click)
  private contextMenuHandler(event: MouseEvent): void {
    // Prevent default context menu
    event.preventDefault();
    
    // Reset key states (same as blur handler)
    for (const key in this.keys) {
      const keyName = key as keyof typeof this.keys;
      this.keys[keyName].pressed = false;
    }
    
    this.resetMouse();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('mousedown', this.boundMouseDown);
    window.removeEventListener('mouseup', this.boundMouseUp);
    window.removeEventListener('blur', this.boundBlur);
    window.removeEventListener('contextmenu', this.boundContextMenu);

  }
}
