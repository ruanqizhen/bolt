import * as THREE from 'three';
import { BulletManager } from './Bullet';
import { MissileManager } from './MissileManager';
import { TextureManager } from '../systems/TextureManager';

/**
 * EnemyConfig — Data-driven enemy definition loaded from JSON.
 */
export interface EnemyConfig {
  id: string;
  tier: string;
  name: string;
  hp: number;
  speed: number;
  score: number;
  attack: {
    type: string;
    cooldown: number;
    bullets: number;
    speed: number;
    angle?: number;
    steer?: number;
    rotSpeed?: number;
    rings?: number;
  };
  ai: string;
  drop: { medal: number; powerup: number; bomb: number };
  size: number;
  color: string;
}

/**
 * Enemy — A single runtime enemy instance.
 */
export class Enemy {
  public config: EnemyConfig;
  public mesh: THREE.Mesh;
  public position: THREE.Vector3;
  public hp: number;
  public alive = true;
  public score: number;

  // AI state
  public aiTimer = 0;
  public aiPhase = 0;
  public spawnTime = 0;
  public patrolTarget: THREE.Vector3 | null = null;
  public sineOffset = 0;
  public startX = 0;

  // Attack state
  public fireTimer: number;
  private rotAngle = 0;

  // Visual enhancements
  private glowMesh: THREE.Mesh | null = null;
  private hitFlashTimer = 0;
  private bobPhase = Math.random() * Math.PI * 2;

  constructor(config: EnemyConfig) {
    this.config = config;
    this.hp = config.hp;
    this.score = config.score;
    this.fireTimer = config.attack.cooldown * (0.5 + Math.random() * 0.5);

    // Create visual mesh — textured plane from PNG
    // Size multiplier for better visibility
    const sizeMultiplier = 1.5;
    const tm = TextureManager.getInstance();
    const geom = new THREE.PlaneGeometry(config.size * 1.6 * sizeMultiplier, config.size * 1.6 * sizeMultiplier);
    const mat = new THREE.MeshBasicMaterial({
      map: tm.getEnemy(config.id),
      color: new THREE.Color(2.8, 2.8, 2.8), // Boost base texture brightness (No bloom, just brighter image)
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
      opacity: 1.0,
    });
    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.1;
    this.position = this.mesh.position;
    // Create dedicated glow silhouette on Layer 1
    const glowScale = 1.08;
    const glowGeom = new THREE.PlaneGeometry(
      config.size * 1.6 * sizeMultiplier * glowScale,
      config.size * 1.6 * sizeMultiplier * glowScale
    );
    const color = parseInt(config.color.replace('0x', ''), 16);
    const hdrColor = new THREE.Color(color).multiplyScalar(1.2); // Reduced bloom intensity
    const glowMat = new THREE.MeshBasicMaterial({
      map: tm.getEnemy(config.id),
      color: hdrColor,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      alphaTest: 0.05,
    });
    this.glowMesh = new THREE.Mesh(glowGeom, glowMat);
    // Position slightly lower (in local Z, which is world -Y due to parent rotation)
    this.glowMesh.position.z = -0.02;
    // Set ONLY the glow silhouette to Layer 1 for selective bloom
    this.glowMesh.layers.set(1);
    this.mesh.add(this.glowMesh);
  }

  /**
   * Check if enemy is within the visible game area and can fire.
   */
  canFire(): boolean {
    // Enemy must be in the visible area to fire
    // Spawn zone is above z=-10, visible area starts around z=-8
    return this.position.z > -10 && this.position.z < 12;
  }

  /**
   * Check if enemy is in the gameplay area (can be hit by bullets).
   * More lenient than canFire() to allow hitting enemies as they enter.
   */
  isInPlayArea(): boolean {
    // Enemies spawn at z=-15 and move down to z=15+
    // Allow hitting them from spawn until they leave the bottom
    return this.position.z > -18 && this.position.z < 18;
  }

