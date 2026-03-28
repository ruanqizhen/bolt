import * as THREE from 'three';

/**
 * Create a circular particle texture programmatically.
 */
function createParticleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  // Create radial gradient
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.8)');
  gradient.addColorStop(0.7, 'rgba(255, 200, 100, 0.4)');
  gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * ParticleSystem — GPU-instanced particle effects for explosions, smoke, sparks, and thruster flames.
 * Enhanced with more particles and better visual effects.
 */

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  color: THREE.Color;
  size: number;
  active: boolean;
  rotation: number;
  rotationSpeed: number;
}

export type ParticlePreset = 'explosion' | 'smoke' | 'spark' | 'thruster' | 'shockwave' | 'debris';

/**
 * Explosion scale tiers for different enemy sizes.
 */
export interface ExplosionConfig {
  particleCount: number;
  speed: number;
  size: number;
  colors: number[];
  shockwaveCount: number;
  debrisCount: number;
  smokeCount: number;
}

/**
 * Explosion tiers based on enemy size.
 */
export const EXPLOSION_TIERS: Record<string, ExplosionConfig> = {
  // Tiny explosion for very small enemies (size < 0.3)
  tiny: {
    particleCount: 30,
    speed: 6,
    size: 0.15,
    colors: [0xffaa00, 0xff6600, 0xffff66],
    shockwaveCount: 0,
    debrisCount: 5,
    smokeCount: 10,
  },
  // Small explosion for scout-tier enemies (size 0.3-0.5)
  small: {
    particleCount: 50,
    speed: 9,
    size: 0.2,
    colors: [0xff6600, 0xff3300, 0xffaa00, 0xffff00],
    shockwaveCount: 0,
    debrisCount: 10,
    smokeCount: 18,
  },
  // Medium explosion for fighter/heavy enemies (size 0.5-0.8)
  medium: {
    particleCount: 80,
    speed: 12,
    size: 0.28,
    colors: [0xff4400, 0xff6600, 0xff8800, 0xffaa00, 0xffff66],
    shockwaveCount: 1,
    debrisCount: 18,
    smokeCount: 28,
  },
  // Large explosion for elite/heavy enemies (size 0.8-1.1)
  large: {
    particleCount: 120,
    speed: 15,
    size: 0.38,
    colors: [0xff2200, 0xff4400, 0xff6600, 0xff8800, 0xffaa00, 0xffffff],
    shockwaveCount: 2,
    debrisCount: 28,
    smokeCount: 40,
  },
  // Massive explosion for giant enemies (size >= 1.1)
  massive: {
    particleCount: 180,
    speed: 18,
    size: 0.5,
    colors: [0xff0000, 0xff2200, 0xff4400, 0xff6600, 0xff8800, 0xffaa00, 0xffffff, 0xffff66],
    shockwaveCount: 3,
    debrisCount: 40,
    smokeCount: 60,
  },
};

const PRESET_CONFIG: Record<ParticlePreset, {
  count: number;
  speed: number;
  life: number;
  size: number;
  colors: number[];
  gravity: number;
  spread: number;
}> = {
  explosion: {
    count: 60,
    speed: 10,
    life: 0.6,
    size: 0.2,
    colors: [0xff6600, 0xff3300, 0xffaa00, 0xff0000, 0xffff00],
    gravity: -2,
    spread: 1.0,
  },
  smoke: {
    count: 25,
    speed: 2,
    life: 1.2,
    size: 0.35,
    colors: [0x666666, 0x555555, 0x777777, 0x444444],
    gravity: 0.5,
    spread: 0.5,
  },
  spark: {
    count: 40,
    speed: 15,
    life: 0.4,
    size: 0.08,
    colors: [0xffffaa, 0xffff66, 0xffffff, 0xffaa00],
    gravity: -5,
    spread: 1.0,
  },
  thruster: {
    count: 12,
    speed: 4,
    life: 0.25,
    size: 0.1,
    colors: [0xff6600, 0x4488ff, 0xffffff, 0x66ccff],
    gravity: 0,
    spread: 0.3,
  },
  shockwave: {
    count: 1,
    speed: 20,
    life: 0.4,
    size: 0.5,
    colors: [0xffffff],
    gravity: 0,
    spread: 1.0,
  },
  debris: {
    count: 15,
    speed: 6,
    life: 1.0,
    size: 0.15,
    colors: [0x886644, 0x665544, 0x554433, 0x776655],
    gravity: -3,
    spread: 0.8,
  },
};

