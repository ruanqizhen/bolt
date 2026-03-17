import * as THREE from 'three';
import { BulletManager } from './Bullet';

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

  constructor(config: EnemyConfig) {
    this.config = config;
    this.hp = config.hp;
    this.score = config.score;
    this.fireTimer = config.attack.cooldown * (0.5 + Math.random() * 0.5);

    // Create visual mesh — colored box scaled by tier
    const geom = new THREE.BoxGeometry(config.size, config.size * 0.4, config.size);
    const color = parseInt(config.color.replace('0x', ''), 16);
    const mat = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.5,
      roughness: 0.4,
      emissive: color,
      emissiveIntensity: 0.15,
    });
    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.castShadow = true;
    this.position = this.mesh.position;
  }

  /**
   * Try to fire at the given target position.
   */
  tryFire(targetPos: THREE.Vector3, bulletManager: BulletManager, deltaTime: number): void {
    if (this.config.attack.type === 'none') return;

    this.fireTimer -= deltaTime;
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
    }
  }

  /**
   * Take damage, returns true if killed.
   */
  takeDamage(amount: number): boolean {
    this.hp -= amount;
    // Flash effect
    const mat = this.mesh.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 1.0;
    setTimeout(() => { if (mat) mat.emissiveIntensity = 0.15; }, 80);

    if (this.hp <= 0) {
      this.alive = false;
      this.mesh.visible = false;
      return true;
    }
    return false;
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

    // Update visual
    const color = parseInt(config.color.replace('0x', ''), 16);
    const mat = this.mesh.material as THREE.MeshStandardMaterial;
    mat.color.set(color);
    mat.emissive.set(color);
    mat.emissiveIntensity = 0.15;

    this.mesh.scale.set(config.size / 0.8, 1, config.size / 0.8);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
