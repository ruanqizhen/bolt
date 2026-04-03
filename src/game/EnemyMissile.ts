import * as THREE from 'three';
import { Poolable } from '../systems/Pool';
import { GameTimer } from '../systems/GameTimer';
import { ParticleSystem } from '../systems/Particles';

/**
 * EnemyMissile — A homing rocket that tracks the player.
 * Unlike standard bullets, this is a distinct 3D-ish object with health and steering.
 */
export class EnemyMissile implements Poolable {
  public active = false;
  public poolIndex = -1;
  public position = new THREE.Vector3();
  public velocity = new THREE.Vector3();
  public rotation = new THREE.Quaternion();

  public mesh: THREE.Group;
  public bodyMesh: THREE.Mesh;
  public glowMesh: THREE.Mesh;

  public hp = 15;
  public maxHp = 15;
  public damage = 20;

  private speed = 5;
  private turnRate = 2.5; // Radians per second
  private age = 0;
  private readonly MAX_AGE = 8.0;

  constructor() {
    this.mesh = new THREE.Group();

    // 1. Rocket Body (Main cylindrical hull)
    const bodyGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8);
    bodyGeom.rotateX(Math.PI / 2); // Point along Z
    const bodyMat = new THREE.MeshPhongMaterial({
      color: 0xcccc00,
      emissive: 0x332200,
      shininess: 80
    });
    this.bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
    this.mesh.add(this.bodyMesh);

    // 2. Rocket Nose (Red tip - now yellow)
    const noseGeom = new THREE.ConeGeometry(0.08, 0.25, 8);
    noseGeom.rotateX(Math.PI / 2);
    noseGeom.translate(0, 0, 0.3); // Offset to tip
    const noseMat = new THREE.MeshPhongMaterial({ color: 0xbb9900 });
    const noseMesh = new THREE.Mesh(noseGeom, noseMat);
    this.mesh.add(noseMesh);

    // 3. Fins (Small plates at back)
    const finGeom = new THREE.BoxGeometry(0.25, 0.015, 0.15);
    const finMat = new THREE.MeshPhongMaterial({ color: 0x555544 });
    const fins1 = new THREE.Mesh(finGeom, finMat);
    fins1.position.z = -0.2;
    this.mesh.add(fins1);

    const fins2 = fins1.clone();
    fins2.rotation.z = Math.PI / 2;
    this.mesh.add(fins2);

    // 4. Glow Overlay (Layer 1 for bloom)
    const glowGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.6, 6);
    glowGeom.rotateX(Math.PI / 2);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xccaa00,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.glowMesh = new THREE.Mesh(glowGeom, glowMat);
    this.glowMesh.layers.set(1);
    this.mesh.add(this.glowMesh);

    this.mesh.visible = false;
  }

  reset(): void {
    this.active = false;
    this.mesh.visible = false;
    this.hp = this.maxHp;
    this.age = 0;
    this.position.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
  }

  spawn(pos: THREE.Vector3, dir: THREE.Vector3, speed: number, hp: number): void {
    this.active = true;
    this.mesh.visible = true;
    this.position.copy(pos);
    this.speed = speed;
    this.hp = hp;
    this.maxHp = hp;
    this.age = 0;

    // Initial velocity
    this.velocity.copy(dir).normalize().multiplyScalar(this.speed);

    // Initial orientation
    this.updateRotation();
  }

  update(targetPos: THREE.Vector3, particles: ParticleSystem, deltaTime: number): void {
    if (!this.active) return;

    this.age += deltaTime;
    if (this.age > this.MAX_AGE) {
      this.active = false;
      this.mesh.visible = false;
      return;
    }

    // 1. Homing Steering Logic
    const desiredDir = new THREE.Vector3()
      .subVectors(targetPos, this.position)
      .normalize();

    const currentDir = this.velocity.clone().normalize();

    // Smoothly rotate current direction towards desired direction
    const angle = currentDir.angleTo(desiredDir);
    if (angle > 0.01) {
      const maxTurn = this.turnRate * deltaTime;
      const actualTurn = Math.min(angle, maxTurn);

      // Use quaternion slerp for stable rotation of velocity vector
      const q = new THREE.Quaternion().setFromUnitVectors(currentDir, desiredDir);
      const lerpQ = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), q, actualTurn / angle);

      this.velocity.applyQuaternion(lerpQ);
    }

    // Maintain constant speed
    this.velocity.normalize().multiplyScalar(this.speed);

    // 2. Physics step
    this.position.add(this.velocity.clone().multiplyScalar(deltaTime));
    this.mesh.position.copy(this.position);
    this.updateRotation();

    // 3. Thruster Effects
    // Emit flame particles at the back
    const backPos = this.position.clone().add(this.velocity.clone().normalize().multiplyScalar(-0.4));
    particles.emit('thruster', backPos.x, 0.5, backPos.z);

    // Sub-pulse the glow
    this.glowMesh.scale.setScalar(1.0 + Math.sin(this.age * 20) * 0.2);
  }

  private updateRotation(): void {
    const lookAtPos = this.position.clone().add(this.velocity);
    this.mesh.lookAt(lookAtPos);
  }

  takeDamage(amount: number): boolean {
    this.hp -= amount;
    // Visually flash on hit?
    (this.bodyMesh.material as THREE.MeshPhongMaterial).emissive.set(0xffffff);
    GameTimer.getInstance().schedule(0.05, () => {
      if (this.active) (this.bodyMesh.material as THREE.MeshPhongMaterial).emissive.set(0x333333);
    });

    if (this.hp <= 0) {
      this.active = false;
      this.mesh.visible = false;
      return true;
    }
    return false;
  }

  dispose(): void {
    this.bodyMesh.geometry.dispose();
    (this.bodyMesh.material as THREE.Material).dispose();
    this.glowMesh.geometry.dispose();
    (this.glowMesh.material as THREE.Material).dispose();
  }
}
