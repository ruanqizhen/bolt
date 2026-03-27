import * as THREE from 'three';
import { Boss, BossPhase } from '../Boss';
import { BulletManager } from '../Bullet';
import { ParticleSystem } from '../../systems/Particles';
import { GameScene } from '../../core/Scene';
import { TextureManager } from '../../systems/TextureManager';

/**
 * CarrierBoss — Level 3 Boss: Giant Aircraft Carrier
 * HP: 3000, with destructible sub-targets (4 AA turrets + 2 missile launchers)
 * Phase 1 (100%-50%): Sub-targets active, radial + fan attacks
 * Phase 2 (50%-0%): Core exposed, flower patterns + sniper barrage
 */
export class CarrierBoss extends Boss {
  private rotAngle = 0;

  constructor(bulletManager: BulletManager, particles: ParticleSystem, gameScene: GameScene) {
    super(3000, 50000, -9, bulletManager, particles, gameScene);
    this.createVisuals();
    this.setupPhases();
  }

  private createVisuals(): void {
    const tm = TextureManager.getInstance();
    
    // Main body — textured plane
    const bodyGeom = new THREE.PlaneGeometry(8, 4);
    const bodyMat = new THREE.MeshBasicMaterial({
      map: tm.getBoss('carrier_boss'),
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.rotation.x = -Math.PI / 2;
    body.position.y = 0.1;
    body.layers.set(1); // Enable bloom for boss
    this.mesh.add(body);
  }

  private setupPhases(): void {
    const phase1: BossPhase = {
      hpThreshold: 1.0,
      update: (boss, playerPos, dt) => {
        // Slow drift
        boss.position.x = Math.sin(performance.now() * 0.0002) * 2;

        // Radial burst from center
        if (boss.timer('radial', 3.0, dt)) {
          this.patterns.spawnRadialBurst(boss.position, 16, 4);
        }

        // Fan patterns from sides
        if (boss.timer('fan', 2.0, dt)) {
          const leftPos = new THREE.Vector3(boss.position.x - 3, 0, boss.position.z);
          const rightPos = new THREE.Vector3(boss.position.x + 3, 0, boss.position.z);
          this.patterns.spawnFanPattern(leftPos, playerPos, 4, 50, 6);
          this.patterns.spawnFanPattern(rightPos, playerPos, 4, 50, 6);
        }
      },
    };

    const phase2: BossPhase = {
      hpThreshold: 0.5,
      onEnter: (boss) => {
        this.particles.emit('explosion', boss.position.x, 1, boss.position.z);
      },
      update: (boss, playerPos, dt) => {
        boss.position.x = Math.sin(performance.now() * 0.0006) * 3;

        // Flower patterns
        if (boss.timer('flower', 4.0, dt)) {
          this.patterns.spawnFlowerPattern(boss.position, 4, 12, 4, 15);
        }

        // Sniper barrage
        this.rotAngle += 20 * dt * THREE.MathUtils.DEG2RAD;
        if (boss.timer('sniper', 0.8, dt)) {
          this.patterns.spawnSniperShot(boss.position, playerPos, 14);
          // Side shots
          const left = new THREE.Vector3(boss.position.x - 3, 0, boss.position.z);
          const right = new THREE.Vector3(boss.position.x + 3, 0, boss.position.z);
          this.patterns.spawnSniperShot(left, playerPos, 10);
          this.patterns.spawnSniperShot(right, playerPos, 10);
        }

        // Rotating ring
        if (boss.timer('ring', 1.0, dt)) {
          this.patterns.spawnRotatingRing(boss.position, 20, 4, this.rotAngle);
        }
      },
    };

    this.phases = [phase1, phase2];
  }
}
