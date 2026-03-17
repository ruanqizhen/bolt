import { Renderer } from './core/Renderer';
import { Camera } from './core/Camera';
import { GameScene } from './core/Scene';
import { GameLoop } from './core/GameLoop';
import { Input } from './systems/Input';
import { ParticleSystem } from './systems/Particles';
import { CollisionSystem } from './systems/Collision';
import { Player } from './game/Player';
import { BulletManager } from './game/Bullet';
import { WeaponFactory } from './game/weapons/WeaponFactory';
import { VulcanWeapon } from './game/weapons/VulcanWeapon';
import { LaserWeapon } from './game/weapons/LaserWeapon';
import { HomingLaserWeapon } from './game/weapons/HomingLaserWeapon';
import { BombSystem } from './game/weapons/BombSystem';
import { Level } from './game/Level';

/**
 * Bolt (雷电) — Main Game
 */
class Game {
  private renderer: Renderer;
  private camera: Camera;
  private gameScene: GameScene;
  private gameLoop: GameLoop;
  private input: Input;

  // Systems
  private player: Player;
  private bulletManager: BulletManager;
  private particles: ParticleSystem;
  private collision: CollisionSystem;
  private weaponFactory: WeaponFactory;
  private homingWeapon: HomingLaserWeapon;
  private bombSystem: BombSystem;
  private level: Level;

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!canvas) throw new Error('Canvas element #game-canvas not found');

    // Core
    this.renderer = new Renderer(canvas);
    this.camera = new Camera();
    this.gameScene = new GameScene();
    this.input = new Input();

    // Player
    this.player = new Player();
    this.gameScene.scene.add(this.player.mesh);
    this.player.position.set(0, 0, 5);

    // Bullets & Particles
    this.bulletManager = new BulletManager(this.gameScene.scene);
    this.particles = new ParticleSystem(this.gameScene.scene);
    this.collision = new CollisionSystem();
    this.bombSystem = new BombSystem();

    // Weapons
    this.weaponFactory = new WeaponFactory();
    this.weaponFactory.registerWeapon(new VulcanWeapon());
    this.weaponFactory.registerWeapon(new LaserWeapon());
    this.homingWeapon = new HomingLaserWeapon();
    this.weaponFactory.registerWeapon(this.homingWeapon);
    this.weaponFactory.switchWeapon('vulcan');

    // Level system
    this.level = new Level(
      this.gameScene.scene,
      this.bulletManager,
      this.particles,
      this.gameScene
    );

    // Game loop
    this.gameLoop = new GameLoop(
      (dt) => this.update(dt),
      () => this.render()
    );

    this.updateHUD();
    this.gameLoop.start();

    // Key bindings
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Digit1') {
        this.weaponFactory.switchWeapon('vulcan');
        this.updateHUD();
      } else if (e.code === 'Digit2') {
        this.weaponFactory.switchWeapon('laser');
        this.updateHUD();
      } else if (e.code === 'Digit3') {
        this.weaponFactory.switchWeapon('homing');
        this.updateHUD();
      } else if (e.code === 'KeyU') {
        this.weaponFactory.upgrade();
        this.updateHUD();
      }
    });

    console.log('[Bolt] Level 1 started! WASD=move, J=shoot, K=bomb, 1/2/3=weapon, U=upgrade');
  }

  private update(deltaTime: number): void {
    // 1. Input
    const inputState = this.input.getState();
    const dragDelta = this.input.getDragDelta();

    // 2. Player
    this.player.update(deltaTime, inputState, dragDelta, this.camera);

    // 3. Weapons
    this.weaponFactory.update(deltaTime);

    // Update homing weapon targets
    this.homingWeapon.enemyPositions = this.level.getAliveEnemyPositions();

    if (inputState.shoot && this.player.isAlive) {
      this.weaponFactory.fire(this.player.position, this.bulletManager, deltaTime);
    }

    // 4. Bomb
    if (inputState.bomb && this.player.bombs > 0 && this.player.isAlive && !this.bombSystem.active) {
      this.player.bombs--;
      this.bombSystem.trigger(this.player.position, this.bulletManager, this.particles, this.gameScene);
    }

    // 5. Level system (enemies, boss, collision, drops — all handled internally)
    this.level.update(deltaTime, this.player, this.weaponFactory, this.collision, this.bombSystem);

    // 6. Update bullets
    this.bulletManager.update(deltaTime);

    // 7. Update particles
    this.particles.update(deltaTime);

    // 8. Update scene (parallax)
    this.gameScene.update(deltaTime);

    // 9. Camera shake
    const shake = this.bombSystem.getShakeIntensity();
    if (shake > 0) {
      this.camera.camera.position.x = (Math.random() - 0.5) * shake * 0.5;
    } else {
      this.camera.camera.position.x = 0;
    }

    // 10. Update HUD
    this.updateHUD();
  }

  private render(): void {
    this.renderer.render(this.gameScene.scene, this.camera.camera);
  }

  private updateHUD(): void {
    const scoreEl = document.getElementById('hud-score');
    const livesEl = document.getElementById('hud-lives');
    const bombsEl = document.getElementById('hud-bombs');
    const weaponEl = document.getElementById('hud-weapon');
    const bossHpEl = document.getElementById('hud-boss-hp');
    const bossHpFill = document.getElementById('boss-hp-bar-fill');

    if (scoreEl) scoreEl.textContent = `SCORE: ${this.player.score.toLocaleString()}`;
    if (livesEl) livesEl.textContent = '❤'.repeat(Math.max(0, this.player.lives));
    if (bombsEl) bombsEl.textContent = `💣 ×${this.player.bombs}`;

    const typeNames: Record<string, string> = {
      vulcan: '🔴 Vulcan',
      laser: '🔵 Laser',
      homing: '🟣 Homing',
    };
    const typeName = typeNames[this.weaponFactory.currentType] || 'Unknown';
    if (weaponEl) weaponEl.textContent = `${typeName} Lv.${this.weaponFactory.currentLevel}`;

    // Boss HP bar
    if (this.level.isBossActive()) {
      if (bossHpEl) bossHpEl.classList.remove('hidden');
      if (bossHpFill) bossHpFill.style.width = `${this.level.getBossHpPercent() * 100}%`;
    } else if (!this.level.isBossWarningActive()) {
      if (bossHpEl) bossHpEl.classList.add('hidden');
    }

    // Medal chain indicator
    const chain = this.level.medalSystem.getChain();
    if (chain > 0 && scoreEl) {
      scoreEl.textContent += ` | 🏅×${chain}`;
    }
  }
}

// Start
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
