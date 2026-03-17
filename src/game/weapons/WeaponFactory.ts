import * as THREE from 'three';
import { BulletManager } from '../Bullet';

/**
 * WeaponType — The three weapon color types.
 */
export type WeaponType = 'vulcan' | 'laser' | 'homing';

/**
 * Base interface for all weapon implementations.
 */
export interface Weapon {
  readonly type: WeaponType;
  level: number;
  /** Fire the weapon. Returns true if fired, false if on cooldown. */
  fire(playerPos: THREE.Vector3, bulletManager: BulletManager, deltaTime: number): boolean;
  /** Update internal state (cooldowns, etc.) */
  update(deltaTime: number): void;
}

/**
 * WeaponFactory — Creates and manages weapon instances, handles switching and upgrading.
 */
export class WeaponFactory {
  private weapons: Map<WeaponType, Weapon> = new Map();
  private _currentType: WeaponType = 'vulcan';
  private _currentWeapon!: Weapon;

  constructor() {
    // Weapons are registered externally via registerWeapon()
  }

  registerWeapon(weapon: Weapon): void {
    this.weapons.set(weapon.type, weapon);
    if (weapon.type === this._currentType) {
      this._currentWeapon = weapon;
    }
  }

  get currentWeapon(): Weapon {
    return this._currentWeapon;
  }

  get currentType(): WeaponType {
    return this._currentType;
  }

  get currentLevel(): number {
    return this._currentWeapon?.level ?? 1;
  }

  /**
   * Switch to a different weapon type.
   */
  switchWeapon(type: WeaponType): void {
    const weapon = this.weapons.get(type);
    if (weapon) {
      this._currentType = type;
      this._currentWeapon = weapon;
    }
  }

  /**
   * Upgrade the current weapon by 1 level (max 8).
   */
  upgrade(): void {
    if (this._currentWeapon && this._currentWeapon.level < 8) {
      this._currentWeapon.level++;
    }
  }

  /**
   * Handle a weapon pickup. Same type = upgrade, different = switch.
   */
  pickup(type: WeaponType): void {
    if (type === this._currentType) {
      this.upgrade();
    } else {
      this.switchWeapon(type);
    }
  }

  /**
   * Reset weapon level to 1 (e.g., on death).
   */
  resetLevel(): void {
    if (this._currentWeapon) {
      this._currentWeapon.level = 1;
    }
  }

  /**
   * Fire the current weapon.
   */
  fire(playerPos: THREE.Vector3, bulletManager: BulletManager, deltaTime: number): boolean {
    if (!this._currentWeapon) return false;
    return this._currentWeapon.fire(playerPos, bulletManager, deltaTime);
  }

  /**
   * Update all weapons (cooldowns).
   */
  update(deltaTime: number): void {
    this.weapons.forEach((w) => w.update(deltaTime));
  }
}
