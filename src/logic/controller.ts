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

export class Controller {
  public readonly keys: Record<
    'up' | 'down' | 'left' | 'right' | 'space',
    { pressed: boolean; doubleTap: boolean; timestamp: number }
  >;

  public readonly mouse: {
    pressed: boolean;
    x: number | undefined,
    y: number | undefined,
    xR: number | undefined,
    yR: number | undefined,
    justReleased: boolean

  };
  

  private boundKeyDown: (event: KeyboardEvent) => void;
  private boundKeyUp: (event: KeyboardEvent) => void;
  private boundMouseDown: (event: MouseEvent) => void;
  private boundMouseUp: (event: MouseEvent) => void;

  constructor() {
    this.keys = {
      up: { pressed: false, doubleTap: false, timestamp: 0 },
      down: { pressed: false, doubleTap: false, timestamp: 0 },
      left: { pressed: false, doubleTap: false, timestamp: 0 },
      right: { pressed: false, doubleTap: false, timestamp: 0 },
      space: { pressed: false, doubleTap: false, timestamp: 0 },
    };
    
    this.mouse = { pressed: false, x: undefined, y: undefined, justReleased: false, xR: undefined, yR: undefined };

    // Bind all handlers
    this.boundKeyDown = this.keydownHandler.bind(this);
    this.boundKeyUp = this.keyupHandler.bind(this);
    this.boundMouseDown = this.mouseDownHandler.bind(this);
    this.boundMouseUp = this.mouseUpHandler.bind(this);

    // Register event listeners
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('mousedown', this.boundMouseDown);
    window.addEventListener('mouseup', this.boundMouseUp);

    // Register mouse click release event handler
    
  }

  private keydownHandler(event: KeyboardEvent): void {
    const key = keyMap[event.code];
    if (!key) return;

    const now = Date.now();
    const state = this.keys[key];

    state.doubleTap = state.doubleTap || now - state.timestamp < 300;
    state.pressed = true;
  }

  private keyupHandler(event: KeyboardEvent): void {
    const key = keyMap[event.code];
    if (!key) return;

    const now = Date.now();
    const state = this.keys[key];

    state.pressed = false;

    if (state.doubleTap) {
      state.doubleTap = false;
    } else {
      state.timestamp = now;
    }
  }
  

  private mouseDownHandler(_: MouseEvent): void {
    this.mouse.pressed = true;
    this.mouse.x = _.clientX;
    this.mouse.y = _.clientY;
  }

  private mouseUpHandler(_: MouseEvent): void {
    this.mouse.pressed = false;
    this.mouse.justReleased = true;
    this.mouse.xR = _.clientX;
    this.mouse.yR = _.clientY;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('mousedown', this.boundMouseDown);
    window.removeEventListener('mouseup', this.boundMouseUp);
  }
}
