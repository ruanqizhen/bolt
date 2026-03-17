import * as THREE from 'three';
import { Boss, BossPhase } from '../Boss';
import { BulletManager } from '../Bullet';
import { ParticleSystem } from '../../systems/Particles';
import { GameScene } from '../../core/Scene';

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
    // Main body — large box
    const bodyGeom = new THREE.BoxGeometry(5, 0.8, 3);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x556644,
      metalness: 0.6,
      roughness: 0.3,
      emissive: 0x222211,
      emissiveIntensity: 0.2,
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.castShadow = true;
    this.mesh.add(body);

    // Left turret
    const turretGeom = new THREE.CylinderGeometry(0.4, 0.5, 1.2, 8);
    const turretMat = new THREE.MeshStandardMaterial({
      color: 0x445533,
      metalness: 0.7,
      roughness: 0.3,
    });
    const leftTurret = new THREE.Mesh(turretGeom, turretMat);
    leftTurret.position.set(-1.5, 0.6, 0);
    this.mesh.add(leftTurret);

    // Right turret
    const rightTurret = new THREE.Mesh(turretGeom.clone(), turretMat.clone());
    rightTurret.position.set(1.5, 0.6, 0);
    this.mesh.add(rightTurret);

    // Core (visible in phase 2)
    const coreGeom = new THREE.SphereGeometry(0.5, 12, 12);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xff3300,
      transparent: true,
      opacity: 0,
    });
    const core = new THREE.Mesh(coreGeom, coreMat);
    core.position.set(0, 0.8, 0);
    core.name = 'core';
    this.mesh.add(core);

    // Tank treads (sides)
    const treadGeom = new THREE.BoxGeometry(0.5, 0.5, 3.2);
    const treadMat = new THREE.MeshStandardMaterial({ color: 0x333322 });
    const leftTread = new THREE.Mesh(treadGeom, treadMat);
    leftTread.position.set(-2.7, -0.2, 0);
    this.mesh.add(leftTread);
    const rightTread = new THREE.Mesh(treadGeom.clone(), treadMat.clone());
    rightTread.position.set(2.7, -0.2, 0);
    this.mesh.add(rightTread);
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
        // Show core, indicate enrage
        const core = boss.mesh.getObjectByName('core') as THREE.Mesh;
        if (core) {
          (core.material as THREE.MeshBasicMaterial).opacity = 0.8;
        }
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
