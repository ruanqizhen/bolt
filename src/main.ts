import { Renderer } from './core/Renderer';
import { Camera } from './core/Camera';
import { GameScene } from './core/Scene';
import { GameLoop } from './core/GameLoop';
import { Input } from './systems/Input';
import * as THREE from 'three';

/**
 * Bolt (雷电) — Main entry point
 * Initializes all core systems and starts the game loop.
 */
class Game {
  private renderer: Renderer;
  private camera: Camera;
  private gameScene: GameScene;
  private gameLoop: GameLoop;
  private input: Input;

  // Debug: player placeholder
  private playerMesh!: THREE.Mesh;

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!canvas) throw new Error('Canvas element #game-canvas not found');

    // Initialize core systems
    this.renderer = new Renderer(canvas);
    this.camera = new Camera();
    this.gameScene = new GameScene();
    this.input = new Input();

    // Create a placeholder player (simple triangle/arrow shape)
    this.createPlayerPlaceholder();

    // Initialize game loop
    this.gameLoop = new GameLoop(
      (dt) => this.update(dt),
      () => this.render()
    );

    // Update HUD
    this.updateHUD();

    // Start the loop
    this.gameLoop.start();

    console.log('[Bolt] Game initialized. Use WASD to move, J to shoot, K for bomb.');
  }

  private createPlayerPlaceholder(): void {
    // Simple fighter jet shape (triangle pointing up)
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.8);      // Nose
    shape.lineTo(-0.5, -0.6);  // Left wing
    shape.lineTo(-0.15, -0.3); // Left indent
    shape.lineTo(0, -0.5);     // Tail
    shape.lineTo(0.15, -0.3);  // Right indent
    shape.lineTo(0.5, -0.6);   // Right wing
    shape.lineTo(0, 0.8);      // Back to nose

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.15,
      bevelEnabled: false,
    });

    const material = new THREE.MeshStandardMaterial({
      color: 0x4488ff,
      metalness: 0.7,
      roughness: 0.3,
      emissive: 0x112244,
      emissiveIntensity: 0.3,
    });

    this.playerMesh = new THREE.Mesh(geometry, material);
    this.playerMesh.rotation.x = -Math.PI / 2; // Lay flat
    this.playerMesh.position.y = 0;
    this.playerMesh.castShadow = true;

    // Add a glowing center hitbox indicator
    const hitboxGeom = new THREE.SphereGeometry(0.1, 16, 16);
    const hitboxMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
    });
    const hitbox = new THREE.Mesh(hitboxGeom, hitboxMat);
    hitbox.position.y = 0.1;
    this.playerMesh.add(hitbox);

    // Add thruster flame (simple cone)
    const thrusterGeom = new THREE.ConeGeometry(0.12, 0.5, 8);
    const thrusterMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.7,
    });
    const thruster = new THREE.Mesh(thrusterGeom, thrusterMat);
    thruster.position.set(0, 0.08, 0.55);
    thruster.rotation.x = Math.PI;
    this.playerMesh.add(thruster);

    this.gameScene.scene.add(this.playerMesh);
  }

  private update(deltaTime: number): void {
    // 1. Update input
    const inputState = this.input.getState();

    // 2. Update player position
    const speed = inputState.slow ? 3 : 6;
    this.playerMesh.position.x += inputState.moveX * speed * deltaTime;
    this.playerMesh.position.z -= inputState.moveY * speed * deltaTime;

    // Mouse/touch drag movement
    const drag = this.input.getDragDelta();
    if (drag) {
      const sensitivity = 0.03;
      this.playerMesh.position.x += drag.dx * sensitivity;
      this.playerMesh.position.z += drag.dy * sensitivity;
    }

    // Clamp to visible bounds
    const bounds = this.camera.getVisibleSize();
    const halfW = bounds.width * 0.45;
    const halfH = bounds.height * 0.45;
    this.playerMesh.position.x = Math.max(-halfW, Math.min(halfW, this.playerMesh.position.x));
    this.playerMesh.position.z = Math.max(-halfH, Math.min(halfH, this.playerMesh.position.z));

    // Slight tilt when moving laterally
    this.playerMesh.rotation.z = -inputState.moveX * 0.3;

    // 3. Shoot feedback (visual pulse on hitbox when shooting)
    if (inputState.shoot) {
      const hitbox = this.playerMesh.children[0] as THREE.Mesh;
      if (hitbox) {
        (hitbox.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(performance.now() * 0.01) * 0.4;
      }
    }

    // 4. Bomb feedback
    if (inputState.bomb) {
      this.gameScene.spawnExplosionLight(this.playerMesh.position.clone(), 0xffaa00, 5);
      console.log('[Bolt] Bomb triggered!');
    }

    // 5. Update scene (parallax scrolling)
    this.gameScene.update(deltaTime);
  }

  private render(): void {
    this.renderer.render(this.gameScene.scene, this.camera.camera);
  }

  private updateHUD(): void {
    const lives = document.getElementById('hud-lives');
    const bombs = document.getElementById('hud-bombs');
    const weapon = document.getElementById('hud-weapon');
    if (lives) lives.textContent = '❤ ❤ ❤';
    if (bombs) bombs.textContent = '💣 ×3';
    if (weapon) weapon.textContent = '🔴 Vulcan Lv.1';
  }
}

// Start the game when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
