import * as THREE from 'three';
import { InputState, Input } from '../systems/Input';
import { Camera } from '../core/Camera';
import { TextureManager } from '../systems/TextureManager';

/**
 * Player — The player's fighter jet entity.
 * Handles movement, health, invincibility, and visual representation.
 */
export class Player {
  public mesh: THREE.Group;
  public position: THREE.Vector3;

  // Stats
  public lives = 3;
  public bombs = 3;
  public score = 0;

  // State
  public isAlive = true;
  public isInvincible = false;
  private invincibleTimer = 0;
  private static readonly INVINCIBLE_DURATION = 2.0; // seconds

  // Movement
  private static readonly NORMAL_SPEED = 6;
  private static readonly SLOW_SPEED = 3;

  // Hitbox
  public static readonly HITBOX_RADIUS = 0.1;
  public static readonly BODY_RADIUS = 1.2;

  // Visual components
  private bodyMesh!: THREE.Mesh;
  private hitboxMesh!: THREE.Mesh;
  private thrusterMesh!: THREE.Mesh;
  private flashTimer = 0;

  constructor() {
    this.mesh = new THREE.Group();
    this.position = this.mesh.position;
    this.createVisuals();
  }

  private createVisuals(): void {
    const tm = TextureManager.getInstance();

    // Textured plane for player ship sprite
    const bodyGeom = new THREE.PlaneGeometry(1.4, 1.8);
    const bodyMat = new THREE.MeshBasicMaterial({
      map: tm.get('player/ship.png'),
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
    });
    this.bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
    this.bodyMesh.rotation.x = -Math.PI / 2;
    this.bodyMesh.position.y = 0.15;
    this.mesh.add(this.bodyMesh);

    // Hitbox glow
    const hitboxGeom = new THREE.SphereGeometry(Player.HITBOX_RADIUS, 16, 16);
    const hitboxMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
    });
    this.hitboxMesh = new THREE.Mesh(hitboxGeom, hitboxMat);
    this.hitboxMesh.position.y = 0.15;
    this.mesh.add(this.hitboxMesh);

    // Thruster flame
    const thrusterGeom = new THREE.ConeGeometry(0.12, 0.5, 8);
    const thrusterMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.7,
    });
    this.thrusterMesh = new THREE.Mesh(thrusterGeom, thrusterMat);
    this.thrusterMesh.position.set(0, 0.08, 0.55);
    this.thrusterMesh.rotation.x = Math.PI / 2;
    this.mesh.add(this.thrusterMesh);
  }

  update(deltaTime: number, input: InputState, dragDelta: { dx: number; dy: number } | null, camera: Camera): void {
    if (!this.isAlive) return;

    // --- Movement ---
    const speed = input.slow ? Player.SLOW_SPEED : Player.NORMAL_SPEED;
    this.position.x += input.moveX * speed * deltaTime;
    this.position.z -= input.moveY * speed * deltaTime;

    // Mouse/touch drag
    if (dragDelta) {
      const sensitivity = 0.03;
      this.position.x += dragDelta.dx * sensitivity;
      this.position.z += dragDelta.dy * sensitivity;
    }

    // Clamp to bounds
    const bounds = camera.getVisibleSize();
    const halfW = bounds.width * 0.45;
    const halfH = bounds.height * 0.45;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -halfW, halfW);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -halfH, halfH);

    // Tilt when moving laterally
    this.bodyMesh.rotation.z = -input.moveX * 0.3;

    // --- Invincibility ---
    if (this.isInvincible) {
      this.invincibleTimer -= deltaTime;
      this.flashTimer += deltaTime;
      // Flash effect
      this.mesh.visible = Math.sin(this.flashTimer * 20) > 0;
      if (this.invincibleTimer <= 0) {
        this.isInvincible = false;
        this.mesh.visible = true;
      }
    }

    // --- Thruster animation ---
    const thrusterScale = 0.8 + Math.sin(performance.now() * 0.015) * 0.3;
    this.thrusterMesh.scale.y = thrusterScale;
    (this.thrusterMesh.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(performance.now() * 0.02) * 0.3;

    // --- Hitbox pulse when shooting ---
    if (input.shoot) {
      (this.hitboxMesh.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(performance.now() * 0.01) * 0.4;
    } else {
      (this.hitboxMesh.material as THREE.MeshBasicMaterial).opacity = 0.8;
    }
  }

  /**
   * Called when the player is hit by an enemy or bullet.
   */
  hit(): void {
    if (this.isInvincible || !this.isAlive) return;

    this.lives--;
    if (this.lives <= 0) {
      this.die();
    } else {
      // Start invincibility
      this.isInvincible = true;
      this.invincibleTimer = Player.INVINCIBLE_DURATION;
      this.flashTimer = 0;
    }
  }

  private die(): void {
    this.isAlive = false;
    this.mesh.visible = false;
  }

  /**
   * Respawn the player (e.g., after Game Over → Continue).
   */
  respawn(): void {
    this.isAlive = true;
    this.mesh.visible = true;
    this.lives = 3;
    this.bombs = 3;
    this.isInvincible = true;
    this.invincibleTimer = Player.INVINCIBLE_DURATION;
    this.flashTimer = 0;
    this.position.set(0, 0, 5);
  }

  dispose(): void {
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
  }
}
