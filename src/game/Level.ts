import * as THREE from 'three';
import { Enemy, EnemyConfig } from './Enemy';
import { EnemyAI } from './EnemyAI';
import { BulletManager } from './Bullet';
import { DropManager } from './Drops';
import { Boss } from './Boss';
import { TankBoss } from './bosses/TankBoss';
import { BomberBoss } from './bosses/BomberBoss';
import { CarrierBoss } from './bosses/CarrierBoss';
import { ParticleSystem } from '../systems/Particles';
import { GameScene } from '../core/Scene';
import { Player } from './Player';
import { MedalSystem } from './MedalSystem';
import { DifficultyManager } from './DifficultyManager';
import { WeaponFactory } from './weapons/WeaponFactory';
import { CollisionSystem, EnemyHitbox } from '../systems/Collision';
import { BombSystem } from './weapons/BombSystem';

import enemyConfigs from '../assets/configs/enemies.json';

/** Level event entry from JSON */
interface LevelEvent {
  time: number;
  spawn?: string;
  count?: number;
  pattern?: string;
  x?: number;
  spacing?: number;
  event?: string;
  duration?: number;
  boss?: string;
}

/**
 * Level — Timeline-driven level script parser and manager.
 * Reads events from JSON, spawns enemies, manages boss fights, handles drops.
 */
export class Level {
  private events: LevelEvent[];
  private eventIndex = 0;
  private elapsed = 0;
  private configMap: Map<string, EnemyConfig> = new Map();

  // Enemy management
  private enemies: Enemy[] = [];
  private enemyAI: EnemyAI;
  private static readonly ENEMY_POOL_SIZE = 50;

  // Boss
  public currentBoss: Boss | null = null;
  private bossWarningActive = false;
  private bossWarningTimer = 0;

  // Drops
  public dropManager: DropManager;
  public medalSystem: MedalSystem;

  // Difficulty
  public difficultyManager: DifficultyManager;

  // State
  public isComplete = false;
  public bossDefeated = false;

  // Power-up rain timer
  private powerupRainTimer = 0;
  private powerupRainDuration = 0;

  constructor(
    private scene: THREE.Scene,
    private bulletManager: BulletManager,
    private particles: ParticleSystem,
    private gameScene: GameScene,
  ) {
    this.events = [];
    this.enemyAI = new EnemyAI();
    this.dropManager = new DropManager(scene);
    this.medalSystem = new MedalSystem();
    this.difficultyManager = new DifficultyManager();

    // Build config lookup
    for (const cfg of enemyConfigs as EnemyConfig[]) {
      this.configMap.set(cfg.id, cfg);
    }

    // Pre-allocate enemy pool
    const defaultConfig = this.configMap.get('scout_drone')!;
    for (let i = 0; i < Level.ENEMY_POOL_SIZE; i++) {
      const enemy = new Enemy(defaultConfig);
      enemy.alive = false;
      enemy.mesh.visible = false;
      scene.add(enemy.mesh);
      this.enemies.push(enemy);
    }
  }

  /**
   * Load level data and reset state for a new level.
   */
  loadLevel(levelData: LevelEvent[]): void {
    this.events = levelData;
    this.eventIndex = 0;
    this.elapsed = 0;
    this.isComplete = false;
    this.bossDefeated = false;
    this.bossWarningActive = false;
    this.powerupRainDuration = 0;

    // Clear enemies
    for (const enemy of this.enemies) {
      enemy.alive = false;
      enemy.mesh.visible = false;
    }

    // Clear boss
    if (this.currentBoss) {
      this.currentBoss.dispose();
      this.scene.remove(this.currentBoss.mesh);
      this.currentBoss = null;
    }

    // Clear bullets
    this.bulletManager.clearAll();
    this.particles.clear();
  }

