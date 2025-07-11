import type { ControllerState } from "./Controller";

export class Vector2 {


  public x: number;
  public y: number;
  public mouse?: { x: number; y: number, id?: string }; // Optional mouse position with id

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  static createFromControllerState(controllerState: ControllerState) {
    const vector = new Vector2();

    if (controllerState.keys.left === true) {
        vector.x -= 1;
    }
    if (controllerState.keys.right === true) {
        vector.x += 1;
    }
    if (controllerState.keys.up === true || controllerState.keys.space === true) {
        vector.y -= 1;
    }

    if (controllerState.mouse.justReleased === true && controllerState.mouse.xR !== undefined && controllerState.mouse.yR !== undefined) {
      vector.mouse = {
        x: controllerState.mouse.xR ?? 0,
        y: controllerState.mouse.yR ?? 0,
        id: Math.random().toString(36).substring(2, 15)
      }
    }
    return vector;
  }


  // ---------- mutating instance methods ----------
  add(v: Vector2): this      { this.x += v.x; this.y += v.y; return this; }
  subtract(v: Vector2): this { this.x -= v.x; this.y -= v.y; return this; }
  scale(s: number): this     { this.x *= s;   this.y *= s;   return this; }

  lenSq(): number { return this.x * this.x + this.y * this.y; }
  len():   number { return Math.sqrt(this.lenSq()); }

  normalize(): this {
    const l = this.len();
    if (l > 1e-8) { this.x /= l; this.y /= l; }
    return this;
  }

  // ---------- non‑mutating helpers ----------
  static add(a: Vector2, b: Vector2): Vector2       { return a.clone().add(b); }
  static subtract(a: Vector2, b: Vector2): Vector2  { return a.clone().subtract(b); }
  static dot(a: Vector2, b: Vector2): number        { return a.x * b.x + a.y * b.y; }

  clone(): Vector2 { return new Vector2(this.x, this.y); }
  equals(v: Vector2): boolean { return this.x === v.x && this.y === v.y; }
}
