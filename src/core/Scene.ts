import * as THREE from 'three';

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
    // Procedural ground texture — checkerboard pattern for now
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Dark green terrain base
    ctx.fillStyle = '#1a3a1a';
    ctx.fillRect(0, 0, size, size);

    // Grid lines
    ctx.strokeStyle = '#1e4420';
    ctx.lineWidth = 1;
    for (let i = 0; i < size; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }

    // Some random terrain details (small darker patches)
    ctx.fillStyle = '#153015';
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const w = 10 + Math.random() * 30;
      const h = 10 + Math.random() * 30;
      ctx.fillRect(x, y, w, h);
    }

    this.groundTexture = new THREE.CanvasTexture(canvas);
    this.groundTexture.wrapS = THREE.RepeatWrapping;
    this.groundTexture.wrapT = THREE.RepeatWrapping;
    this.groundTexture.repeat.set(4, 4);

    const groundGeom = new THREE.PlaneGeometry(80, 80);
    const groundMat = new THREE.MeshLambertMaterial({
      map: this.groundTexture,
    });
    this.groundPlane = new THREE.Mesh(groundGeom, groundMat);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.position.y = -2;
    this.groundPlane.receiveShadow = true;
    this.scene.add(this.groundPlane);
  }

  private createCloudLayer(): void {
    // Semi-transparent cloud texture
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, size, size);

    // Soft cloud puffs
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 20 + Math.random() * 40;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(200, 210, 230, 0.15)');
      grad.addColorStop(1, 'rgba(200, 210, 230, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    this.cloudTexture = new THREE.CanvasTexture(canvas);
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
   * Update parallax scrolling each frame.
   */
  update(deltaTime: number): void {
    this.groundTexture.offset.y += this.groundSpeed * deltaTime * 0.05;
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
