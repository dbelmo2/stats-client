
import { Application, Container } from 'pixi.js';
import { Player } from './logic/Player';
import { Controller } from './logic/controller';
import { Projectile } from './logic/Projectile';


// Example loading screen



    // Test For Hit
    // A basic AABB check between two different squares
const testForAABB = (object1: Container, object2: Container) => {
  const bounds1 = object1.getBounds();
  const bounds2 = object2.getBounds();

  return (
      bounds1.x < bounds2.x + bounds2.width
      && bounds1.x + bounds1.width > bounds2.x
      && bounds1.y < bounds2.y + bounds2.height
      && bounds1.y + bounds1.height > bounds2.y
  );
}

(async () => {

  const app = new Application();
  await app.init({ background: '#202020', resizeTo: window })
  document.body.appendChild(app.canvas);

  const controller = new Controller();
  const projectiles: Projectile[] = [];
  const players: Player[] = [];

  const player = new Player(app.screen.height);
  player.x = 400;
  player.y = 300;
  app.stage.addChild(player);

  // Spawn in a target
  const target = new Player(app.screen.height);
  target.x = 200;
  target.y = 300;
  app.stage.addChild(target);

  players.push(target);
  
  

  



  app.ticker.add(() => {
    player.update(controller);

  


    if (controller.mouse.justReleased) {
      // Spawn a projectile and add it to our array of projectiles
      controller.mouse.justReleased = false;
      const projectile = new Projectile(player.x, player.y, controller.mouse.xR ?? 0, controller.mouse.yR ?? 0, 12, 5000, 0.05);
      app.stage.addChild(projectile);
      projectiles.push(projectile);
    }



    // update all projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const projectile = projectiles[i];
      projectile.update();

      if (projectile.shouldBeDestroyed) {
        projectiles.splice(i, 1);
        projectile.destroy();
        continue;
      } 

      for (const player of players) {
        if (testForAABB(projectile, player)) {
          projectiles.splice(i, 1);
          projectile.destroy();
          player.damage();
          
        }
      }




    }
  });






})();


