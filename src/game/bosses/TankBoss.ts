import * as THREE from 'three';
import { Boss, BossPhase } from '../Boss';
import { BulletManager } from '../Bullet';
import { ParticleSystem } from '../../systems/Particles';
import { GameScene } from '../../core/Scene';
import { TextureManager } from '../../systems/TextureManager';

/**
 * TankBoss — Level 1 Boss: Giant Dual-Cannon Tank
 * HP: 1200, 40% screen width
 * Phase 1 (100%-50%): dual fan + rotating ring
 * Phase 2 (50%-0%): sniper shots + wave bullets
 */
export class TankBoss extends Boss {
  private rotAngle = 0;

  constructor(bulletManager: BulletManager, particles: ParticleSystem, gameScene: GameScene) {
    super(1200, 10000, -8, bulletManager, particles, gameScene);
    this.createVisuals();
    this.setupPhases();
  }

  private createVisuals(): void {
    const tm = TextureManager.getInstance();
    
    // Main body — textured plane
    const bodyGeom = new THREE.PlaneGeometry(5, 3);
    const bodyMat = new THREE.MeshBasicMaterial({
      map: tm.getBoss('tank_boss'),
      color: new THREE.Color(2.8, 2.8, 2.8),
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.rotation.x = -Math.PI / 2;
    body.position.y = 0.1;
    this.mesh.add(body);

    const glowGeom = new THREE.PlaneGeometry(5 * 1.08, 3 * 1.08);
    const glowMat = new THREE.MeshBasicMaterial({
      map: tm.getBoss('tank_boss'),
      color: new THREE.Color(0xff6600).multiplyScalar(1.2), // Orange glow
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      alphaTest: 0.05,
    });
    const glowMesh = new THREE.Mesh(glowGeom, glowMat);
    glowMesh.position.z = -0.02; // Downward in world space (due to parent rotation)
    glowMesh.layers.set(1);
    body.add(glowMesh);
  }

  private setupPhases(): void {
    // Phase 1: HP 100%-50%
    const phase1: BossPhase = {
      hpThreshold: 1.0,
      update: (boss, playerPos, dt) => {
        // Dual fan pattern: 60° spread, 2s fire → 1s pause
        if (boss.timer('fan', 3.0, dt)) {
          // Fire from left turret
          const leftPos = new THREE.Vector3(boss.position.x - 1.5, 0, boss.position.z);
          this.patterns.spawnFanPattern(leftPos, playerPos, 5, 60, 6);
          // Fire from right turret
          const rightPos = new THREE.Vector3(boss.position.x + 1.5, 0, boss.position.z);
          this.patterns.spawnFanPattern(rightPos, playerPos, 5, 60, 6);
        }

        // Rotating ring: 16 bullets, 20°/s
        this.rotAngle += THREE.MathUtils.degToRad(20) * dt;
        if (boss.timer('ring', 0.8, dt)) {
          this.patterns.spawnRotatingRing(boss.position, 16, 4, this.rotAngle);
        }

        // Slow horizontal drift
        boss.position.x = Math.sin(performance.now() * 0.0005) * 3;
      },
    };

    // Phase 2: HP 50%-0%
    const phase2: BossPhase = {
      hpThreshold: 0.5,
      onEnter: (boss) => {
        // Enrage effect
        this.particles.emit('explosion', boss.position.x, 1, boss.position.z);
        this.particles.emit('explosion', boss.position.x - 1, 0.5, boss.position.z);
        this.particles.emit('explosion', boss.position.x + 1, 0.5, boss.position.z);
      },
      update: (boss, playerPos, dt) => {
        // High-speed sniper shots
        if (boss.timer('sniper', 1.5, dt)) {
          this.patterns.spawnSniperShot(boss.position, playerPos, 12);
        }

        // Fan patterns from both turrets (more aggressive)
        if (boss.timer('fan2', 2.0, dt)) {
          const leftPos = new THREE.Vector3(boss.position.x - 1.5, 0, boss.position.z);
          this.patterns.spawnFanPattern(leftPos, playerPos, 7, 80, 7);
          const rightPos = new THREE.Vector3(boss.position.x + 1.5, 0, boss.position.z);
          this.patterns.spawnFanPattern(rightPos, playerPos, 7, 80, 7);
        }

        // Radial bursts
        this.rotAngle += THREE.MathUtils.degToRad(45) * dt;
        if (boss.timer('radial', 1.2, dt)) {
          this.patterns.spawnRadialBurst(boss.position, 12, 5, this.rotAngle);
        }

        // More aggressive movement
        boss.position.x = Math.sin(performance.now() * 0.001) * 4;
      },
    };

    this.phases = [phase1, phase2];
  }
}
