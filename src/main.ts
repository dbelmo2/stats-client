
import { Application } from 'pixi.js';
import { Player } from './logic/Player';
import { Controller } from './logic/controller';
import { Projectile } from './logic/Projectile';
import { SocketManager } from './network/SocketManager';
import { EnemyPlayer } from './logic/EnemyPlayer';
import { EnemyProjectile } from './logic/EnemyProjectile';

type PlayerState = {
  id: string;
  x: number;
  y: number;
  hp: number;
}

type ProjectileState = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
};




(async () => {
  const app = new Application();
  await app.init({ background: '#202020', resizeTo: window })
  document.body.appendChild(app.canvas);

  const controller = new Controller();
  const projectiles: Projectile[] = [];
  let enemyPlayerStates: PlayerState[] = [];
  let enemyGraphics: Map<string, EnemyPlayer> = new Map();

  let enemyProjectileStates: ProjectileState[] = [];
  let enemyProjectileGraphics: Map<string, EnemyProjectile> = new Map();

  const self = new Player(app.screen.height);
  self.x = 400;
  self.y = 300;
  app.stage.addChild(self);

  const socketManager = new SocketManager('http://localhost:3000');
  await socketManager.waitForConnect();
  const selfId = socketManager.getId();
  socketManager.joinQueue('NA');

  socketManager.on('stateUpdate', ({ players, projectiles }) => {
    // Filter out self and save enemies for renderingaa
    enemyPlayerStates = players.filter((player: PlayerState) => player.id !== selfId);
    for ( const projectile of projectiles) {
      if (!enemyProjectileGraphics.has(projectile.id) && projectile.ownerId !== selfId) {
        const graphic = new EnemyProjectile(projectile.x, projectile.y, projectile.vx, projectile.vy);
        app.stage.addChild(graphic);
        enemyProjectileGraphics.set(projectile.id, graphic);
        continue;
      } 
      const graphic = enemyProjectileGraphics.get(projectile.id);
      if (graphic) {
        //graphic.sync(projectile.x, projectile.y, projectile.vx, projectile.vy);
      }
    }
  });


  app.ticker.add(() => {
    self.update(controller);

    // Handle player shooting
    if (controller.mouse.justReleased) {
      // Spawn a projectile and add it to our array of projectiles
      controller.mouse.justReleased = false;
      const target = { x: controller.mouse.xR ?? 0 , y: controller.mouse.yR ?? 0 }
      const projectile = new Projectile(self.x, self.y, target.x, target.y, 12, 5000, 0.05, app.screen.height);
      app.stage.addChild(projectile);
      projectiles.push(projectile);
      // Emit the shoot event to inform the server
      socketManager.emit('shoot', target);
    }



    // update owned projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const projectile = projectiles[i];
      projectile.update();
      if (projectile.shouldBeDestroyed) {
        projectiles.splice(i, 1);
        projectile.destroy();
        continue;
      } 
    }

    // Iterate through the enemy player state data and
    // 1. If a graphic for the enemy does not exist, create it
    // 2. If a graphic for the enemy already exists, update its position
    for ( const enemyPlayer of enemyPlayerStates) {
      if (!enemyGraphics.has(enemyPlayer.id)) {
        const graphic = new EnemyPlayer(enemyPlayer.x, enemyPlayer.y)
        app.stage.addChild(graphic);
        enemyGraphics.set(enemyPlayer.id, graphic);
      } else {
        const enemyGraphic = enemyGraphics.get(enemyPlayer.id);
        enemyGraphic?.syncPosition(enemyPlayer.x, enemyPlayer.y);
      }
    }

    // Update all enemy projectiles
    for (const graphic of enemyProjectileGraphics.values()) {
      graphic.update(); // this.x += this.vx; this.y += this.vy
    }

    // Send the server informationa bout the players current location
    socketManager.emit('playerInput', { x: self.x, y: self.y });

    // TODO: Iterate through the enemy graphics array to find any graphics that do not have a corresponding
    // object in the enemy player state array. These are players who are no longer in the game. Their graphics 
    // should be cleaned up.

  
  });
})();


