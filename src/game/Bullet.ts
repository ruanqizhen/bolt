import * as THREE from 'three';
import { Pool, Poolable } from '../systems/Pool';

/**
 * A single bullet instance (data only, rendering is batched via InstancedMesh).
 */
export class BulletData implements Poolable {
  active = false;
  position = new THREE.Vector3();
  velocity = new THREE.Vector3();
  damage = 10;
  lifetime = 5; // seconds
  age = 0;
  /** 'player' or 'enemy' */
  owner: 'player' | 'enemy' = 'player';
  /** Visual type: 0=vulcan, 1=laser, 2=homing (if projectile) */
  type = 0;

  reset(): void {
    this.position.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.damage = 10;
    this.lifetime = 5;
    this.age = 0;
    this.owner = 'player';
    this.type = 0;
  }
}

/**
 * BulletManager — Manages all bullets using object pools and InstancedMesh rendering.
 * Separate pools for player and enemy bullets.
 */
export class BulletManager {
  private playerPool: Pool<BulletData>;
  private enemyPool: Pool<BulletData>;

  // Homing beams (visual only)
  private homingBeams: HomingBeamVisual[] = [];
  private static readonly MAX_HOMING_BEAMS = 20;

  // InstancedMeshes for rendering different bullet types
  private vulcanMesh: THREE.InstancedMesh;
  private vulcanGlowMesh: THREE.InstancedMesh;
  private laserMesh: THREE.InstancedMesh;
  private laserGlowMesh: THREE.InstancedMesh;
  private enemyBulletMesh: THREE.InstancedMesh;
  private enemyGlowMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();

  private static readonly PLAYER_POOL_SIZE = 500;
  private static readonly ENEMY_POOL_SIZE = 1500;
  private static readonly MAX_ENEMY_BULLETS = 600;

  // Bounds for cleanup
  private static readonly BOUNDS = 50;

