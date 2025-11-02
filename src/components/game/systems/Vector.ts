import type { ControllerState } from "./Controller";

export interface PositionVector {
  x: number;
  y: number;
}

export interface InputVector {
  x: number;
  y: number;
  mouse?: { x: number; y: number, id?: string };
}

export class Vector2 {

  private constructor() {}

  // Returns a plain JS object instead of Vector2 instance
  static createFromControllerState(controllerState: ControllerState): InputVector {
    const vector: InputVector = { x: 0, y: 0 };

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
      };
    }

    return vector;
  }

  // ---------- Static utility methods for plain objects ----------
  static addPositions(a: PositionVector, b: PositionVector): PositionVector {
    return { x: a.x + b.x, y: a.y + b.y };
  }

  static subtractPositions(a: PositionVector, b: PositionVector): PositionVector {
    return { x: a.x - b.x, y: a.y - b.y };
  }

  static scalePosition(pos: PositionVector, scale: number): PositionVector {
    return { x: pos.x * scale, y: pos.y * scale };
  }

  static dot(a: PositionVector, b: PositionVector): number {
    return a.x * b.x + a.y * b.y;
  }

  static lenSq(x: number, y: number): number {
    return x * x + y * y;
  }

  static len(x: number, y: number): number {
    return Math.sqrt(Vector2.lenSq(x, y));
  }

  static normalize(pos: PositionVector): PositionVector {
    const length = Vector2.len(pos.x, pos.y);
    if (length > 1e-8) {
      return { x: pos.x / length, y: pos.y / length };
    }
    return { x: 0, y: 0 };
  }

  static equals(a: PositionVector, b: PositionVector): boolean {
    return a.x === b.x && a.y === b.y;
  }



}