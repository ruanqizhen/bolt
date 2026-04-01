import * as THREE from 'three';
import { Weapon, WeaponType } from './WeaponFactory';
import { BulletManager } from '../Bullet';

/**
 * VulcanWeapon — Red weapon with high coverage spread attack.
 * Fires 2 to 16 bullets depending on level.
 */
export class VulcanWeapon implements Weapon {
  readonly type: WeaponType = 'vulcan';
  level = 1;

  private cooldown = 0;
  private static readonly FIRE_RATE = 0.10; // seconds between shots (increased by 30%)
  private static readonly BULLET_SPEED = 25;
  private static readonly DAMAGE = 10;



  fire(playerPos: THREE.Vector3, bulletManager: BulletManager, _deltaTime: number): boolean {
    if (this.cooldown > 0) return false;

    this.cooldown = VulcanWeapon.FIRE_RATE;

    const count = this.level * 2;
    const spreadAngle = (count - 1) * 10; // Fixed 10 degree gap between bullets
    const halfSpread = THREE.MathUtils.degToRad(spreadAngle / 2);

    for (let i = 0; i < count; i++) {
      let angle: number;
      if (count === 1) {
        angle = 0;
      } else {
        angle = -halfSpread + (halfSpread * 2 * i) / (count - 1);
      }

      const vx = Math.sin(angle) * VulcanWeapon.BULLET_SPEED;
      const vz = -Math.cos(angle) * VulcanWeapon.BULLET_SPEED;

      // Slight offset per bullet to prevent overlap
      const offsetX = Math.sin(angle) * 0.3;

      bulletManager.spawnPlayerBullet(
        playerPos.x + offsetX,
        playerPos.z - 0.5,
        vx,
        vz,
        VulcanWeapon.DAMAGE
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
