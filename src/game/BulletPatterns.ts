import * as THREE from 'three';
import { BulletManager } from './Bullet';

/**
 * BulletPatterns — Unified bullet pattern spawning system.
 * Used by bosses and special enemies for complex attack patterns.
 */
export class BulletPatterns {
  constructor(private bulletManager: BulletManager) {}

  /** Single aimed shot at target */
  spawnSniperShot(origin: THREE.Vector3, target: THREE.Vector3, speed = 12): void {
    const dir = new THREE.Vector3().subVectors(target, origin).normalize();
    this.bulletManager.spawnEnemyBullet(origin.x, origin.z, dir.x * speed, dir.z * speed);
  }

  /** Fan spread from origin aimed at target */
  spawnFanPattern(
    origin: THREE.Vector3,
    target: THREE.Vector3,
    count: number,
    angleSpread: number,
    speed: number
  ): void {
    const baseAngle = Math.atan2(target.x - origin.x, target.z - origin.z);
    const halfSpread = THREE.MathUtils.degToRad(angleSpread / 2);

    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1);
      const angle = baseAngle + (-halfSpread + halfSpread * 2 * t);
      this.bulletManager.spawnEnemyBullet(
        origin.x, origin.z,
        Math.sin(angle) * speed,
        Math.cos(angle) * speed
      );
    }
  }

  /** 360° radial burst */
  spawnRadialBurst(origin: THREE.Vector3, count: number, speed: number, angleOffset = 0): void {
    for (let i = 0; i < count; i++) {
      const angle = angleOffset + (Math.PI * 2 * i) / count;
      this.bulletManager.spawnEnemyBullet(
        origin.x, origin.z,
        Math.sin(angle) * speed,
        Math.cos(angle) * speed
      );
    }
  }

  /** Rotating ring — call repeatedly each frame with incrementing offset */
  spawnRotatingRing(origin: THREE.Vector3, count: number, speed: number, angleOffset: number): void {
    this.spawnRadialBurst(origin, count, speed, angleOffset);
  }

  /** Flower pattern — multiple rings with angular offset per ring */
  spawnFlowerPattern(
    origin: THREE.Vector3,
    ringCount: number,
    bulletsPerRing: number,
    speed: number,
    offsetPerRing = 10
  ): void {
    for (let r = 0; r < ringCount; r++) {
      const offset = THREE.MathUtils.degToRad(r * offsetPerRing);
      const ringSpeed = speed * (0.8 + r * 0.15);
      this.spawnRadialBurst(origin, bulletsPerRing, ringSpeed, offset);
    }
  }
}
