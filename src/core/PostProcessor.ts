import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

/**
 * Brightness/Gamma adjustment shader
 */
const BrightnessShader = {
  uniforms: {
    tDiffuse: { value: null },
    uBrightness: { value: 0.0 },
    uGamma: { value: 1.0 },
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
    uniform float uBrightness;
    uniform float uGamma;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      
      // Apply brightness
      color.rgb += uBrightness;
      
      // Apply gamma correction
      color.rgb = pow(color.rgb, vec3(1.0 / uGamma));
      
      gl_FragColor = color;
    }
  `,
};

/**
 * PostProcessor — Manages post-processing effects (FXAA, Brightness)
 */
export class PostProcessor {
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private fxaaPass: ShaderPass;
  private brightnessPass: ShaderPass;

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

    // Brightness/Gamma adjustment
    this.brightnessPass = new ShaderPass(BrightnessShader);
    this.brightnessPass.uniforms['uBrightness'].value = 0.15; // Slight brightness boost
    this.brightnessPass.uniforms['uGamma'].value = 1.2; // Gamma correction
    this.composer.addPass(this.brightnessPass);

    // FXAA anti-aliasing
    this.fxaaPass = new ShaderPass(FXAAShader);
    const pixelRatio = renderer.getPixelRatio();
    this.fxaaPass.material.uniforms['resolution'].value.set(
      1 / (width * pixelRatio),
      1 / (height * pixelRatio)
    );
    this.composer.addPass(this.fxaaPass);
  }

  setBrightness(brightness: number): void {
    this.brightnessPass.uniforms['uBrightness'].value = brightness;
  }

  setGamma(gamma: number): void {
    this.brightnessPass.uniforms['uGamma'].value = gamma;
  }

  resize(width: number, height: number): void {
    const pixelRatio = this.composer.renderer.getPixelRatio();
    this.composer.setSize(width, height);
    this.fxaaPass.material.uniforms['resolution'].value.set(
      1 / (width * pixelRatio),
      1 / (height * pixelRatio)
    );
  }

  render(): void {
    this.composer.render();
  }

  dispose(): void {
    this.composer.dispose();
  }
}
