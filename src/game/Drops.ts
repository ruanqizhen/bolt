import * as THREE from 'three';
import { TextureManager } from '../systems/TextureManager';

/** Drop item types */
export type DropType = 'powerup_red' | 'powerup_blue' | 'powerup_purple' | 'bomb' | 'medal';

/**
 * A single drop item in the game world.
 */
export class DropItem {
  public mesh: THREE.Mesh;
  public position: THREE.Vector3;
  public type: DropType;
  public active = false;
  private age = 0;
  private baseColor = 0xffffff;
  private isFlashing = false;
  private isRainbow = false;

  // Drop items float down slowly
  private static readonly FALL_SPEED = 2;
  private static readonly LIFETIME = 8;

  constructor() {
    const geom = new THREE.PlaneGeometry(0.6, 0.6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.visible = false;
    this.position = this.mesh.position;
    this.type = 'medal';
  }

  spawn(x: number, z: number, type: DropType, baseColor = 0xffffff, isFlashing = false, isRainbow = false): void {
    this.active = true;
    this.age = 0;
    this.type = type;
    this.position.set(x, 0.3, z);
    this.mesh.visible = true;

    this.baseColor = baseColor;
    this.isFlashing = isFlashing;
    this.isRainbow = isRainbow;

    // Set texture by type
    const tm = TextureManager.getInstance();
    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    mat.map = tm.getDrop(type);
    mat.needsUpdate = true;
    mat.color.setHex(baseColor);
  }

  update(deltaTime: number): void {
    if (!this.active) return;

    this.age += deltaTime;
    this.position.z += DropItem.FALL_SPEED * deltaTime;

    // Spin animation
    this.mesh.rotation.y += 3 * deltaTime;

    // Bob up/down
    this.mesh.position.y = 0.3 + Math.sin(this.age * 4) * 0.1;

    // Expire
    if (this.age > DropItem.LIFETIME || this.position.z > 20) {
      this.deactivate();
    }

    // Special visualizations for medal chains
    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    if (this.isFlashing) {
      // Fast pulse opacity
      mat.opacity = 0.5 + Math.sin(this.age * 20) * 0.5;
    } else {
      mat.opacity = 1.0;
    }

    if (this.isRainbow) {
      // Rapid color cycling
      mat.color.setHSL((this.age * 2) % 1.0, 1.0, 0.6);
    } else {
      mat.color.setHex(this.baseColor);
    }

    // Flash near expiry (overrides opacity)
    if (this.age > DropItem.LIFETIME - 2) {
      this.mesh.visible = Math.sin(this.age * 10) > 0;
    } else {
      this.mesh.visible = true;
    }
  }

  deactivate(): void {
    this.active = false;
    this.mesh.visible = false;
  }
}

/**
 * DropManager — Manages all drop items in the scene.
 */
export class DropManager {
  private drops: DropItem[] = [];
  private static readonly POOL_SIZE = 30;

  constructor(scene: THREE.Scene) {
    for (let i = 0; i < DropManager.POOL_SIZE; i++) {
      const drop = new DropItem();
      scene.add(drop.mesh);
      this.drops.push(drop);
    }
  }

  /**
   * Spawn a drop at the given position based on roll result.
   */
  spawn(x: number, z: number, rollResult: 'powerup' | 'bomb' | 'medal' | null, currentWeapon?: string, medalState: 'normal' | 'gold' | 'gold_flash' | 'rainbow' = 'normal'): void {
    if (!rollResult) return;

    let type: DropType;
    let baseColor = 0xffffff;
    let isFlashing = false;
    let isRainbow = false;

    if (rollResult === 'powerup') {
      // Randomly pick a weapon color, bias toward current
      const r = Math.random();
      if (r < 0.5 && currentWeapon) {
        type = `powerup_${currentWeapon}` as DropType;
      } else {
        const colors: DropType[] = ['powerup_red', 'powerup_blue', 'powerup_purple'];
        type = colors[Math.floor(Math.random() * colors.length)];
      }
    } else if (rollResult === 'bomb') {
      type = 'bomb';
    } else {
      type = 'medal';
      if (medalState === 'gold') baseColor = 0xffd700;
      else if (medalState === 'gold_flash') { baseColor = 0xffffff; isFlashing = true; } // Flash between white/invisible texture opacity
      else if (medalState === 'rainbow') { baseColor = 0xffffff; isRainbow = true; }
    }

    const drop = this.drops.find((d) => !d.active);
    if (drop) {
      drop.spawn(x, z, type, baseColor, isFlashing, isRainbow);
    }
  }

  /**
   * Spawn a power-up rain event (multiple power-ups across the screen).
   */
  spawnPowerUpRain(): void {
    for (let i = 0; i < 5; i++) {
      const x = (Math.random() - 0.5) * 12;
      const z = -12 - Math.random() * 5;
      const types: DropType[] = ['powerup_red', 'powerup_blue', 'powerup_purple', 'medal', 'medal'];
      const type = types[Math.floor(Math.random() * types.length)];
      const drop = this.drops.find((d) => !d.active);
      if (drop) {
        drop.spawn(x, z, type);
      }
    }
  }

  update(deltaTime: number): void {
    for (const drop of this.drops) {
      drop.update(deltaTime);
    }
  }

  /**
   * Collect drops near the player position. Returns collected drop types.
   */
  collect(playerPos: THREE.Vector3, collectRadius = 1.0): DropType[] {
    const collected: DropType[] = [];
    for (const drop of this.drops) {
      if (!drop.active) continue;
      const dx = drop.position.x - playerPos.x;
      const dz = drop.position.z - playerPos.z;
      if (Math.sqrt(dx * dx + dz * dz) < collectRadius) {
        collected.push(drop.type);
        drop.deactivate();
      }
    }
    return collected;
  }

  dispose(): void {
    for (const drop of this.drops) {
      drop.mesh.geometry.dispose();
      (drop.mesh.material as THREE.Material).dispose();
    }
  }
}
