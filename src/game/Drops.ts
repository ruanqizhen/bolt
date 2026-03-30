import * as THREE from 'three';

/** Drop item types */
export type DropType = 'powerup_red' | 'powerup_blue' | 'powerup_purple' | 'bomb' | 'medal';

/**
 * A single drop item in the game world.
 */
export class DropItem {
  public mesh: THREE.Group;
  public position: THREE.Vector3;
  public type: DropType;
  public active = false;
  private age = 0;
  private baseColor = 0xffffff;
  private isFlashing = false;
  private isRainbow = false;

  // Drop items float down slowly
  private static readonly FALL_SPEED = 2;
  private static readonly LIFETIME = 10;

  // Visuals
  private powerupGroup: THREE.Group;
  private bombGroup: THREE.Group;
  private medalGroup: THREE.Group;

  private coreMat: THREE.MeshBasicMaterial;
  private shellMat: THREE.MeshBasicMaterial;
  private bombCoreMat: THREE.MeshBasicMaterial;
  private medalMat: THREE.MeshPhongMaterial;

  constructor() {
    this.mesh = new THREE.Group();
    this.position = this.mesh.position;
    this.type = 'medal';
    this.mesh.visible = false;

    // Base materials that can be color-tinted per instance
    this.coreMat = new THREE.MeshBasicMaterial({ 
      color: 0xffffff, 
      transparent: true, 
      opacity: 0.9,
      blending: THREE.AdditiveBlending 
    });
    this.shellMat = new THREE.MeshBasicMaterial({ 
      color: 0xffffff, 
      wireframe: true, 
      transparent: true, 
      opacity: 0.6,
      blending: THREE.AdditiveBlending 
    });

    // 1. Powerup (Octahedron inner core + wireframe outer shell)
    this.powerupGroup = new THREE.Group();
    const pCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), this.coreMat);
    pCore.layers.set(1); // Bloom layer
    const pShell = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), this.shellMat);
    pShell.layers.set(1);
    this.powerupGroup.add(pCore, pShell);
    this.mesh.add(this.powerupGroup);

    // 2. Bomb (Cartoon bomb: 50% larger, dark red color)
    this.bombGroup = new THREE.Group();
    const bombBody = new THREE.Mesh(new THREE.SphereGeometry(0.33, 24, 24), new THREE.MeshBasicMaterial({ color: 0x660000 }));
    const bombOutline = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), new THREE.MeshBasicMaterial({ color: 0xff5555, wireframe: true, transparent: true, opacity: 0.6 }));
    const bombCap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 12), new THREE.MeshBasicMaterial({ color: 0x444444 }));
    bombCap.position.y = 0.33;
    this.bombCoreMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const bombSpark = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), this.bombCoreMat);
    bombSpark.position.set(0, 0.42, 0);
    bombSpark.layers.set(1); // Bloom only the spark
    this.bombGroup.add(bombBody, bombOutline, bombCap, bombSpark);
    this.mesh.add(this.bombGroup);

    // 3. Medal (Golden coin with metallic material so it reacts to light and looks 3D)
    this.medalGroup = new THREE.Group();
    this.medalMat = new THREE.MeshPhongMaterial({ 
      color: 0xffff00, 
      emissive: 0xcc9900,
      specular: 0xffffff,
      shininess: 100,
      transparent: true, 
      opacity: 1.0 
    });
    // A classic coin is a highly segmented cylinder
    const mBody = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 32), this.medalMat);
    mBody.rotation.x = Math.PI / 2; // Face forward (+Z) so spinning on Y looks like a real 3D coin edge
    this.medalGroup.add(mBody);
    this.mesh.add(this.medalGroup);
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

    // Reset visibility
    this.powerupGroup.visible = false;
    this.bombGroup.visible = false;
    this.medalGroup.visible = false;

    // Configure visuals
    if (type.startsWith('powerup_')) {
      this.powerupGroup.visible = true;
      if (type === 'powerup_red') this.baseColor = 0xff5555;
      else if (type === 'powerup_blue') this.baseColor = 0x3366ff;
      else if (type === 'powerup_purple') this.baseColor = 0xcc33ff;
      
      this.coreMat.color.setHex(this.baseColor);
      this.shellMat.color.setHex(this.baseColor);
    } else if (type === 'bomb') {
      this.bombGroup.visible = true;
    } else if (type === 'medal') {
      this.medalGroup.visible = true;
      if (this.baseColor === 0xffffff && !this.isFlashing && !this.isRainbow) {
        this.baseColor = 0xffff00; // Bright solid gold
      }
      this.medalMat.color.setHex(this.baseColor);
    }
  }

  update(deltaTime: number): void {
    if (!this.active) return;

    this.age += deltaTime;
    this.position.z += DropItem.FALL_SPEED * deltaTime;

    // Animations per type
    if (this.type.startsWith('powerup_')) {
      // Counter-rotating inner and outer shells
      const core = this.powerupGroup.children[0];
      const shell = this.powerupGroup.children[1];
      core.rotation.x += deltaTime * 2;
      core.rotation.y += deltaTime * 2.5;
      shell.rotation.x -= deltaTime * 1.5;
      shell.rotation.y -= deltaTime * 1.8;
    } else if (this.type === 'bomb') {
      // Bob and rotate the bomb slightly
      this.bombGroup.rotation.y += deltaTime * 2;
      this.bombGroup.rotation.z = Math.sin(this.age * 5) * 0.2; // Slight wobble
      
      // Heartbeat fuse spark with scaling
      this.bombCoreMat.color.setHex(Math.sin(this.age * 15) > 0 ? 0xff5500 : 0xffff00);
      const scale = 1 + Math.sin(this.age * 30) * 0.3;
      this.bombGroup.children[3].scale.set(scale, scale, scale);
    } else if (this.type === 'medal') {
      // Spin horizontally like a coin
      this.medalGroup.rotation.y += deltaTime * 3.5;
      this.medalGroup.rotation.z = Math.sin(this.age * 4) * 0.1; // Gentle wobble
    }

    // Bob up and down for all items
    this.mesh.position.y = 0.3 + Math.sin(this.age * 4) * 0.15;

    // Handling special medal states (flashing or rainbow)
    if (this.type === 'medal') {
      // Medals use medalMat which is completely opaque normally
      if (this.isFlashing) {
        this.medalMat.opacity = 0.5 + Math.sin(this.age * 20) * 0.5;
      } else {
        this.medalMat.opacity = 1.0;
      }

      if (this.isRainbow) {
        this.medalMat.color.setHSL((this.age * 2) % 1.0, 1.0, 0.6);
      }
    }

    // Blink before expiry
    if (this.age > DropItem.LIFETIME - 2) {
      this.mesh.visible = Math.sin(this.age * 15) > 0;
    } else {
      this.mesh.visible = true;
    }

    // Clean up if out of bounds or expired
    if (this.age > DropItem.LIFETIME || this.position.z > 20) {
      this.deactivate();
    }
  }

  deactivate(): void {
    this.active = false;
    this.mesh.visible = false;
  }

  dispose(): void {
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
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
      else if (medalState === 'gold_flash') { baseColor = 0xffffff; isFlashing = true; }
      else if (medalState === 'rainbow') { baseColor = 0xffffff; isRainbow = true; }
    }

    const drop = this.drops.find((d) => !d.active);
    if (drop) {
      drop.spawn(x, z, type, baseColor, isFlashing, isRainbow);
    }
  }

  /**
   * Spawn a power-up rain event
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
      drop.dispose();
    }
  }
}
