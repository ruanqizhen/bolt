import * as THREE from 'three';
import { TextureManager } from '../systems/TextureManager';
import { ProceduralBackgroundGenerator } from './ProceduralBackgroundGenerator';

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
  private cloudTexture: THREE.Texture | null = null;

  // Starfield
  private starfield!: THREE.Points;

  // Procedural background (forests and lakes)
  private bgGenerator: ProceduralBackgroundGenerator | null = null;

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
    this.scene.background = new THREE.Color(0x050510);
    this.scene.fog = new THREE.FogExp2(0x050510, 0.015);

    this.setupLighting();
    this.createStarfield();
    this.createGroundLayer();
    this.createCloudLayer();

    // Initialize procedural background for land environment
    this.bgGenerator = new ProceduralBackgroundGenerator(this.scene);
  }

  private setupLighting(): void {
    // Ambient base
    this.ambientLight = new THREE.AmbientLight(0x445588, 0.8);
    this.scene.add(this.ambientLight);

    // Directional sun light with shadows
    this.sunLight = new THREE.DirectionalLight(0xffeedd, 1.5);
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

    // Rim light for dramatic effect
    const rimLight = new THREE.DirectionalLight(0x6688ff, 0.5);
    rimLight.position.set(-10, 5, -10);
    this.scene.add(rimLight);
  }

  private createStarfield(): void {
    // Create 2000 stars
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 2000;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 2] = -50 - Math.random() * 50;

      // Vary star colors slightly (white to blue to yellow)
      const colorChoice = Math.random();
      if (colorChoice < 0.6) {
        // White
        colors[i * 3] = 1;
        colors[i * 3 + 1] = 1;
        colors[i * 3 + 2] = 1;
      } else if (colorChoice < 0.8) {
        // Blue
        colors[i * 3] = 0.7;
        colors[i * 3 + 1] = 0.8;
        colors[i * 3 + 2] = 1;
      } else {
        // Yellow
        colors[i * 3] = 1;
        colors[i * 3 + 1] = 0.9;
        colors[i * 3 + 2] = 0.7;
      }

      sizes[i] = Math.random() * 2 + 0.5;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const starMaterial = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.starfield = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(this.starfield);
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
      // Hide procedural background for ocean
      if (this.bgGenerator) {
        this.bgGenerator.dispose();
        this.bgGenerator = null;
      }
    } else {
      this.groundPlane.material = this.groundMat;
      // Create procedural background for land (regenerate for new random layout)
      if (!this.bgGenerator) {
        this.bgGenerator = new ProceduralBackgroundGenerator(this.scene);
      }
    }
  }

  private createCloudLayer(): void {
    // Temporarily disabled
    return;

    // Create procedural cloud texture using canvas (disabled)
    /*
    const cloudCanvas = document.createElement('canvas');
    cloudCanvas.width = 512;
    cloudCanvas.height = 512;
    const cloudCtx = cloudCanvas.getContext('2d')!;

    // Clear with transparent
    cloudCtx.clearRect(0, 0, 512, 512);

    // Generate random cloud shapes
    const cloudGroups = 8 + Math.floor(Math.random() * 6);

    for (let i = 0; i < cloudGroups; i++) {
      const cx = Math.random() * 512;
      const cy = Math.random() * 512;
      const cloudSize = 40 + Math.random() * 60;

      // Draw multiple overlapping circles for fluffy cloud effect
      const circleCount = 5 + Math.floor(Math.random() * 5);

      for (let j = 0; j < circleCount; j++) {
        const angle = (j / circleCount) * Math.PI * 2;
        const dist = Math.random() * cloudSize * 0.5;
        const ox = cx + Math.cos(angle) * dist;
        const oy = cy + Math.sin(angle) * dist;
        const radius = cloudSize * (0.4 + Math.random() * 0.3);

        // Gradient for soft cloud edges
        const gradient = cloudCtx.createRadialGradient(ox, oy, 0, ox, oy, radius);
        const alpha = 0.15 + Math.random() * 0.2;
        gradient.addColorStop(0, `rgba(200, 220, 255, ${alpha})`);
        gradient.addColorStop(0.5, `rgba(180, 200, 240, ${alpha * 0.5})`);
        gradient.addColorStop(1, 'rgba(150, 180, 220, 0)');

        cloudCtx.fillStyle = gradient;
        cloudCtx.beginPath();
        cloudCtx.arc(ox, oy, radius, 0, Math.PI * 2);
        cloudCtx.fill();
      }
    }

    this.cloudTexture = new THREE.CanvasTexture(cloudCanvas);
    this.cloudTexture!.wrapS = THREE.RepeatWrapping;
    this.cloudTexture!.wrapT = THREE.RepeatWrapping;
    this.cloudTexture!.repeat.set(2, 2);

    const cloudGeom = new THREE.PlaneGeometry(80, 80);
    const cloudMat = new THREE.MeshBasicMaterial({
      map: this.cloudTexture!,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.cloudPlane = new THREE.Mesh(cloudGeom, cloudMat);
    this.cloudPlane.rotation.x = -Math.PI / 2;
    this.cloudPlane.position.y = 8;
    this.scene.add(this.cloudPlane);
    */
  }

  /**
   * Update parallax scrolling and shaders each frame.
   */
  update(deltaTime: number): void {
    this.time += deltaTime;

    if (this.currentEnv === 'land') {
      this.groundTexture.offset.y += this.groundSpeed * deltaTime * 0.05;

      // Update procedural background (forests and lakes) with same scroll
      if (this.bgGenerator) {
        this.bgGenerator.update(deltaTime, this.groundSpeed);
      }
    } else {
      this.oceanMat.uniforms.uTime.value = this.time;
    }

    // Cloud scrolling disabled
    // if (this.cloudTexture) {
    //   this.cloudTexture.offset.y += this.cloudSpeed * deltaTime * 0.05;
    // }

    // Twinkle stars
    if (this.starfield) {
      this.starfield.rotation.z += 0.0001;
    }
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
    if (this.cloudTexture) {
      this.cloudTexture.dispose();
    }
    if (this.bgGenerator) {
      this.bgGenerator.dispose();
      this.bgGenerator = null;
    }
    this.scene.clear();
  }
}
