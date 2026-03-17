import * as THREE from 'three';
import { Weapon, WeaponType } from './WeaponFactory';
import { BulletManager } from '../Bullet';

/**
 * HomingLaserWeapon — Purple weapon with auto-tracking multi-target capability.
 * Fires homing projectiles that track the nearest enemy positions.
 * Level 1 = 1 target, Level 8 = 5 targets.
 */
export class HomingLaserWeapon implements Weapon {
  readonly type: WeaponType = 'homing';
  level = 1;

  private cooldown = 0;
  private static readonly FIRE_RATE = 0.15;
  private static readonly BULLET_SPEED = 18;
  private static readonly DAMAGE = 8;

  /** Number of homing projectiles per level */
  private static readonly TARGETS_PER_LEVEL = [1, 1, 2, 2, 3, 3, 4, 5];

  /** Enemy positions to target — set externally each frame */
  public enemyPositions: THREE.Vector3[] = [];

  fire(playerPos: THREE.Vector3, bulletManager: BulletManager, _deltaTime: number): boolean {
    if (this.cooldown > 0) return false;

    this.cooldown = HomingLaserWeapon.FIRE_RATE;

    const targetCount = HomingLaserWeapon.TARGETS_PER_LEVEL[Math.min(this.level - 1, 7)];

    // Sort enemies by distance to player
    const sorted = [...this.enemyPositions]
      .map((pos) => ({ pos, dist: pos.distanceTo(playerPos) }))
      .sort((a, b) => a.dist - b.dist);

    for (let i = 0; i < targetCount; i++) {
      let vx = 0;
      let vz = -HomingLaserWeapon.BULLET_SPEED;

      if (i < sorted.length) {
        // Aim toward the target
        const dir = new THREE.Vector3()
          .subVectors(sorted[i].pos, playerPos)
          .normalize();
        vx = dir.x * HomingLaserWeapon.BULLET_SPEED;
        vz = dir.z * HomingLaserWeapon.BULLET_SPEED;
      } else {
        // No target — spread upward with slight angle
        const angle = (i - targetCount / 2) * 0.3;
        vx = Math.sin(angle) * HomingLaserWeapon.BULLET_SPEED;
        vz = -Math.cos(angle) * HomingLaserWeapon.BULLET_SPEED;
      }

      const offsetX = (i - (targetCount - 1) / 2) * 0.4;

      bulletManager.spawnPlayerBullet(
        playerPos.x + offsetX,
        playerPos.z - 0.3,
        vx,
        vz,
        HomingLaserWeapon.DAMAGE
      );
    }

    return true;
  }

  update(deltaTime: number): void {
    if (this.cooldown > 0) {
      this.cooldown -= deltaTime;
    }
  }
}
