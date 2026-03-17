import * as THREE from 'three';
import { BulletManager } from '../Bullet';
import { ParticleSystem } from '../../systems/Particles';
import { GameScene } from '../../core/Scene';

/**
 * BombSystem — Screen-clear bomb that destroys all enemy bullets
 * and deals massive AOE damage to all enemies.
 */
export class BombSystem {
  private isActive = false;
  private timer = 0;
  private static readonly DURATION = 2.0; // seconds
  private static readonly DPS = 300;
  private shakeIntensity = 0;

  /**
   * Trigger a bomb if the player has one available.
   * Returns true if triggered.
   */
  trigger(
    playerPos: THREE.Vector3,
    bulletManager: BulletManager,
    particles: ParticleSystem,
    gameScene: GameScene,
  ): boolean {
    if (this.isActive) return false;

    this.isActive = true;
    this.timer = BombSystem.DURATION;
    this.shakeIntensity = 1.0;

    // Clear all enemy bullets
    bulletManager.clearAllEnemyBullets();

    // Big explosion effects
    for (let i = 0; i < 5; i++) {
      const ox = (Math.random() - 0.5) * 10;
      const oz = (Math.random() - 0.5) * 10;
      particles.emit('explosion', playerPos.x + ox, 0.5, playerPos.z + oz);
      particles.emit('spark', playerPos.x + ox, 0.3, playerPos.z + oz);
    }

    // Central massive explosion
    particles.emit('explosion', playerPos.x, 1, playerPos.z);
    particles.emit('explosion', playerPos.x, 0.5, playerPos.z);
    particles.emit('smoke', playerPos.x, 0.5, playerPos.z);

    // Flash light
    gameScene.spawnExplosionLight(playerPos.clone(), 0xffaa00, 8);

    return true;
  }

  /**
   * Update the bomb's active state. Returns DPS to apply to all enemies this frame.
   */
  update(deltaTime: number): number {
    if (!this.isActive) return 0;

    this.timer -= deltaTime;
    this.shakeIntensity *= 0.95;

    if (this.timer <= 0) {
      this.isActive = false;
      this.shakeIntensity = 0;
      return 0;
    }

    return BombSystem.DPS * deltaTime;
  }

  /**
   * Get the current camera shake intensity (0 to 1).
   */
  getShakeIntensity(): number {
    return this.isActive ? this.shakeIntensity : 0;
  }

  get active(): boolean {
    return this.isActive;
  }
}
