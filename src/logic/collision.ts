import type { Container } from "pixi.js";

export const testForAABB = (object1: Container, object2: Container, callback?: any) => {
  const bounds1 = object1.getBounds();
  const bounds2 = object2.getBounds();

  const converted = callback ? callback(bounds2.x, bounds2.y) : { x: bounds2.x, y: bounds2.y };
  console.log(`Projectile bounds: ${JSON.stringify(bounds1)}, player bounds: ${JSON.stringify(bounds2)}`);
  if (callback) console.log(`Player bounds after conversion to world coordinates: ${JSON.stringify(converted)}`);
  return (
      bounds1.x < bounds2.x + bounds2.width
      && bounds1.x + bounds1.width > bounds2.x
      && bounds1.y < bounds2.y + bounds2.height
      && bounds1.y + bounds1.height > bounds2.y
  );
}