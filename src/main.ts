import { Renderer } from './core/Renderer';
import { Camera } from './core/Camera';
import { GameScene } from './core/Scene';
import { GameLoop } from './core/GameLoop';
import { Input } from './systems/Input';
import { ParticleSystem } from './systems/Particles';
import { CollisionSystem } from './systems/Collision';
import { AudioManager } from './systems/Audio';
import { TextureManager } from './systems/TextureManager';
import { Player } from './game/Player';
import { BulletManager } from './game/Bullet';
import { WeaponFactory } from './game/weapons/WeaponFactory';
import { VulcanWeapon } from './game/weapons/VulcanWeapon';
import { LaserWeapon } from './game/weapons/LaserWeapon';
import { HomingLaserWeapon } from './game/weapons/HomingLaserWeapon';
import { BombSystem } from './game/weapons/BombSystem';
import { Level } from './game/Level';
import { GameState, GameScreen } from './game/GameState';

import level1Data from './assets/configs/level1.json';
import level2Data from './assets/configs/level2.json';
import level3Data from './assets/configs/level3.json';

const levelDataMap = [level1Data, level2Data, level3Data];

/**
 * Bolt (雷电) — Main Game
 */
class Game {
  private renderer: Renderer;
  private camera: Camera;
  private gameScene: GameScene;
  private gameLoop: GameLoop;
  private input: Input;
  private audio: AudioManager;

  // Systems
  private player!: Player;
  private bulletManager!: BulletManager;
  private particles!: ParticleSystem;
  private collision!: CollisionSystem;
  private weaponFactory!: WeaponFactory;
  private homingWeapon!: HomingLaserWeapon;
  private bombSystem!: BombSystem;
  private level!: Level;
  private state: GameState;