  update(
    deltaTime: number,
    player: Player,
    weaponFactory: WeaponFactory,
    collision: CollisionSystem,
    bombSystem: BombSystem
  ): void {
    this.elapsed += deltaTime;

    const difficulty = this.difficultyManager.getDifficulty(player.score, this.elapsed);

    // --- Process timeline events ---
    while (this.eventIndex < this.events.length && this.events[this.eventIndex].time <= this.elapsed) {
      this.processEvent(this.events[this.eventIndex]);
      this.eventIndex++;
    }

    // --- Power-up rain ---
    if (this.powerupRainDuration > 0) {
      this.powerupRainTimer -= deltaTime;
      this.powerupRainDuration -= deltaTime;
      if (this.powerupRainTimer <= 0) {
        this.dropManager.spawnPowerUpRain();
        this.powerupRainTimer = 2; // Every 2 seconds
      }
    }

    // --- Boss warning ---
    if (this.bossWarningActive) {
      this.bossWarningTimer -= deltaTime;
      if (this.bossWarningTimer <= 0) {
        this.bossWarningActive = false;
      }
    }

    // --- Update enemy AI ---
    this.enemyAI.update(this.enemies.filter(e => e.alive), player.position, deltaTime);

    // --- Update enemies ---
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;

      enemy.mesh.position.copy(enemy.position);
      enemy.tryFire(player.position, this.bulletManager, deltaTime);

      // Off-screen cleanup
      if (enemy.position.z > 20 || enemy.position.z < -25) {
        enemy.alive = false;
        enemy.mesh.visible = false;
      }
    }

    // --- Update boss ---
    if (this.currentBoss) {
      this.currentBoss.update(player.position, deltaTime);
    }

