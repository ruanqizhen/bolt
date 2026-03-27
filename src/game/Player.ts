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
  private shieldMesh!: THREE.Mesh;
  private glowMesh!: THREE.Mesh;
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
      depthTest: true,
    });
    this.bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
    this.bodyMesh.rotation.x = -Math.PI / 2;
    this.bodyMesh.position.y = 0.15;
    this.bodyMesh.renderOrder = 999; // Render player after clouds
    this.mesh.add(this.bodyMesh);

    // Hitbox glow (center point for danmaku games)
    const hitboxGeom = new THREE.SphereGeometry(Player.HITBOX_RADIUS, 16, 16);
    const hitboxMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    this.hitboxMesh = new THREE.Mesh(hitboxGeom, hitboxMat);
    this.hitboxMesh.position.y = 0.15;
    this.mesh.add(this.hitboxMesh);

    // Energy shield (visible when invincible)
    const shieldGeom = new THREE.SphereGeometry(1.5, 32, 32);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.shieldMesh = new THREE.Mesh(shieldGeom, shieldMat);
    this.shieldMesh.position.y = 0.1;
    this.shieldMesh.visible = false;
    this.mesh.add(this.shieldMesh);

    // === Silhouette glow — same ship texture, scaled up, tinted ===
    const glowGeom = new THREE.PlaneGeometry(1.4 * 1.5, 1.8 * 1.5);
    const glowMat = new THREE.MeshBasicMaterial({
      map: tm.get('player/ship.png'),
      color: 0x00ccff,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      alphaTest: 0.05,
    });
    this.glowMesh = new THREE.Mesh(glowGeom, glowMat);
    this.glowMesh.rotation.x = -Math.PI / 2;
    this.glowMesh.position.y = 0.12;
    this.glowMesh.renderOrder = 998;
    this.mesh.add(this.glowMesh);

    // Ground shadow circle
    const shadowGeom = new THREE.CircleGeometry(0.8, 16);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeom, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -0.12;
    this.mesh.add(shadowMesh);

    // Thruster flame (animated) — orange outer
    const thrusterGeom = new THREE.ConeGeometry(0.18, 0.7, 8);
    const thrusterMat = new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.thrusterMesh = new THREE.Mesh(thrusterGeom, thrusterMat);
    this.thrusterMesh.position.set(0, 0.08, 0.6);
    this.thrusterMesh.rotation.x = Math.PI / 2;
    this.mesh.add(this.thrusterMesh);

    // Inner blue core thruster
    const innerThrusterGeom = new THREE.ConeGeometry(0.1, 0.5, 8);
    const innerThrusterMat = new THREE.MeshBasicMaterial({
      color: 0x88ddff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const innerThruster = new THREE.Mesh(innerThrusterGeom, innerThrusterMat);
    innerThruster.position.set(0, 0.08, 0.55);
    innerThruster.rotation.x = Math.PI / 2;
    this.mesh.add(innerThruster);
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

    // --- Invincibility shield ---
    if (this.isInvincible) {
      this.invincibleTimer -= deltaTime;
      this.flashTimer += deltaTime;
      // Shield visible
      this.shieldMesh.visible = true;
      // Pulse shield
      const shieldScale = 1 + Math.sin(this.flashTimer * 10) * 0.1;
      this.shieldMesh.scale.set(shieldScale, shieldScale, shieldScale);
      (this.shieldMesh.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(this.flashTimer * 5) * 0.1;
      // Brighter glow during invincibility
      (this.glowMesh.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(this.flashTimer * 8) * 0.15;
      // Flash body
      this.mesh.visible = Math.sin(this.flashTimer * 20) > 0;
      if (this.invincibleTimer <= 0) {
        this.isInvincible = false;
        this.mesh.visible = true;
        this.shieldMesh.visible = false;
      }
    }

    // --- Thruster animation ---
    const time = performance.now() * 0.001;
    const thrusterScale = 0.7 + Math.sin(time * 30) * 0.3 + Math.sin(time * 45) * 0.2;
    this.thrusterMesh.scale.y = thrusterScale;
    this.thrusterMesh.scale.x = 1 + Math.sin(time * 25) * 0.2;
    this.thrusterMesh.scale.z = 1 + Math.sin(time * 25) * 0.2;
    (this.thrusterMesh.material as THREE.MeshBasicMaterial).opacity = 0.7 + Math.sin(time * 30) * 0.25;

    // --- Aura ring pulse ---
    if (!this.isInvincible) {
      (this.glowMesh.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(time * 3) * 0.1;
    }

    // --- Hitbox pulse when shooting ---
    if (input.shoot) {
      (this.hitboxMesh.material as THREE.MeshBasicMaterial).opacity = 0.6 + Math.sin(time * 20) * 0.3;
    } else {
      (this.hitboxMesh.material as THREE.MeshBasicMaterial).opacity = 0.9;
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
   * Respawn the player at the starting position.
   * Called when player dies but has continues remaining.
   * Does NOT reset lives or bombs - those are preserved.
   */
  respawn(): void {
    this.isAlive = true;
    this.mesh.visible = true;
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
