import type { Container } from "pixi.js";

export const testForAABB = (object1: Container, object2: Container) => {
  const bounds1 = object1.getBounds();
  const bounds2 = object2.getBounds();

  return (
      bounds1.x < bounds2.x + bounds2.width
      && bounds1.x + bounds1.width > bounds2.x
      && bounds1.y < bounds2.y + bounds2.height
      && bounds1.y + bounds1.height > bounds2.y
  );
}