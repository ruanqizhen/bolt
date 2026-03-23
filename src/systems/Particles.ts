import * as THREE from 'three';

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

  constructor(scene: THREE.Scene) {
    const geom = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
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
      this.dummy.rotation.set(Math.PI / 2, 0, p.rotation);
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

    this.mesh.count = Math.max(visibleCount, 1);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
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
