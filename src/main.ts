
import { Application } from 'pixi.js';
import { Player } from './logic/Player';
import { Controller } from './logic/controller';
import { Projectile } from './logic/Projectile';


// Example loading screen


(async () => {

  const app = new Application();
  await app.init({ background: '#1099bb', resizeTo: window })
  document.body.appendChild(app.canvas);

  const player = new Player(app.screen.height);
  player.x = 400;
  player.y = 300;
  app.stage.addChild(player);
  
  const controller = new Controller();
  const projectiles: Projectile[] = [];
  
  app.ticker.add(() => {



    player.update(controller);


    if (controller.mouse.justReleased) { // Refactor this to trigger on mouse release?
      // Spawn a projectile and add it to our array of projectiles
      controller.mouse.justReleased = false;
      console.log('Spawning a projectile');

      const projectile = new Projectile(player.x, player.y, controller.mouse.xR ?? 0, controller.mouse.yR ?? 0);
      app.stage.addChild(projectile);
      projectiles.push(projectile);

    }


    // update all projectiles
    for (let i = 0; i < projectiles.length; i += 1) {
      const projectile = projectiles[i];
      projectile.update();
    }
  });




})();


