import * as THREE from 'three';
import { Pool } from '../systems/Pool';
import { EnemyMissile } from './EnemyMissile';
import { ParticleSystem } from '../systems/Particles';

/**
 * MissileManager — Manages a pool of homing missiles.
 * Separate from BulletManager because missiles have individual logic/health.
 */
export class MissileManager {
  private pool: Pool<EnemyMissile>;
  private static readonly MAX_MISSILES = 50;

  constructor(private scene: THREE.Scene, private particles: ParticleSystem) {
    this.pool = new Pool<EnemyMissile>(
      () => {
        const missile = new EnemyMissile();
        scene.add(missile.mesh);
        return missile;
      },
      MissileManager.MAX_MISSILES
    );
  }

  spawnMissile(
    pos: THREE.Vector3, 
    dir: THREE.Vector3, 
    speed: number = 5, 
    hp: number = 20
  ): EnemyMissile | null {
    if (this.pool.activeCount >= MissileManager.MAX_MISSILES) return null;

    const missile = this.pool.acquire();
    if (missile) {
      missile.spawn(pos, dir, speed, hp);
      return missile;
    }
    return null;
  }

  update(playerPos: THREE.Vector3, deltaTime: number): void {
    const active = this.pool.getActive();
    for (const missile of active) {
      missile.update(playerPos, this.particles, deltaTime);

      // Bounds cleanup (same as bullet bounds)
      if (
        Math.abs(missile.position.x) > 50 || 
        Math.abs(missile.position.z) > 50
      ) {
        this.pool.release(missile);
      }
    }
  }

  getActiveMissiles(): EnemyMissile[] {
    return this.pool.getActive();
  }

  releaseMissile(missile: EnemyMissile): void {
    this.pool.release(missile);
  }

  clearAll(): void {
    this.pool.releaseAll();
  }

  dispose(): void {
    this.pool.forEach((m) => m.dispose());
  }
}
