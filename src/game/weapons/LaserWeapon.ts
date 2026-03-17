import * as THREE from 'three';
import { Weapon, WeaponType } from './WeaponFactory';
import { BulletManager } from '../Bullet';

/**
 * LaserWeapon — Blue weapon with high single-point DPS and penetration.
 * Fires a continuous beam that damages all enemies in its path.
 * Implemented as a rapid stream of fast, narrow bullets that don't die on hit.
 */
export class LaserWeapon implements Weapon {
  readonly type: WeaponType = 'laser';
  level = 1;

  private cooldown = 0;
  private static readonly FIRE_RATE = 0.03; // Very fast fire rate for beam effect
  private static readonly BULLET_SPEED = 40;
  private static readonly BASE_DPS = 120;

  /** Number of parallel beams per level */
  private static readonly BEAMS_PER_LEVEL = [1, 1, 2, 2, 3, 3, 4, 4];
  /** Width spread per beam */
  private static readonly BEAM_SPREAD = 0.3;

  fire(playerPos: THREE.Vector3, bulletManager: BulletManager, _deltaTime: number): boolean {
    if (this.cooldown > 0) return false;

    this.cooldown = LaserWeapon.FIRE_RATE;

    const beamCount = LaserWeapon.BEAMS_PER_LEVEL[Math.min(this.level - 1, 7)];
    const damagePerBullet = (LaserWeapon.BASE_DPS * LaserWeapon.FIRE_RATE) / beamCount;

    for (let i = 0; i < beamCount; i++) {
      let offsetX = 0;
      if (beamCount > 1) {
        offsetX = (-((beamCount - 1) / 2) + i) * LaserWeapon.BEAM_SPREAD;
      }

      bulletManager.spawnPlayerBullet(
        playerPos.x + offsetX,
        playerPos.z - 0.5,
        0,
        -LaserWeapon.BULLET_SPEED,
        damagePerBullet
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
