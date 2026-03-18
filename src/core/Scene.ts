import * as THREE from 'three';
import { TextureManager } from '../systems/TextureManager';

/**
 * GameScene — Manages the Three.js scene, multi-layer parallax scrolling,
 * and lighting setup for the 2.5D shooter.
 */
export class GameScene {
  public scene: THREE.Scene;

  // Parallax layers
  private groundPlane!: THREE.Mesh;
  private cloudPlane!: THREE.Mesh;
  private groundTexture!: THREE.Texture;
  private cloudTexture!: THREE.Texture;
  
  // Materials
  private groundMat!: THREE.MeshLambertMaterial;
  private oceanMat!: THREE.ShaderMaterial;
  private currentEnv: 'land' | 'ocean' = 'land';
  private time = 0;

  // Scroll speeds (units/s)
  private groundSpeed = 1.0;
  private cloudSpeed = 0.4;

  // Lighting
  public sunLight!: THREE.DirectionalLight;
  public ambientLight!: THREE.AmbientLight;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);
    this.scene.fog = new THREE.FogExp2(0x0a0a1a, 0.008);

    this.setupLighting();
    this.createGroundLayer();
    this.createCloudLayer();
  }

  private setupLighting(): void {
    // Ambient base
    this.ambientLight = new THREE.AmbientLight(0x334466, 0.6);
    this.scene.add(this.ambientLight);

    // Directional sun light with shadows
    this.sunLight = new THREE.DirectionalLight(0xffeedd, 1.2);
    this.sunLight.position.set(5, 20, 10);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 80;
    this.sunLight.shadow.camera.left = -20;
    this.sunLight.shadow.camera.right = 20;
    this.sunLight.shadow.camera.top = 20;
    this.sunLight.shadow.camera.bottom = -20;
    this.scene.add(this.sunLight);
  }

  private createGroundLayer(): void {
    const tm = TextureManager.getInstance();
    this.groundTexture = tm.get('bg/ground.png');
    this.groundTexture.wrapS = THREE.RepeatWrapping;
    this.groundTexture.wrapT = THREE.RepeatWrapping;
    this.groundTexture.repeat.set(4, 4);

    // Use more segments for vertex displacement
    const groundGeom = new THREE.PlaneGeometry(80, 80, 64, 64);
    
    this.groundMat = new THREE.MeshLambertMaterial({
      map: this.groundTexture,
    });
    
    // Ocean shader material using Gerstner-like waves
    this.oceanMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColorDeep: { value: new THREE.Color(0x0a2a4a) },
        uColorShallow: { value: new THREE.Color(0x1a5a8a) },
        uGridColor: { value: new THREE.Color(0x4aaaff) },
      },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying float vElevation;

        void main() {
          vUv = uv;
          vec4 modelPosition = modelMatrix * vec4(position, 1.0);
          
          // Gerstner-like wave displacement
          float elevation = sin(modelPosition.x * 0.5 + uTime * 1.5) * 0.4
                          + sin(modelPosition.y * 0.8 + uTime * 2.0) * 0.4;
                          
          modelPosition.z += elevation; // z is up due to rotation.x = -PI/2
          vElevation = elevation;
          
          gl_Position = projectionMatrix * viewMatrix * modelPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColorDeep;
        uniform vec3 uColorShallow;
        uniform vec3 uGridColor;
        
        varying vec2 vUv;
        varying float vElevation;

        void main() {
          // Mix colors based on elevation
          float mixStrength = (vElevation + 0.8) * 0.5;
          vec3 color = mix(uColorDeep, uColorShallow, mixStrength);
          
          // Add a subtle tech grid over the ocean
          float gridX = step(0.98, fract(vUv.x * 40.0));
          float gridY = step(0.98, fract(vUv.y * 40.0));
          float grid = max(gridX, gridY);
          
          // Add foam on wave peaks
          float foam = step(0.65, vElevation);
          
          color += uGridColor * grid * 0.3;
          color += vec3(1.0) * foam * 0.5;
          
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      transparent: true,
      opacity: 0.9,
    });

    this.groundPlane = new THREE.Mesh(groundGeom, this.groundMat);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.position.y = -2;
    this.groundPlane.receiveShadow = true;
    this.scene.add(this.groundPlane);
  }

  public setEnvironment(type: 'land' | 'ocean'): void {
    this.currentEnv = type;
    if (type === 'ocean') {
      this.groundPlane.material = this.oceanMat;
    } else {
      this.groundPlane.material = this.groundMat;
    }
  }

  private createCloudLayer(): void {
    const tm = TextureManager.getInstance();
    this.cloudTexture = tm.get('bg/clouds.png');
    this.cloudTexture.wrapS = THREE.RepeatWrapping;
    this.cloudTexture.wrapT = THREE.RepeatWrapping;
    this.cloudTexture.repeat.set(3, 3);

    const cloudGeom = new THREE.PlaneGeometry(80, 80);
    const cloudMat = new THREE.MeshBasicMaterial({
      map: this.cloudTexture,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    this.cloudPlane = new THREE.Mesh(cloudGeom, cloudMat);
    this.cloudPlane.rotation.x = -Math.PI / 2;
    this.cloudPlane.position.y = 8;
    this.scene.add(this.cloudPlane);
  }

  /**
   * Update parallax scrolling and shaders each frame.
   */
  update(deltaTime: number): void {
    this.time += deltaTime;
    
    if (this.currentEnv === 'land') {
      this.groundTexture.offset.y += this.groundSpeed * deltaTime * 0.05;
    } else {
      this.oceanMat.uniforms.uTime.value = this.time;
    }
    
    this.cloudTexture.offset.y += this.cloudSpeed * deltaTime * 0.05;
  }

  /**
   * Create a temporary explosion point light.
   */
  spawnExplosionLight(position: THREE.Vector3, color = 0xff6600, intensity = 3): void {
    const light = new THREE.PointLight(color, intensity, 15);
    light.position.copy(position);
    this.scene.add(light);

    // Fade out over 0.3s
    const startTime = performance.now();
    const decay = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed >= 0.3) {
        this.scene.remove(light);
        light.dispose();
        return;
      }
      light.intensity = intensity * (1 - elapsed / 0.3);
      requestAnimationFrame(decay);
    };
    requestAnimationFrame(decay);
  }

  dispose(): void {
    this.groundTexture.dispose();
    this.cloudTexture.dispose();
    this.scene.clear();
  }
}
