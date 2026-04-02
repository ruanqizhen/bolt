import * as THREE from 'three';
import { BulletPatterns } from './BulletPatterns';
import { BulletManager } from './Bullet';
import { ParticleSystem } from '../systems/Particles';
import { GameScene } from '../core/Scene';
import { GameTimer } from '../systems/GameTimer';

/**
 * BossPhase — A single phase of a boss fight.
 */
export interface BossPhase {
  /** HP threshold to enter this phase (percentage 0-1, e.g., 0.5 = 50%) */
  hpThreshold: number;
  /** Called each frame while this phase is active */
  update: (boss: Boss, playerPos: THREE.Vector3, dt: number) => void;
  /** Called once when entering this phase */
  onEnter?: (boss: Boss) => void;
}

/**
 * Boss — Base class for multi-phase boss fights.
 */
export class Boss {
  public mesh: THREE.Group;
  public position: THREE.Vector3;
  public maxHp: number;
  public hp: number;
  public alive = true;
  public active = false; // Set to true after entry animation
  public score: number;

  protected patterns: BulletPatterns;
  protected particles: ParticleSystem;
  protected gameScene: GameScene;

  protected phases: BossPhase[] = [];
  protected currentPhaseIndex = 0;

  // Entry animation
  private entering = true;
  private entryTargetZ: number;

  // Attack timers
  public timers: Map<string, number> = new Map();

  constructor(
    hp: number,
    score: number,
    entryTargetZ: number,
    bulletManager: BulletManager,
    particles: ParticleSystem,
    gameScene: GameScene
  ) {
    this.maxHp = hp;
    this.hp = hp;
    this.score = score;
    this.entryTargetZ = entryTargetZ;
    this.patterns = new BulletPatterns(bulletManager);
    this.particles = particles;
    this.gameScene = gameScene;

    this.mesh = new THREE.Group();
    this.position = this.mesh.position;
    // Start off-screen
    this.position.set(0, 0, -20);
  }

  /**
   * Set a named timer. Returns true when the timer reaches 0.
   */
  timer(name: string, cooldown: number, dt: number): boolean {
    const current = this.timers.get(name) ?? 0;
    const next = current - dt;
    if (next <= 0) {
      this.timers.set(name, cooldown);
      return true;
    }
    this.timers.set(name, next);
    return false;
  }

  update(playerPos: THREE.Vector3, deltaTime: number): void {
    if (!this.alive) return;

    // Entry animation
    if (this.entering) {
      this.position.z += 3 * deltaTime;
      if (this.position.z >= this.entryTargetZ) {
        this.position.z = this.entryTargetZ;
        this.entering = false;
        this.active = true;
        // Trigger phase 0 onEnter
        if (this.phases[0]?.onEnter) {
          this.phases[0].onEnter(this);
        }
      }
      return;
    }

    // Check for phase transitions
    const hpPercent = this.hp / this.maxHp;
    for (let i = this.phases.length - 1; i >= 0; i--) {
      if (hpPercent <= this.phases[i].hpThreshold && i > this.currentPhaseIndex) {
        this.currentPhaseIndex = i;
        if (this.phases[i].onEnter) {
          this.phases[i].onEnter!(this);
        }
        // Visual feedback on phase change
        this.particles.emit('explosion', this.position.x, 0.5, this.position.z);
        this.gameScene.spawnExplosionLight(this.position.clone(), 0xff0000, 5);
        break;
      }
    }

    // Run current phase
    if (this.phases[this.currentPhaseIndex]) {
      this.phases[this.currentPhaseIndex].update(this, playerPos, deltaTime);
    }
  }

  takeDamage(amount: number): boolean {
    this.hp -= amount;

    // Flash
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material as THREE.MeshStandardMaterial;
        if (mat.emissiveIntensity !== undefined) {
          mat.emissiveIntensity = 1.0;
          GameTimer.getInstance().schedule(0.05, () => { mat.emissiveIntensity = 0.2; });
        }
      }
    });

    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  private die(): void {
    this.alive = false;
    this.active = false;

    // Massive explosion sequence (game-loop driven)
    const timer = GameTimer.getInstance();
    timer.scheduleSequence(10, 0.15, () => {
      const ox = (Math.random() - 0.5) * 4;
      const oz = (Math.random() - 0.5) * 4;
      this.particles.emit('explosion', this.position.x + ox, 0.5, this.position.z + oz);
      this.particles.emit('smoke', this.position.x + ox, 0.3, this.position.z + oz);
      this.gameScene.spawnExplosionLight(
        new THREE.Vector3(this.position.x + ox, 0.5, this.position.z + oz),
        0xff6600, 4
      );
    });

    timer.schedule(1.5, () => {
      this.mesh.visible = false;
    });
  }

  /** Get HP as percentage (0-1) */
  getHpPercent(): number {
    return Math.max(0, this.hp / this.maxHp);
  }

  dispose(): void {
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) child.material.dispose();
      }
    });
  }
}
