import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

/**
 * Vignette + Chromatic Aberration combo shader
 */
const VignetteChromaticShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignetteStrength: { value: 0.15 },
    uChromaticStrength: { value: 0.0 },
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
    uniform float uVignetteStrength;
    uniform float uChromaticStrength;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;

      // Chromatic aberration
      vec2 dir = uv - vec2(0.5);
      float dist = length(dir);
      vec2 offset = dir * dist * uChromaticStrength;

      float r = texture2D(tDiffuse, uv + offset).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - offset).b;
      float a = texture2D(tDiffuse, uv).a;

      vec3 color = vec3(r, g, b);

      // Vignette
      float vignette = 1.0 - smoothstep(0.4, 1.0, dist * 1.4);
      color *= mix(1.0, vignette, uVignetteStrength);

      gl_FragColor = vec4(color, a);
    }
  `,
};

/**
 * PostProcessor — Manages post-processing effects (Bloom, FXAA, Vignette, Chromatic Aberration)
 */
export class PostProcessor {
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private renderPass: RenderPass;
  private fxaaPass: ShaderPass;
  private vignettePass: ShaderPass;
  private chromaticTimer = 0;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number
  ) {
    this.composer = new EffectComposer(renderer);

    // Render pass
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // Bloom pass
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      1.5,  // strength
      0.4,  // radius
      0.85  // threshold
    );
    this.composer.addPass(this.bloomPass);

    // FXAA anti-aliasing
    this.fxaaPass = new ShaderPass(FXAAShader);
    const pixelRatio = renderer.getPixelRatio();
    this.fxaaPass.material.uniforms['resolution'].value.set(
      1 / (width * pixelRatio),
      1 / (height * pixelRatio)
    );
    this.composer.addPass(this.fxaaPass);

    // Vignette + Chromatic Aberration
    this.vignettePass = new ShaderPass(VignetteChromaticShader);
    this.composer.addPass(this.vignettePass);
  }

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
   * Trigger chromatic aberration effect (e.g., on bomb or boss death).
   */
  triggerChromaticAberration(duration = 0.3): void {
    this.chromaticTimer = duration;
  }

  resize(width: number, height: number): void {
    this.composer.setSize(width, height);
    const pixelRatio = this.fxaaPass.material.uniforms['resolution'] ? 1 : 1;
    this.fxaaPass.material.uniforms['resolution'].value.set(
      1 / (width * pixelRatio),
      1 / (height * pixelRatio)
    );
  }

  /**
   * Update time-based effects (call every frame).
   */
  update(deltaTime: number): void {
    if (this.chromaticTimer > 0) {
      this.chromaticTimer -= deltaTime;
      const t = Math.max(0, this.chromaticTimer);
      this.vignettePass.uniforms['uChromaticStrength'].value = t * 0.08;
    } else {
      this.vignettePass.uniforms['uChromaticStrength'].value = 0;
    }
  }

  render(): void {
    this.composer.render();
  }

  renderBasic(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer): void {
    renderer.render(scene, camera);
  }

  dispose(): void {
    this.bloomPass.dispose();
    this.composer.dispose();
  }
}