  // UI refs
  private screens = {
    title: null as HTMLElement | null,
    gameover: null as HTMLElement | null,
    levelclear: null as HTMLElement | null,
    victory: null as HTMLElement | null,
    hud: null as HTMLElement | null,
  };

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!canvas) throw new Error('Canvas not found');

    // Core
    this.renderer = new Renderer(canvas);
    this.camera = new Camera();
    this.gameScene = new GameScene();
    this.input = new Input();
    this.audio = new AudioManager();
    this.state = new GameState();

    // UI elements
    this.screens.title = document.getElementById('screen-title');
    this.screens.gameover = document.getElementById('screen-gameover');
    this.screens.levelclear = document.getElementById('screen-levelclear');
    this.screens.victory = document.getElementById('screen-victory');
    this.screens.hud = document.getElementById('hud');

    // Init game objects
    this.initGameSystems();

    // Button handlers
    this.setupButtons();

    // Key bindings
    this.setupKeyBindings();

    // Game loop (always runs for background rendering)
    this.gameLoop = new GameLoop(
      (dt) => this.update(dt),
      () => this.render()
    );
    this.gameLoop.start();

    // Show title
    this.showScreen('title');

    // Show high score on title
    if (this.state.highScore > 0) {
      const hs = document.getElementById('title-highscore');
      if (hs) hs.textContent = `HIGH SCORE: ${this.state.highScore.toLocaleString()}`;
    }
  }

  private initGameSystems(): void {
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
  }

  private setupButtons(): void {
    document.getElementById('btn-start')?.addEventListener('click', () => {
      this.audio.init();
      this.startGame();
    });

    document.getElementById('btn-continue')?.addEventListener('click', () => {
      if (this.state.useContinue()) {
        this.player.respawn();
        this.showScreen('playing');
        this.updateHUD();
      }
    });

    document.getElementById('btn-title')?.addEventListener('click', () => {
      this.state.reset();
      this.showScreen('title');
    });

    document.getElementById('btn-nextlevel')?.addEventListener('click', () => {
      this.state.nextLevel();
      this.startLevel(this.state.currentLevel);
      this.showScreen('playing');
    });

    document.getElementById('btn-restart')?.addEventListener('click', () => {
      this.startGame();
    });

    document.getElementById('btn-title2')?.addEventListener('click', () => {
      this.state.reset();
      this.showScreen('title');
    });
  }

  private setupKeyBindings(): void {
    window.addEventListener('keydown', (e) => {
      // Title screen: any key starts
      if (this.state.screen === 'title' && (e.code === 'Space' || e.code === 'Enter')) {
        this.audio.init();
        this.startGame();
        return;
      }

      if (this.state.screen !== 'playing') return;

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
      } else if (e.code === 'KeyM') {
        this.audio.toggleMute();
      }
    });
  }

  private startGame(): void {
    this.state.startGame();
    this.player.respawn();
    this.player.score = 0;
    this.weaponFactory.switchWeapon('vulcan');
    this.weaponFactory.resetLevel();
    this.startLevel(1);
    this.showScreen('playing');
    this.audio.startBGM();
  }

  private startLevel(levelNum: number): void {
    const data = levelDataMap[levelNum - 1] || levelDataMap[0];
    this.level.loadLevel(data as any);
    this.player.position.set(0, 0, 5);

    const levelEl = document.getElementById('hud-level');
    if (levelEl) levelEl.textContent = `STAGE ${levelNum}`;

    this.updateHUD();
  }

  private showScreen(screen: GameScreen | 'playing'): void {
    // Hide all
    if (this.screens.title) this.screens.title.style.display = 'none';
    if (this.screens.gameover) this.screens.gameover.style.display = 'none';
    if (this.screens.levelclear) this.screens.levelclear.style.display = 'none';
    if (this.screens.victory) this.screens.victory.style.display = 'none';
    if (this.screens.hud) this.screens.hud.style.display = 'none';

    switch (screen) {
      case 'title':
        if (this.screens.title) this.screens.title.style.display = 'flex';
        break;
      case 'playing':
        if (this.screens.hud) this.screens.hud.style.display = 'block';
        break;
      case 'game_over': {
        if (this.screens.gameover) this.screens.gameover.style.display = 'flex';
        const el = document.getElementById('gameover-score');
        if (el) el.textContent = `SCORE: ${this.player.score.toLocaleString()}`;
        const cl = document.getElementById('continues-left');
        if (cl) cl.textContent = String(this.state.continues);
        break;
      }
      case 'level_clear': {
        if (this.screens.levelclear) this.screens.levelclear.style.display = 'flex';
        const el = document.getElementById('levelclear-score');
        if (el) el.textContent = `SCORE: ${this.player.score.toLocaleString()}`;
        break;
      }
      case 'victory': {
        if (this.screens.victory) this.screens.victory.style.display = 'flex';
        const el = document.getElementById('victory-score');
        if (el) el.textContent = `FINAL SCORE: ${this.player.score.toLocaleString()}`;
        this.state.saveHighScore(this.player.score);
        break;
      }
    }

    this.state.screen = screen === 'playing' ? 'playing' : screen as GameScreen;
  }

  private update(deltaTime: number): void {
    // Always update scene for background animation
    this.gameScene.update(deltaTime);

    if (this.state.screen !== 'playing') return;

    // 1. Input
    const inputState = this.input.getState();
    const dragDelta = this.input.getDragDelta();

    // 2. Player
    this.player.update(deltaTime, inputState, dragDelta, this.camera);

    // 3. Check player death
    if (!this.player.isAlive) {
      this.audio.playSfx('explosion');
      this.state.saveHighScore(this.player.score);
      this.state.gameOver();
      this.showScreen('game_over');
      this.audio.stopBGM();
      return;
    }

    // 4. Weapons
    this.weaponFactory.update(deltaTime);
    this.homingWeapon.enemyPositions = this.level.getAliveEnemyPositions();

    if (inputState.shoot && this.player.isAlive) {
      if (this.weaponFactory.fire(this.player.position, this.bulletManager, deltaTime)) {
        this.audio.playSfx('shoot');
      }
    }

    // 5. Bomb
    if (inputState.bomb && this.player.bombs > 0 && this.player.isAlive && !this.bombSystem.active) {
      this.player.bombs--;
      this.bombSystem.trigger(this.player.position, this.bulletManager, this.particles, this.gameScene);
      this.audio.playSfx('bomb');
    }

    // 6. Level system
    this.level.update(deltaTime, this.player, this.weaponFactory, this.collision, this.bombSystem);

    // 7. Level complete check
    if (this.level.isComplete) {
      this.state.levelCleared();
      this.showScreen(this.state.screen);
      this.audio.stopBGM();
      return;
    }

    // 8. Update bullets
    this.bulletManager.update(deltaTime);

    // 9. Update particles
    this.particles.update(deltaTime);

    // 10. Camera shake
    const shake = this.bombSystem.getShakeIntensity();
    this.camera.camera.position.x = shake > 0 ? (Math.random() - 0.5) * shake * 0.5 : 0;

    // 11. HUD
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
    if (weaponEl) {
      const typeName = typeNames[this.weaponFactory.currentType] || 'Unknown';
      weaponEl.textContent = `${typeName} Lv.${this.weaponFactory.currentLevel}`;
    }

    // Boss HP
    if (this.level.isBossActive()) {
      if (bossHpEl) bossHpEl.classList.remove('hidden');
      if (bossHpFill) bossHpFill.style.width = `${this.level.getBossHpPercent() * 100}%`;
    } else if (!this.level.isBossWarningActive()) {
      if (bossHpEl) bossHpEl.classList.add('hidden');
    }

    // Medal chain
    const chain = this.level.medalSystem.getChain();
    if (chain > 0 && scoreEl) {
      scoreEl.textContent += ` | 🏅×${chain}`;
    }
  }
}

// Start
window.addEventListener('DOMContentLoaded', async () => {
  // Preload all textures before initializing game
  const tm = TextureManager.getInstance();
  await tm.preloadAll();
  new Game();
});