export class ParticleSystem {
  private particles: Particle[] = [];
  private mesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private colorAttr: THREE.InstancedBufferAttribute;
  private static readonly MAX_PARTICLES = 4000;
  private particleTexture: THREE.CanvasTexture;

  constructor(scene: THREE.Scene) {
    this.particleTexture = createParticleTexture();

    const geom = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      map: this.particleTexture,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    });

    this.mesh = new THREE.InstancedMesh(geom, mat, ParticleSystem.MAX_PARTICLES);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    // Per-instance color
    const colors = new Float32Array(ParticleSystem.MAX_PARTICLES * 3);
    this.colorAttr = new THREE.InstancedBufferAttribute(colors, 3);
    this.mesh.instanceColor = this.colorAttr;

    scene.add(this.mesh);

    // Pre-allocate particles
    for (let i = 0; i < ParticleSystem.MAX_PARTICLES; i++) {
      this.particles.push({
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        color: new THREE.Color(),
        size: 0.1,
        active: false,
        rotation: 0,
        rotationSpeed: 0,
      });
    }
  }

  /**
   * Spawn a burst of particles at the given position.
   */
  emit(preset: ParticlePreset, x: number, y: number, z: number): void {
    const config = PRESET_CONFIG[preset];

    for (let i = 0; i < config.count; i++) {
      const p = this.acquireParticle();
      if (!p) break;

      p.position.set(x, y, z);

      // Random direction with spread
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * config.spread;
      const spd = config.speed * (0.5 + Math.random() * 0.5);
      p.velocity.set(
        Math.cos(theta) * Math.cos(phi) * spd,
        Math.sin(phi) * spd * 0.5 + config.gravity,
        Math.sin(theta) * Math.cos(phi) * spd
      );

      p.life = config.life * (0.7 + Math.random() * 0.6);
      p.maxLife = p.life;
      p.size = config.size * (0.8 + Math.random() * 0.4);
      p.color.set(config.colors[Math.floor(Math.random() * config.colors.length)]);
      p.rotation = Math.random() * Math.PI * 2;
      p.rotationSpeed = (Math.random() - 0.5) * 10;
      p.active = true;
    }
  }

  /**
   * Spawn a scaled explosion based on enemy size.
   */
  emitExplosion(tier: 'tiny' | 'small' | 'medium' | 'large' | 'massive', x: number, y: number, z: number): void {
    const config = EXPLOSION_TIERS[tier];
    console.log(`[Particles] emitExplosion: ${tier}, count=${config.particleCount}, pos=(${x},${y},${z})`);

    // Main explosion particles
    let spawned = 0;
    for (let i = 0; i < config.particleCount; i++) {
      const p = this.acquireParticle();
      if (!p) break;
      spawned++;

      p.position.set(x, y, z);

      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;
      const spd = config.speed * (0.5 + Math.random() * 0.5);
      p.velocity.set(
        Math.cos(theta) * Math.cos(phi) * spd,
        Math.sin(phi) * spd * 0.5 + PRESET_CONFIG.explosion.gravity,
        Math.sin(theta) * Math.cos(phi) * spd
      );

      p.life = PRESET_CONFIG.explosion.life * (0.7 + Math.random() * 0.6);
      p.maxLife = p.life;
      p.size = config.size * (0.8 + Math.random() * 0.4);
      p.color.set(config.colors[Math.floor(Math.random() * config.colors.length)]);
      p.rotation = Math.random() * Math.PI * 2;
      p.rotationSpeed = (Math.random() - 0.5) * 10;
      p.active = true;
    }
    console.log(`[Particles] Spawned ${spawned} explosion particles`);

    // Shockwave rings
    for (let s = 0; s < config.shockwaveCount; s++) {
      setTimeout(() => {
        this.emit('shockwave', x, y, z);
      }, s * 80);
    }

    // Debris
    for (let i = 0; i < config.debrisCount; i++) {
      const p = this.acquireParticle();
      if (!p) break;

      p.position.set(x, y + 0.3, z);

      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * 0.8;
      const spd = PRESET_CONFIG.debris.speed * (0.6 + Math.random() * 0.4);
      p.velocity.set(
        Math.cos(theta) * Math.cos(phi) * spd,
        Math.sin(phi) * spd * 0.3 + PRESET_CONFIG.debris.gravity,
        Math.sin(theta) * Math.cos(phi) * spd
      );

      p.life = PRESET_CONFIG.debris.life * (0.8 + Math.random() * 0.4);
      p.maxLife = p.life;
      p.size = PRESET_CONFIG.debris.size * (0.5 + Math.random() * 0.5);
      p.color.set(PRESET_CONFIG.debris.colors[Math.floor(Math.random() * PRESET_CONFIG.debris.colors.length)]);
      p.rotation = Math.random() * Math.PI * 2;
      p.rotationSpeed = (Math.random() - 0.5) * 5;
      p.active = true;
    }

    // Smoke
    for (let i = 0; i < config.smokeCount; i++) {
      const p = this.acquireParticle();
      if (!p) break;

      p.position.set(x, y + 0.2, z);

      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * PRESET_CONFIG.smoke.spread;
      const spd = PRESET_CONFIG.smoke.speed * (0.4 + Math.random() * 0.3);
      p.velocity.set(
        Math.cos(theta) * Math.cos(phi) * spd,
        Math.sin(phi) * spd * 0.5 + PRESET_CONFIG.smoke.gravity,
        Math.sin(theta) * Math.cos(phi) * spd
      );

      p.life = PRESET_CONFIG.smoke.life * (0.7 + Math.random() * 0.5);
      p.maxLife = p.life;
      p.size = PRESET_CONFIG.smoke.size * (0.8 + Math.random() * 0.4);
      p.color.set(PRESET_CONFIG.smoke.colors[Math.floor(Math.random() * PRESET_CONFIG.smoke.colors.length)]);
      p.rotation = Math.random() * Math.PI * 2;
      p.rotationSpeed = (Math.random() - 0.5) * 3;
      p.active = true;
    }
  }

  private acquireParticle(): Particle | null {
    for (const p of this.particles) {
      if (!p.active) return p;
    }
    return null;
  }

  update(deltaTime: number): void {
    let visibleCount = 0;

    for (const p of this.particles) {
      if (!p.active) continue;

      p.position.add(p.velocity.clone().multiplyScalar(deltaTime));
      p.velocity.y += -3 * deltaTime; // Global gravity
      p.life -= deltaTime;
      p.rotation += p.rotationSpeed * deltaTime;

      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      const alpha = p.life / p.maxLife;

      this.dummy.position.copy(p.position);
      // Billboard: face the camera (rotation around Z for top-down view)
      this.dummy.rotation.set(Math.PI / 2, 0, p.rotation);
      this.dummy.lookAt(
        p.position.x,
        p.position.y + 1,
        p.position.z
      );
      this.dummy.scale.set(p.size * alpha, p.size * alpha, p.size * alpha);
      this.dummy.updateMatrix();

      this.mesh.setMatrixAt(visibleCount, this.dummy.matrix);

      // Color with fade
      this.colorAttr.setXYZ(visibleCount, p.color.r * alpha, p.color.g * alpha, p.color.b * alpha);

      visibleCount++;
    }

    // Hide remaining instances
    for (let i = visibleCount; i < this.mesh.count; i++) {
      this.dummy.position.set(0, -200, 0);
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }

    // Only update count if there are visible particles
    if (visibleCount > 0) {
      this.mesh.count = visibleCount;
      this.mesh.instanceMatrix.needsUpdate = true;
      this.colorAttr.needsUpdate = true;
    } else {
      this.mesh.count = 0;
    }
  }

  /**
   * Clear all active particles.
   */
  clear(): void {
    for (const p of this.particles) {
      p.active = false;
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
