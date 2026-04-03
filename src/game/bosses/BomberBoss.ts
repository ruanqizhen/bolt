import * as THREE from 'three';
import { Boss, BossPhase } from '../Boss';
import { BulletManager } from '../Bullet';
import { ParticleSystem } from '../../systems/Particles';
import { GameScene } from '../../core/Scene';
import { TextureManager } from '../../systems/TextureManager';

/**
 * BomberBoss — Level 2 Boss: Giant Transforming Bomber
 * HP: 4000, transforms between bomber and assault modes
 * Phase 1 (100%-60%): Bomber mode — carpet bombs + homing missiles
 * Phase 2 (60%-25%): Assault mode — rapid fan + rotating ring
 * Phase 3 (25%-0%): Berserk — all attacks combined
 */
export class BomberBoss extends Boss {
  private rotAngle = 0;
  private carpetBombX = -4;
  private carpetDir = 1;

  constructor(bulletManager: BulletManager, particles: ParticleSystem, gameScene: GameScene) {
    super(4000, 20000, -8, bulletManager, particles, gameScene);
    this.createVisuals();
    this.setupPhases();
  }

  private createVisuals(): void {
    const tm = TextureManager.getInstance();
    
    // Main body — textured plane
    const bodyGeom = new THREE.PlaneGeometry(6, 2.5);
    const bodyMat = new THREE.MeshBasicMaterial({
      map: tm.getBoss('bomber_boss'),
      color: new THREE.Color(2.8, 2.8, 2.8),
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.rotation.x = -Math.PI / 2;
    body.position.y = 0.1;
    this.mesh.add(body);

    const glowGeom = new THREE.PlaneGeometry(6 * 1.08, 2.5 * 1.08);
    const glowMat = new THREE.MeshBasicMaterial({
      map: tm.getBoss('bomber_boss'),
      color: new THREE.Color(0xff2222).multiplyScalar(1.2), // Red glow
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      alphaTest: 0.05,
    });
    const glowMesh = new THREE.Mesh(glowGeom, glowMat);
    glowMesh.position.z = -0.02; // Downward in world space
    glowMesh.layers.set(1);
    body.add(glowMesh);
  }

  private setupPhases(): void {
    const phase1: BossPhase = {
      hpThreshold: 1.0,
      update: (boss, playerPos, dt) => {
        // Slow sweep left-right
        boss.position.x = Math.sin(performance.now() * 0.0003) * 4;

        // Carpet bombs: streams of bullets from bottom
        if (boss.timer('carpet', 0.3, dt)) {
          this.carpetBombX += this.carpetDir * 0.8;
          if (this.carpetBombX > 4 || this.carpetBombX < -4) this.carpetDir *= -1;
          this.patterns.spawnSniperShot(
            new THREE.Vector3(this.carpetBombX, 0, boss.position.z),
            new THREE.Vector3(this.carpetBombX + (Math.random() - 0.5), 0, 20),
            6
          );
        }

        // Homing missiles from engines
        if (boss.timer('homing', 2.5, dt)) {
          const leftPos = new THREE.Vector3(boss.position.x - 2.5, 0, boss.position.z);
          const rightPos = new THREE.Vector3(boss.position.x + 2.5, 0, boss.position.z);
          this.patterns.spawnFanPattern(leftPos, playerPos, 3, 40, 5);
          this.patterns.spawnFanPattern(rightPos, playerPos, 3, 40, 5);
        }
      },
    };

    const phase2: BossPhase = {
      hpThreshold: 0.6,
      onEnter: (boss) => {
        this.particles.emit('explosion', boss.position.x, 1, boss.position.z);
        this.particles.emit('explosion', boss.position.x - 2, 0.5, boss.position.z);
        this.particles.emit('explosion', boss.position.x + 2, 0.5, boss.position.z);
      },
      update: (boss, playerPos, dt) => {
        // More aggressive movement
        boss.position.x = Math.sin(performance.now() * 0.0008) * 5;

        // Rapid fan attack
        if (boss.timer('fan', 1.5, dt)) {
          this.patterns.spawnFanPattern(boss.position, playerPos, 9, 90, 7);
        }

        // Rotating ring
        this.rotAngle += 30 * dt * THREE.MathUtils.DEG2RAD;
        if (boss.timer('ring', 0.6, dt)) {
          this.patterns.spawnRotatingRing(boss.position, 12, 4.5, this.rotAngle);
        }
      },
    };

    const phase3: BossPhase = {
      hpThreshold: 0.25,
      onEnter: (boss) => {
        for (let i = 0; i < 5; i++) {
          const ox = (Math.random() - 0.5) * 6;
          this.particles.emit('explosion', boss.position.x + ox, 0.5, boss.position.z);
        }
      },
      update: (boss, playerPos, dt) => {
        boss.position.x = Math.sin(performance.now() * 0.001) * 4;

        // Everything combined
        if (boss.timer('carpet2', 0.2, dt)) {
          this.carpetBombX += this.carpetDir * 1.0;
          if (this.carpetBombX > 5 || this.carpetBombX < -5) this.carpetDir *= -1;
          this.patterns.spawnSniperShot(
            new THREE.Vector3(this.carpetBombX, 0, boss.position.z),
            new THREE.Vector3(this.carpetBombX, 0, 20), 8
          );
        }
        if (boss.timer('fan2', 1.2, dt)) {
          this.patterns.spawnFanPattern(boss.position, playerPos, 11, 100, 8);
        }
        this.rotAngle += 45 * dt * THREE.MathUtils.DEG2RAD;
        if (boss.timer('ring2', 0.5, dt)) {
          this.patterns.spawnRotatingRing(boss.position, 16, 5, this.rotAngle);
        }
      },
    };

    this.phases = [phase1, phase2, phase3];
  }
}
