import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/**
 * PostProcessor — Manages post-processing effects (Bloom, etc.)
 */
export class PostProcessor {
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private renderPass: RenderPass;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number
  ) {
    // Create composer
    this.composer = new EffectComposer(renderer);

    // Render pass
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // Bloom pass - creates the glow effect
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      1.5,  // strength
      0.4,  // radius
      0.85  // threshold
    );
    this.composer.addPass(this.bloomPass);
  }

  /**
   * Update bloom settings
   */
  setBloomStrength(strength: number): void {
    this.bloomPass.strength = strength;
  }

  setBloomRadius(radius: number): void {
    this.bloomPass.radius = radius;
  }

  setBloomThreshold(threshold: number): void {
    this.bloomPass.threshold = threshold;
  }

  /**
   * Resize post-processor
   */
  resize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  /**
   * Render with post-processing
   */
  render(): void {
    this.composer.render();
  }

  /**
   * Render scene without post-processing
   */
  renderBasic(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer): void {
    renderer.render(scene, camera);
  }

  dispose(): void {
    this.bloomPass.dispose();
    this.composer.dispose();
  }
}