  /**
   * Try to fire at the given target position.
   */
  tryFire(targetPos: THREE.Vector3, bulletManager: BulletManager, missileManager: MissileManager, deltaTime: number): void {
    if (this.config.attack.type === 'none') return;

    // Always update fire timer even if off-screen to pre-warm weapons
    this.fireTimer -= deltaTime;

    // Only fire if enemy is in visible game area
    if (!this.canFire()) return;

    if (this.fireTimer > 0) return;
    this.fireTimer = this.config.attack.cooldown;

    const atk = this.config.attack;
    const dir = new THREE.Vector3().subVectors(targetPos, this.position).normalize();

    switch (atk.type) {
      case 'straight':
        for (let i = 0; i < atk.bullets; i++) {
          const spread = (i - (atk.bullets - 1) / 2) * 0.3;
          bulletManager.spawnEnemyBullet(
            this.position.x + spread, this.position.z,
            dir.x * atk.speed, dir.z * atk.speed
          );
        }
        break;

      case 'burst':
        for (let i = 0; i < atk.bullets; i++) {
          const delay = i * 0.08;
          const bSpeed = atk.speed * (1 - i * 0.05);
          setTimeout(() => {
            if (!this.alive) return;
            bulletManager.spawnEnemyBullet(
              this.position.x, this.position.z,
              dir.x * bSpeed, dir.z * bSpeed
            );
          }, delay * 1000);
        }
        break;

      case 'fan': {
        const halfAngle = THREE.MathUtils.degToRad((atk.angle || 30) / 2);
        for (let i = 0; i < atk.bullets; i++) {
          let angle: number;
          if (atk.bullets === 1) {
            angle = 0;
          } else {
            angle = -halfAngle + (halfAngle * 2 * i) / (atk.bullets - 1);
          }
          const baseAngle = Math.atan2(dir.x, dir.z);
          const finalAngle = baseAngle + angle;
          bulletManager.spawnEnemyBullet(
            this.position.x, this.position.z,
            Math.sin(finalAngle) * atk.speed,
            Math.cos(finalAngle) * atk.speed
          );
        }
        break;
      }

      case 'radial':
        for (let i = 0; i < atk.bullets; i++) {
          const angle = (Math.PI * 2 * i) / atk.bullets;
          bulletManager.spawnEnemyBullet(
            this.position.x, this.position.z,
            Math.sin(angle) * atk.speed,
            Math.cos(angle) * atk.speed
          );
        }
        break;

      case 'rotating':
        this.rotAngle += (atk.rotSpeed || 20) * deltaTime;
        for (let i = 0; i < atk.bullets; i++) {
          const angle = this.rotAngle + (Math.PI * 2 * i) / atk.bullets;
          bulletManager.spawnEnemyBullet(
            this.position.x, this.position.z,
            Math.sin(angle) * atk.speed,
            Math.cos(angle) * atk.speed
          );
        }
        break;

      case 'homing':
        for (let i = 0; i < atk.bullets; i++) {
          const spreadAngle = (i - (atk.bullets - 1) / 2) * 0.4;
          const baseAngle = Math.atan2(dir.x, dir.z) + spreadAngle;
          bulletManager.spawnEnemyBullet(
            this.position.x, this.position.z,
            Math.sin(baseAngle) * atk.speed,
            Math.cos(baseAngle) * atk.speed
          );
        }
        break;

      case 'flower': {
        const rings = atk.rings || 5;
        for (let r = 0; r < rings; r++) {
          const offset = THREE.MathUtils.degToRad(r * 10);
          for (let i = 0; i < atk.bullets; i++) {
            const angle = offset + (Math.PI * 2 * i) / atk.bullets;
            const spd = atk.speed * (0.8 + r * 0.1);
            bulletManager.spawnEnemyBullet(
              this.position.x, this.position.z,
              Math.sin(angle) * spd,
              Math.cos(angle) * spd
            );
          }
        }
        break;
      }

      case 'missile':
        for (let i = 0; i < atk.bullets; i++) {
          // Wider spread for silos and cruisers
          const spreadWidth = atk.bullets > 1 ? 2.5 : 0;
          const spread = (i - (atk.bullets - 1) / 2) * (spreadWidth / Math.max(1, atk.bullets - 1));
          const spawnPos = this.position.clone();
          spawnPos.x += spread;
          
          missileManager.spawnMissile(
            spawnPos,
            dir.clone(),
            atk.speed || 5, // atk.speed for missile is usually 5
            20 // Missile HP
          );
        }
        break;
    }
  }

  /**
   * Take damage, returns true if killed.
   */
  takeDamage(amount: number): boolean {
    this.hp -= amount;
    // Trigger hit flash — set timer and turn mesh white
    this.hitFlashTimer = 0.12;
    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    mat.color.set(0xffffff);

    if (this.hp <= 0) {
      this.alive = false;
      this.mesh.visible = false;
      return true;
    }
    return false;
  }

  /**
   * Update visual effects (call every frame from EnemyAI or Level).
   */
  updateVisuals(deltaTime: number): void {
    // Hit flash decay
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= deltaTime;
      if (this.hitFlashTimer <= 0) {
        // Reset color to boosted texture brightness
        (this.mesh.material as THREE.MeshBasicMaterial).color.setRGB(1.8, 1.8, 1.8);
      }
    }

    // Hover bob — subtle Y oscillation
    this.bobPhase += deltaTime * 3;
    this.mesh.position.y = 0.1 + Math.sin(this.bobPhase) * 0.05;

    // Glow pulse — enhanced for better visibility
    if (this.glowMesh) {
      const glowMat = this.glowMesh.material as THREE.MeshBasicMaterial;
      // Base opacity increased, pulse range increased for more prominent glow
      glowMat.opacity = 0.35 + Math.sin(this.bobPhase * 1.5) * 0.15;
    }
  }

  /**
   * Roll for drops. Returns 'powerup' | 'bomb' | 'medal' | null.
   */
  rollDrop(): 'powerup' | 'bomb' | 'medal' | null {
    const roll = Math.random();
    const { powerup, bomb, medal } = this.config.drop;
    if (roll < powerup) return 'powerup';
    if (roll < powerup + bomb) return 'bomb';
    if (roll < powerup + bomb + medal) return 'medal';
    return null;
  }

  reset(config: EnemyConfig): void {
    this.config = config;
    this.hp = config.hp;
    this.score = config.score;
    this.alive = true;
    this.mesh.visible = true;
    this.fireTimer = config.attack.cooldown * (0.5 + Math.random() * 0.5);
    this.aiTimer = 0;
    this.aiPhase = 0;
    this.sineOffset = Math.random() * Math.PI * 2;
    this.rotAngle = 0;

    // Update texture to match new enemy type
    const tm = TextureManager.getInstance();
    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    mat.map = tm.getEnemy(config.id);
    mat.needsUpdate = true;
    mat.color.setRGB(1.8, 1.8, 1.8); // Maintain boosted brightness for recycled enemies

    // Update glow texture and color
    if (this.glowMesh) {
      const glowMat = this.glowMesh.material as THREE.MeshBasicMaterial;
      glowMat.map = tm.getEnemy(config.id);
      const c = parseInt(config.color.replace('0x', ''), 16);
      glowMat.color.set(c).multiplyScalar(1.5); // Reduced bloom intensity
      glowMat.needsUpdate = true;
    }

    // Scale mesh to enemy size
    const baseSize = 0.4 * 1.6; // default config.size * 1.6
    const scale = (config.size * 1.6) / baseSize;
    this.mesh.scale.set(scale, scale, scale);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
