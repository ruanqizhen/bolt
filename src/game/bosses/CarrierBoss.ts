import * as THREE from 'three';
import { Boss, BossPhase } from '../Boss';
import { BulletManager } from '../Bullet';
import { ParticleSystem } from '../../systems/Particles';
import { GameScene } from '../../core/Scene';

/**
 * CarrierBoss — Level 3 Boss: Giant Aircraft Carrier
 * HP: 3000, with destructible sub-targets (4 AA turrets + 2 missile launchers)
 * Phase 1 (100%-50%): Sub-targets active, radial + fan attacks
 * Phase 2 (50%-0%): Core exposed, flower patterns + sniper barrage
 */
export class CarrierBoss extends Boss {
  private rotAngle = 0;
  private subTargets: { hp: number; alive: boolean; position: THREE.Vector3 }[] = [];

  constructor(bulletManager: BulletManager, particles: ParticleSystem, gameScene: GameScene) {
    super(3000, 50000, -9, bulletManager, particles, gameScene);
    this.createVisuals();
    this.setupPhases();
  }

  private createVisuals(): void {
    // Carrier hull
    const hullGeom = new THREE.BoxGeometry(8, 0.8, 4);
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x445544, metalness: 0.6, roughness: 0.35,
      emissive: 0x112211, emissiveIntensity: 0.2,
    });
    const hull = new THREE.Mesh(hullGeom, hullMat);
    hull.castShadow = true;
    this.mesh.add(hull);

    // Deck
    const deckGeom = new THREE.BoxGeometry(7.5, 0.1, 3.5);
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x556655, metalness: 0.4, roughness: 0.5 });
    const deck = new THREE.Mesh(deckGeom, deckMat);
    deck.position.y = 0.45;
    this.mesh.add(deck);

    // Bridge (command tower)
    const bridgeGeom = new THREE.BoxGeometry(1.2, 1.5, 1.5);
    const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x667766, metalness: 0.5, roughness: 0.3 });
    const bridge = new THREE.Mesh(bridgeGeom, bridgeMat);
    bridge.position.set(2.5, 1.1, 0);
    this.mesh.add(bridge);

    // Sub-targets: 4 AA turrets at corners
    const turretPositions = [
      new THREE.Vector3(-3, 0.6, -1.2),
      new THREE.Vector3(-3, 0.6, 1.2),
      new THREE.Vector3(3, 0.6, -1.2),
      new THREE.Vector3(3, 0.6, 1.2),
    ];
    const turretGeom = new THREE.CylinderGeometry(0.25, 0.3, 0.6, 6);
    const turretMat = new THREE.MeshStandardMaterial({ color: 0x888866 });

    for (const pos of turretPositions) {
      const turret = new THREE.Mesh(turretGeom.clone(), turretMat.clone());
      turret.position.copy(pos);
      this.mesh.add(turret);
      this.subTargets.push({ hp: 200, alive: true, position: pos.clone() });
    }

    // Sub-targets: 2 missile launchers on sides
    const launcherGeom = new THREE.BoxGeometry(0.6, 0.4, 0.6);
    const launcherMat = new THREE.MeshStandardMaterial({ color: 0x996644 });
    const launcherPositions = [
      new THREE.Vector3(-1.5, 0.6, 0),
      new THREE.Vector3(1.5, 0.6, 0),
    ];
    for (const pos of launcherPositions) {
      const launcher = new THREE.Mesh(launcherGeom.clone(), launcherMat.clone());
      launcher.position.copy(pos);
      this.mesh.add(launcher);
      this.subTargets.push({ hp: 300, alive: true, position: pos.clone() });
    }

    // Core (hidden until phase 2)
    const coreGeom = new THREE.SphereGeometry(0.6, 12, 12);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0 });
    const core = new THREE.Mesh(coreGeom, coreMat);
    core.position.set(0, 1, 0);
    core.name = 'core';
    this.mesh.add(core);
  }

  private setupPhases(): void {
    const phase1: BossPhase = {
      hpThreshold: 1.0,
      update: (boss, playerPos, dt) => {
        // Slow drift
        boss.position.x = Math.sin(performance.now() * 0.0002) * 2;

        // AA turrets fire fan patterns
        for (const st of this.subTargets) {
          if (!st.alive) continue;
          const worldPos = new THREE.Vector3().copy(st.position).add(boss.position);
          if (boss.timer(`st_${st.position.x}_${st.position.z}`, 2.0, dt)) {
            this.patterns.spawnFanPattern(worldPos, playerPos, 4, 50, 6);
          }
        }

        // Radial burst from center
        if (boss.timer('radial', 3.0, dt)) {
          this.patterns.spawnRadialBurst(boss.position, 16, 4);
        }
      },
    };

    const phase2: BossPhase = {
      hpThreshold: 0.5,
      onEnter: (boss) => {
        // Destroy remaining sub-targets with explosions
        for (const st of this.subTargets) {
          if (st.alive) {
            st.alive = false;
            const worldPos = new THREE.Vector3().copy(st.position).add(boss.position);
            this.particles.emit('explosion', worldPos.x, 0.5, worldPos.z);
          }
        }
        // Show core
        const core = boss.mesh.getObjectByName('core') as THREE.Mesh;
        if (core) (core.material as THREE.MeshBasicMaterial).opacity = 0.9;

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