    // --- Bomb damage ---
    const bombDamage = bombSystem.update(deltaTime);
    if (bombDamage > 0) {
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        if (enemy.takeDamage(bombDamage)) {
          this.onEnemyKilled(enemy, player);
        }
      }
      if (this.currentBoss?.alive && this.currentBoss.active) {
        this.currentBoss.takeDamage(bombDamage);
      }
    }

    // --- Collision detection ---
    const enemyHitboxes: EnemyHitbox[] = this.enemies.map(e => ({
      position: e.position,
      radius: e.config.size * 0.6,
      alive: e.alive,
    }));

    // Add boss hitbox
    if (this.currentBoss?.alive && this.currentBoss.active) {
      enemyHitboxes.push({
        position: this.currentBoss.position,
        radius: 2.5,
        alive: true,
      });
    }

    const result = collision.check(
      player,
      this.bulletManager.getActivePlayerBullets(),
      this.bulletManager.getActiveEnemyBullets(),
      enemyHitboxes
    );

    // Player hit
    if (result.playerHit || result.playerEnemyCollision !== null) {
      player.hit();
      this.particles.emit('explosion', player.position.x, 0.5, player.position.z);
      this.gameScene.spawnExplosionLight(player.position.clone(), 0xff4400, 4);
      weaponFactory.resetLevel();
      this.medalSystem.breakChain();
    }

    // Bullet hits
    for (const hit of result.bulletHits) {
      const enemyIdx = hit.enemyIndex;

      // Boss hit
      if (this.currentBoss?.alive && enemyIdx === this.enemies.length) {
        this.currentBoss.takeDamage(hit.bullet.damage);
        this.bulletManager.releaseBullet(hit.bullet);
        this.particles.emit('spark', hit.bullet.position.x, 0.3, hit.bullet.position.z);
        if (!this.currentBoss.alive) {
          player.score += this.currentBoss.score;
          this.bossDefeated = true;
        }
        continue;
      }

      // Enemy hit
      const enemy = this.enemies[enemyIdx];
      if (!enemy || !enemy.alive) continue;

      this.bulletManager.releaseBullet(hit.bullet);
      this.particles.emit('spark', hit.bullet.position.x, 0.3, hit.bullet.position.z);

      if (enemy.takeDamage(hit.bullet.damage)) {
        this.onEnemyKilled(enemy, player);
      }
    }

    // --- Update drops ---
    this.dropManager.update(deltaTime);

    // --- Collect drops ---
    const collected = this.dropManager.collect(player.position);
    for (const dropType of collected) {
      if (dropType === 'medal') {
        const medalScore = this.medalSystem.collect(true);
        player.score += medalScore;
      } else if (dropType === 'bomb') {
        player.bombs = Math.min(player.bombs + 1, 9);
      } else if (dropType.startsWith('powerup_')) {
        const color = dropType.replace('powerup_', '');
        const weaponMap: Record<string, 'vulcan' | 'laser' | 'homing'> = {
          red: 'vulcan', blue: 'laser', purple: 'homing'
        };
        weaponFactory.pickup(weaponMap[color] || 'vulcan');
      }
      this.particles.emit('spark', player.position.x, 0.5, player.position.z);
    }

    // --- Level complete ---
    if (this.bossDefeated && !this.isComplete) {
      this.isComplete = true;
    }
  }

  private processEvent(event: LevelEvent): void {
    if (event.spawn) {
      this.spawnEnemyWave(event);
    } else if (event.event === 'powerup_rain') {
      this.powerupRainDuration = event.duration || 5;
      this.powerupRainTimer = 0;
    } else if (event.event === 'clear') {
      // Clear remaining enemies
      for (const enemy of this.enemies) {
        if (enemy.alive) {
          enemy.alive = false;
          enemy.mesh.visible = false;
        }
      }
    } else if (event.event === 'boss_warning') {
      this.bossWarningActive = true;
      this.bossWarningTimer = 8;
      // Show boss HP bar
      const bossHp = document.getElementById('hud-boss-hp');
      if (bossHp) bossHp.classList.remove('hidden');
    } else if (event.boss) {
      this.spawnBoss(event.boss);
    }
  }

  private spawnEnemyWave(event: LevelEvent): void {
    const config = this.configMap.get(event.spawn!);
    if (!config) return;

    const count = event.count || 1;

    for (let i = 0; i < count; i++) {
      const enemy = this.enemies.find(e => !e.alive);
      if (!enemy) break;

      enemy.reset(config);

      // Positioning
      let x: number;
      if (event.pattern === 'line') {
        const baseX = event.x ?? 0;
        const spacing = event.spacing ?? 2;
        x = baseX + (i - (count - 1) / 2) * spacing;
      } else if (event.pattern === 'fixed') {
        x = event.x ?? 0;
      } else {
        x = (Math.random() - 0.5) * 12;
      }

      enemy.position.set(x, 0, -15 - i * 1.5);
      enemy.startX = x;
      enemy.spawnTime = this.elapsed;
    }
  }

  private spawnBoss(bossId: string): void {
    switch (bossId) {
      case 'tank_boss':
        this.currentBoss = new TankBoss(this.bulletManager, this.particles, this.gameScene);
        break;
      case 'bomber_boss':
        this.currentBoss = new BomberBoss(this.bulletManager, this.particles, this.gameScene);
        break;
      case 'carrier_boss':
        this.currentBoss = new CarrierBoss(this.bulletManager, this.particles, this.gameScene);
        break;
      default:
        console.warn(`[Level] Unknown boss: ${bossId}`);
        return;
    }
    this.scene.add(this.currentBoss.mesh);
  }

  private onEnemyKilled(enemy: Enemy, player: Player): void {
    player.score += enemy.score;
    this.particles.emit('explosion', enemy.position.x, 0.5, enemy.position.z);
    this.particles.emit('smoke', enemy.position.x, 0.3, enemy.position.z);
    this.gameScene.spawnExplosionLight(enemy.position.clone(), 0xff6600, 3);

    // Roll for drops
    const dropResult = enemy.rollDrop();
    if (dropResult) {
      this.dropManager.spawn(enemy.position.x, enemy.position.z, dropResult);
    }
  }

  /**
   * Get enemies for weapon targeting (homing laser).
   */
  getAliveEnemyPositions(): THREE.Vector3[] {
    const positions: THREE.Vector3[] = [];
    for (const enemy of this.enemies) {
      if (enemy.alive) positions.push(enemy.position);
    }
    if (this.currentBoss?.alive) {
      positions.push(this.currentBoss.position);
    }
    return positions;
  }

  isBossWarningActive(): boolean {
    return this.bossWarningActive;
  }

  isBossActive(): boolean {
    return !!this.currentBoss?.alive;
  }

  getBossHpPercent(): number {
    return this.currentBoss?.getHpPercent() ?? 0;
  }

  getElapsed(): number {
    return this.elapsed;
  }

  dispose(): void {
    for (const enemy of this.enemies) {
      enemy.dispose();
    }
    this.currentBoss?.dispose();
    this.dropManager.dispose();
  }
}