  constructor(scene: THREE.Scene) {
    // Create pools
    this.playerPool = new Pool<BulletData>(
      () => new BulletData(),
      BulletManager.PLAYER_POOL_SIZE
    );
    this.enemyPool = new Pool<BulletData>(
      () => new BulletData(),
      BulletManager.ENEMY_POOL_SIZE
    );

    // Initialize homing beam visuals
    for (let i = 0; i < BulletManager.MAX_HOMING_BEAMS; i++) {
      const beam = new HomingBeamVisual();
      this.homingBeams.push(beam);
      scene.add(beam.mesh);
    }

    // Vulcan bullets — hot glowing tracer rounds
    const vGeom = new THREE.PlaneGeometry(0.12, 0.5);
    vGeom.rotateX(-Math.PI / 2);
    const vMat = new THREE.MeshBasicMaterial({
      color: 0xff5588,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.vulcanMesh = new THREE.InstancedMesh(vGeom, vMat, BulletManager.PLAYER_POOL_SIZE);
    this.vulcanMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.vulcanMesh.frustumCulled = false;
    this.vulcanMesh.layers.set(1); // Enable bloom for player bullets
    scene.add(this.vulcanMesh);

    // Vulcan glow halo (wider, dimmer layer behind each tracer)
    const vGlowGeom = new THREE.PlaneGeometry(0.3, 0.7);
    vGlowGeom.rotateX(-Math.PI / 2);
    const vGlowMat = new THREE.MeshBasicMaterial({
      color: 0xff2266,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.vulcanGlowMesh = new THREE.InstancedMesh(vGlowGeom, vGlowMat, BulletManager.PLAYER_POOL_SIZE);
    this.vulcanGlowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.vulcanGlowMesh.frustumCulled = false;
    this.vulcanGlowMesh.layers.set(1);
    scene.add(this.vulcanGlowMesh);

    // Laser — white-hot inner core
    const lCoreGeom = new THREE.PlaneGeometry(0.15, 1.4);
    lCoreGeom.rotateX(-Math.PI / 2);
    const lCoreMat = new THREE.MeshBasicMaterial({
      color: 0xccddff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.laserMesh = new THREE.InstancedMesh(lCoreGeom, lCoreMat, BulletManager.PLAYER_POOL_SIZE);
    this.laserMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.laserMesh.frustumCulled = false;
    this.laserMesh.layers.set(1);
    scene.add(this.laserMesh);

    // Laser — blue outer sheath (wider glow)
    const lSheathGeom = new THREE.PlaneGeometry(0.5, 1.6);
    lSheathGeom.rotateX(-Math.PI / 2);
    const lSheathMat = new THREE.MeshBasicMaterial({
      color: 0x0055ff,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.laserGlowMesh = new THREE.InstancedMesh(lSheathGeom, lSheathMat, BulletManager.PLAYER_POOL_SIZE);
    this.laserGlowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.laserGlowMesh.frustumCulled = false;
    this.laserGlowMesh.layers.set(1);
    scene.add(this.laserGlowMesh);

    // Enemy bullets — smooth glowing orbs
    const eGeom = new THREE.SphereGeometry(0.13, 12, 12);
    const eMat = new THREE.MeshBasicMaterial({
      color: 0xffcc44,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.enemyBulletMesh = new THREE.InstancedMesh(eGeom, eMat, BulletManager.ENEMY_POOL_SIZE);
    this.enemyBulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.enemyBulletMesh.frustumCulled = false;
    this.enemyBulletMesh.layers.set(1); // Enable bloom for enemy bullets
    scene.add(this.enemyBulletMesh);

    // Enemy bullet glow halos (larger, dimmer)
    const eGlowGeom = new THREE.SphereGeometry(0.25, 8, 8);
    const eGlowMat = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.enemyGlowMesh = new THREE.InstancedMesh(eGlowGeom, eGlowMat, BulletManager.ENEMY_POOL_SIZE);
    this.enemyGlowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.enemyGlowMesh.frustumCulled = false;
    this.enemyGlowMesh.layers.set(1);
    scene.add(this.enemyGlowMesh);
  }

  /**
   * Spawn a player bullet.
   */
  spawnPlayerBullet(x: number, z: number, vx: number, vz: number, damage = 10, type = 0): BulletData | null {
    const bullet = this.playerPool.acquire();
    if (!bullet) return null;
    bullet.position.set(x, 0.2, z);
    bullet.velocity.set(vx, 0, vz);
    bullet.damage = damage;
    bullet.type = type;
    bullet.owner = 'player';
    return bullet;
  }

  /**
   * Spawn an enemy bullet.
   */
  spawnEnemyBullet(x: number, z: number, vx: number, vz: number, damage = 10): BulletData | null {
    // Enforce max enemy bullet count
    if (this.enemyPool.activeCount >= BulletManager.MAX_ENEMY_BULLETS) {
      return null;
    }
    const bullet = this.enemyPool.acquire();
    if (!bullet) return null;
    bullet.position.set(x, 0.2, z);
    bullet.velocity.set(vx, 0, vz);
    bullet.damage = damage;
    bullet.owner = 'enemy';
    return bullet;
  }

  /**
   * Update all bullets: move, age, recycle out-of-bounds.
   */
  update(deltaTime: number): void {
    this.updatePool(this.playerPool, deltaTime);
    this.updatePool(this.enemyPool, deltaTime);
    
    for (const beam of this.homingBeams) {
      beam.update(deltaTime);
    }
    
    // Separate player bullets by type for rendering
    let vIdx = 0, lIdx = 0;
    this.playerPool.forEach((bullet) => {
      this.dummy.position.copy(bullet.position);
      // Align bullet rotation to match velocity vector
      const target = bullet.position.clone().add(bullet.velocity);
      this.dummy.lookAt(target);
      this.dummy.updateMatrix();
      
      if (bullet.type === 0) {
        this.vulcanMesh.setMatrixAt(vIdx, this.dummy.matrix);
        this.vulcanGlowMesh.setMatrixAt(vIdx, this.dummy.matrix);
        vIdx++;
      } else if (bullet.type === 1) {
        this.laserMesh.setMatrixAt(lIdx, this.dummy.matrix);
        this.laserGlowMesh.setMatrixAt(lIdx, this.dummy.matrix);
        lIdx++;
      }
    });
    
    this.finalizeMesh(this.vulcanMesh, vIdx);
    this.finalizeMesh(this.vulcanGlowMesh, vIdx);
    this.finalizeMesh(this.laserMesh, lIdx);
    this.finalizeMesh(this.laserGlowMesh, lIdx);

    // Enemy bullets
    let eIdx = 0;
    this.enemyPool.forEach((bullet) => {
      this.dummy.position.copy(bullet.position);
      this.dummy.lookAt(bullet.position.clone().add(bullet.velocity));
      this.dummy.updateMatrix();
      this.enemyBulletMesh.setMatrixAt(eIdx, this.dummy.matrix);
      this.enemyGlowMesh.setMatrixAt(eIdx, this.dummy.matrix);
      eIdx++;
    });
    this.finalizeMesh(this.enemyBulletMesh, eIdx);
    this.finalizeMesh(this.enemyGlowMesh, eIdx);
  }

  private finalizeMesh(mesh: THREE.InstancedMesh, activeCount: number): void {
    // Hide unused instances
    for (let i = activeCount; i < mesh.count; i++) {
      this.dummy.position.set(0, -100, 0);
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.dummy.scale.set(1, 1, 1);
    
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = Math.max(activeCount, 1);
  }

  /**
   * Draw a homing laser beam connecting two points.
   */
  drawHomingBeam(start: THREE.Vector3, end: THREE.Vector3): void {
    const beam = this.homingBeams.find((b) => !b.active);
    if (beam) {
      beam.fire(start, end);
    }
  }

  private updatePool(pool: Pool<BulletData>, deltaTime: number): void {
    pool.forEach((bullet) => {
      bullet.position.add(bullet.velocity.clone().multiplyScalar(deltaTime));
      bullet.age += deltaTime;

      // Recycle if out of bounds or expired
      if (
        bullet.age >= bullet.lifetime ||
        Math.abs(bullet.position.x) > BulletManager.BOUNDS ||
        Math.abs(bullet.position.z) > BulletManager.BOUNDS
      ) {
        pool.release(bullet);
      }
    });
  }

  /**
   * Get all active player bullets (for collision checks).
   */
  getActivePlayerBullets(): BulletData[] {
    return this.playerPool.getActive();
  }

  /**
   * Get all active enemy bullets (for collision checks).
   */
  getActiveEnemyBullets(): BulletData[] {
    return this.enemyPool.getActive();
  }

  /**
   * Release a specific bullet back to its pool.
   */
  releaseBullet(bullet: BulletData): void {
    if (bullet.owner === 'player') {
      this.playerPool.release(bullet);
    } else {
      this.enemyPool.release(bullet);
    }
  }

  /**
   * Clear all enemy bullets (e.g., bomb effect).
   */
  clearAllEnemyBullets(): void {
    this.enemyPool.releaseAll();
  }

  /**
   * Clear all bullets.
   */
  clearAll(): void {
    this.playerPool.releaseAll();
    this.enemyPool.releaseAll();
  }

  dispose(): void {
    this.vulcanMesh.geometry.dispose();
    (this.vulcanMesh.material as THREE.Material).dispose();
    this.vulcanGlowMesh.geometry.dispose();
    (this.vulcanGlowMesh.material as THREE.Material).dispose();
    this.laserMesh.geometry.dispose();
    (this.laserMesh.material as THREE.Material).dispose();
    this.laserGlowMesh.geometry.dispose();
    (this.laserGlowMesh.material as THREE.Material).dispose();
    this.enemyBulletMesh.geometry.dispose();
    (this.enemyBulletMesh.material as THREE.Material).dispose();
    this.enemyGlowMesh.geometry.dispose();
    (this.enemyGlowMesh.material as THREE.Material).dispose();
    
    for (const beam of this.homingBeams) {
      beam.dispose();
    }
  }
}

/**
 * HomingBeamVisual — Manages a single curved beam rendered as a TubeGeometry.
 */
class HomingBeamVisual {
  public mesh: THREE.Mesh;
  public age = 0;
  public active = false;
  private static readonly LIFETIME = 0.2; // very short flash

  constructor() {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xcc33ff, // purple-red
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    // Start with a small dummy geometry
    const geom = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0.1)), 2, 0.1, 4, false);
    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.visible = false;
    this.mesh.layers.set(1); // Enable bloom for homing beams
  }

  fire(start: THREE.Vector3, end: THREE.Vector3): void {
    this.active = true;
    this.age = 0;
    this.mesh.visible = true;

    // Calculate a control point to make the curve flex outward
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(end, start).normalize();
    const dist = start.distanceTo(end);

    // Perpendicular vector for the bow effect
    const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(dist * 0.4);
    if (Math.random() > 0.5) perp.negate();

    const control = mid.add(perp);
    const curve = new THREE.QuadraticBezierCurve3(start, control, end);

    // Create new geometry and properly dispose of old one
    const oldGeom = this.mesh.geometry;
    const geom = new THREE.TubeGeometry(curve, 12, 0.15, 6, false);
    this.mesh.geometry = geom;
    oldGeom.dispose(); // Dispose old geometry after assignment

    (this.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8;
  }

  update(deltaTime: number): void {
    if (!this.active) return;
    this.age += deltaTime;
    if (this.age > HomingBeamVisual.LIFETIME) {
      this.active = false;
      this.mesh.visible = false;
    } else {
      (this.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - this.age / HomingBeamVisual.LIFETIME);
    }
  }
  
  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
