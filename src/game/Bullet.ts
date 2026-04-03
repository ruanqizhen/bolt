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
  poolIndex = -1;
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
    this.poolIndex = -1;
  }
}

/**
 * HomingBeamData — Data for homing laser beams.
 * Rendered via InstancedMesh and custom Bezier shader.
 */
export class HomingBeamData implements Poolable {
  active = false;
  poolIndex = -1;
  age = 0;
  lifetime = 0.22;
  
  start = new THREE.Vector3();
  control = new THREE.Vector3();
  end = new THREE.Vector3();
  
  reset(): void {
    this.active = false;
    this.poolIndex = -1;
    this.age = 0;
  }
}

/**
 * BulletManager — Manages all bullets using object pools and InstancedMesh rendering.
 * Separate pools for player and enemy bullets.
 */
export class BulletManager {
  private playerPool: Pool<BulletData>;
  private enemyPool: Pool<BulletData>;
  private homingPool: Pool<HomingBeamData>;

  // InstancedMeshes for rendering
  private vulcanMesh: THREE.InstancedMesh;
  private vulcanGlowMesh: THREE.InstancedMesh;
  private laserMesh: THREE.InstancedMesh;
  private laserGlowMesh: THREE.InstancedMesh;
  private enemyBulletMesh: THREE.InstancedMesh;
  private enemyGlowMesh: THREE.InstancedMesh;
  
  private homingMesh: THREE.InstancedMesh;
  private homingStartAttr: THREE.InstancedBufferAttribute;
  private homingControlAttr: THREE.InstancedBufferAttribute;
  private homingEndAttr: THREE.InstancedBufferAttribute;
  private homingAlphaAttr: THREE.InstancedBufferAttribute;

  private dummy = new THREE.Object3D();
  private static readonly TEMP_VEC = new THREE.Vector3();
  private static readonly TEMP_VEC_B = new THREE.Vector3();
  private static readonly TEMP_VEC_C = new THREE.Vector3();

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
    this.homingPool = new Pool<HomingBeamData>(
      () => new HomingBeamData(),
      20 // MAX_HOMING_BEAMS
    );

    // Initialize homing beam renderer (Bezier Shader + InstancedMesh)
    const hGeom = new THREE.PlaneGeometry(1, 1, 1, 16);
    const hMat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: `
        attribute vec3 iStart;
        attribute vec3 iControl;
        attribute vec3 iEnd;
        attribute float iAlpha;
        varying float vAlpha;
        varying float vProgress;
        void main() {
          float t = uv.y; 
          vProgress = t;
          vAlpha = iAlpha;
          // Bezier P(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
          vec3 pos = (1.0-t)*(1.0-t)*iStart + 2.0*(1.0-t)*t*iControl + t*t*iEnd;
          // Tangent P'(t) = 2(1-t)(P1-P0) + 2t(P2-P1)
          vec3 tangent = normalize(2.0*(1.0-t)*(iControl - iStart) + 2.0*t*(iEnd - iControl));
          vec3 normal = vec3(-tangent.z, 0.0, tangent.x);
          pos += normal * (uv.x - 0.5) * 0.4; // thickness
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying float vProgress;
        void main() {
          float glow = sin(vProgress * 3.14159);
          vec3 col = vec3(0.8, 0.2, 1.0) * vAlpha * glow * 2.0;
          gl_FragColor = vec4(col, vAlpha * glow);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.homingMesh = new THREE.InstancedMesh(hGeom, hMat, 20);
    this.homingMesh.frustumCulled = false;
    this.homingMesh.layers.enable(1);
    
    this.homingStartAttr = new THREE.InstancedBufferAttribute(new Float32Array(20 * 3), 3);
    this.homingControlAttr = new THREE.InstancedBufferAttribute(new Float32Array(20 * 3), 3);
    this.homingEndAttr = new THREE.InstancedBufferAttribute(new Float32Array(20 * 3), 3);
    this.homingAlphaAttr = new THREE.InstancedBufferAttribute(new Float32Array(20), 1);
    
    hGeom.setAttribute('iStart', this.homingStartAttr);
    hGeom.setAttribute('iControl', this.homingControlAttr);
    hGeom.setAttribute('iEnd', this.homingEndAttr);
    hGeom.setAttribute('iAlpha', this.homingAlphaAttr);
    
    scene.add(this.homingMesh);

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
    
    // Update homing beams
    let hIdx = 0;
    this.homingPool.forEach((beam) => {
      beam.age += deltaTime;
      if (beam.age >= beam.lifetime) {
        this.homingPool.release(beam);
        return;
      }
      
      const alpha = 1.0 - (beam.age / beam.lifetime);
      this.homingStartAttr.setXYZ(hIdx, beam.start.x, beam.start.y, beam.start.z);
      this.homingControlAttr.setXYZ(hIdx, beam.control.x, beam.control.y, beam.control.z);
      this.homingEndAttr.setXYZ(hIdx, beam.end.x, beam.end.y, beam.end.z);
      this.homingAlphaAttr.setX(hIdx, alpha);
      hIdx++;
    });
    
    // Hide unused homing instances
    for (let i = hIdx; i < 20; i++) {
      this.homingAlphaAttr.setX(i, 0);
    }
    this.homingMesh.count = hIdx;
    this.homingStartAttr.needsUpdate = true;
    this.homingControlAttr.needsUpdate = true;
    this.homingEndAttr.needsUpdate = true;
    this.homingAlphaAttr.needsUpdate = true;
    
    // Separate player bullets by type for rendering
    let vIdx = 0, lIdx = 0;
    this.playerPool.forEach((bullet) => {
      this.dummy.position.copy(bullet.position);
      // Align bullet rotation to match velocity vector
      BulletManager.TEMP_VEC.set(
        bullet.position.x + bullet.velocity.x,
        bullet.position.y + bullet.velocity.y,
        bullet.position.z + bullet.velocity.z
      );
      this.dummy.lookAt(BulletManager.TEMP_VEC);
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
      BulletManager.TEMP_VEC.set(
        bullet.position.x + bullet.velocity.x,
        bullet.position.y + bullet.velocity.y,
        bullet.position.z + bullet.velocity.z
      );
      this.dummy.lookAt(BulletManager.TEMP_VEC);
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
    mesh.count = activeCount;
  }

  /**
   * Draw a homing laser beam connecting two points.
   */
  drawHomingBeam(start: THREE.Vector3, end: THREE.Vector3): void {
    const beam = this.homingPool.acquire();
    if (!beam) return;

    beam.start.copy(start);
    beam.end.copy(end);
    beam.age = 0;

    // Calculate a control point to make the curve flex outward
    const mid = BulletManager.TEMP_VEC.addVectors(start, end).multiplyScalar(0.5);
    const dir = BulletManager.TEMP_VEC_B.subVectors(end, start).normalize();
    const dist = start.distanceTo(end);

    // Perpendicular vector for the bow effect
    const perp = BulletManager.TEMP_VEC_C.set(-dir.z, 0, dir.x).multiplyScalar(dist * 0.4);
    if (Math.random() > 0.5) perp.negate();

    beam.control.copy(mid.add(perp));
  }

  private updatePool(pool: Pool<BulletData>, deltaTime: number): void {
    pool.forEach((bullet) => {
      bullet.position.x += bullet.velocity.x * deltaTime;
      bullet.position.y += bullet.velocity.y * deltaTime;
      bullet.position.z += bullet.velocity.z * deltaTime;
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
    
    this.homingMesh.geometry.dispose();
    (this.homingMesh.material as THREE.Material).dispose();
  }
}

// Deprecated HomingBeamVisual class removed for performance optimization.

