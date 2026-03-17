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
  /** Visual type index (for color/size selection) */
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

  // InstancedMesh for rendering
  private playerBulletMesh: THREE.InstancedMesh;
  private enemyBulletMesh: THREE.InstancedMesh;
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

    // Player bullets — small cyan spheres
    const pGeom = new THREE.SphereGeometry(0.08, 6, 6);
    const pMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa });
    this.playerBulletMesh = new THREE.InstancedMesh(pGeom, pMat, BulletManager.PLAYER_POOL_SIZE);
    this.playerBulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.playerBulletMesh.frustumCulled = false;
    scene.add(this.playerBulletMesh);

    // Enemy bullets — small red/orange spheres
    const eGeom = new THREE.SphereGeometry(0.1, 6, 6);
    const eMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
    this.enemyBulletMesh = new THREE.InstancedMesh(eGeom, eMat, BulletManager.ENEMY_POOL_SIZE);
    this.enemyBulletMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.enemyBulletMesh.frustumCulled = false;
    scene.add(this.enemyBulletMesh);
  }

  /**
   * Spawn a player bullet.
   */
  spawnPlayerBullet(x: number, z: number, vx: number, vz: number, damage = 10): BulletData | null {
    const bullet = this.playerPool.acquire();
    if (!bullet) return null;
    bullet.position.set(x, 0.2, z);
    bullet.velocity.set(vx, 0, vz);
    bullet.damage = damage;
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
    this.updateInstancedMesh(this.playerPool, this.playerBulletMesh);
    this.updateInstancedMesh(this.enemyPool, this.enemyBulletMesh);
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

  private updateInstancedMesh(pool: Pool<BulletData>, mesh: THREE.InstancedMesh): void {
    let index = 0;
    pool.forEach((bullet) => {
      this.dummy.position.copy(bullet.position);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(index, this.dummy.matrix);
      index++;
    });

    // Hide unused instances by scaling to 0
    for (let i = index; i < mesh.count; i++) {
      this.dummy.position.set(0, -100, 0);
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);
    }
    // Reset scale for next frame
    this.dummy.scale.set(1, 1, 1);

    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = Math.max(index, 1);
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
    this.playerBulletMesh.geometry.dispose();
    (this.playerBulletMesh.material as THREE.Material).dispose();
    this.enemyBulletMesh.geometry.dispose();
    (this.enemyBulletMesh.material as THREE.Material).dispose();
  }
}
