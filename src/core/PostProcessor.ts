import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';



/**
 * PostProcessor — Manages post-processing effects (FXAA, Brightness, Bloom)
 * Uses selective bloom: only objects on layer 1 get bloom effect
 */
export class PostProcessor {
  private composer: EffectComposer;
  private bloomComposer: EffectComposer;
  private renderPass: RenderPass;
  private bloomRenderPass: RenderPass;
  private bloomPass: UnrealBloomPass;
  private bloomMixPass: ShaderPass;
  private fxaaPass: ShaderPass;
  private bloomLayer: THREE.Layers;
  private originalLayerMask: THREE.Layers;
  private scene: THREE.Scene;
  private camera: THREE.Camera;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number
  ) {
    this.scene = scene;
    this.camera = camera;
    
    // Enable camera to see both layer 0 (background) and layer 1 (bloom objects)
    this.camera.layers.enable(0);
    this.camera.layers.enable(1);
    this.originalLayerMask = camera.layers;

    // Main composer for final output
    this.composer = new EffectComposer(renderer);

    // Render pass for main scene
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);



    // FXAA anti-aliasing
    this.fxaaPass = new ShaderPass(FXAAShader);
    const pixelRatio = renderer.getPixelRatio();
    this.fxaaPass.material.uniforms['resolution'].value.set(
      1 / (width * pixelRatio),
      1 / (height * pixelRatio)
    );
    this.composer.addPass(this.fxaaPass);

    // === Selective Bloom Setup ===
    // Layer 1 is for bloom objects (player, enemies, bullets)
    this.bloomLayer = new THREE.Layers();
    this.bloomLayer.set(1);

    // Bloom pass configuration - maximum strength for bright bloom
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      2.0,    // strength - maximum bloom intensity
      0.8,    // radius - large bloom spread
      0.05    // low threshold - more objects glow
    );

    // Separate render pass for bloom (only renders layer 1)
    this.bloomRenderPass = new RenderPass(scene, camera);

    // Separate composer for bloom
    this.bloomComposer = new EffectComposer(renderer);
    this.bloomComposer.renderToScreen = false;
    this.bloomComposer.addPass(this.bloomRenderPass);
    this.bloomComposer.addPass(this.bloomPass);

    // Copy bloom to main composer using additive blending
    const MixShader = {
      uniforms: {
        tDiffuse: { value: null }, // Automatically bound to main composer output
        tBloom: { value: null },   // Manually bound to bloom composer output
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D tBloom;
        varying vec2 vUv;
        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          vec4 bloomColor = texture2D(tBloom, vUv);
          // Add bloom color additively directly in shader
          gl_FragColor = color + bloomColor;
        }
      `
    };

    this.bloomMixPass = new ShaderPass(MixShader);
    this.bloomMixPass.renderToScreen = true;
    this.bloomMixPass.material.depthTest = false;
    this.bloomMixPass.material.depthWrite = false;
    this.composer.addPass(this.bloomMixPass);
  }

  /**
   * Set bloom intensity (0 = no bloom, 2 = maximum)
   */
  setBloomStrength(strength: number): void {
    this.bloomPass.strength = THREE.MathUtils.clamp(strength, 0, 2);
  }

  resize(width: number, height: number): void {
    const pixelRatio = this.composer.renderer.getPixelRatio();
    this.composer.setSize(width, height);
    this.fxaaPass.material.uniforms['resolution'].value.set(
      1 / (width * pixelRatio),
      1 / (height * pixelRatio)
    );
    this.bloomComposer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
  }

  render(): void {
    // Save original camera layers
    const originalLayers = this.camera.layers.mask;

    // Step 1: Clear bloom composer buffer
    this.bloomComposer.renderer.clear();

    // Step 2: Render only layer 1 (bloom objects) to bloom buffer
    this.camera.layers.mask = this.bloomLayer.mask;
    this.bloomComposer.render();

    // Step 3: Restore camera layers before main render
    this.camera.layers.mask = originalLayers;

    // Step 4: Set bloom texture for mix pass
    this.bloomMixPass.uniforms['tBloom'].value = this.bloomComposer.readBuffer.texture;

    // Step 5: Render main scene with bloom overlay
    this.composer.render();
  }

  dispose(): void {
    this.composer.dispose();
    this.bloomComposer.dispose();
  }
}
