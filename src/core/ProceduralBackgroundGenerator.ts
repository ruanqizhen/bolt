import * as THREE from 'three';

/**
 * ProceduralBackgroundGenerator — Creates random forests and lakes
 * on the ground terrain using shader-based procedural generation.
 */
export class ProceduralBackgroundGenerator {
  private forestTexture!: THREE.CanvasTexture;
  private lakeTexture!: THREE.CanvasTexture;
  private scene: THREE.Scene;
  private forestMesh!: THREE.Mesh;
  private lakeMesh!: THREE.Mesh;
  private time = 0;
  private seed = Math.random() * 1000;
  private scrollOffset = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.generateTextures();
    this.createLakeLayer(); // Create lake first (bottom layer)
    this.createForestLayer(); // Create forest on top
  }

  private generateTextures(): void {
    const size = 512;

    // Generate forest texture using canvas
    const forestCanvas = document.createElement('canvas');
    forestCanvas.width = size;
    forestCanvas.height = size;
    const forestCtx = forestCanvas.getContext('2d')!;

    // Generate lake texture using canvas
    const lakeCanvas = document.createElement('canvas');
    lakeCanvas.width = size;
    lakeCanvas.height = size;
    const lakeCtx = lakeCanvas.getContext('2d')!;

    // Clear with transparent
    forestCtx.clearRect(0, 0, size, size);
    lakeCtx.clearRect(0, 0, size, size);

    // Generate random forest clusters
    this.generateForestClusters(forestCtx, size);

    // Generate random lake shapes
    this.generateLakeShapes(lakeCtx, size);

    // Create textures
    this.forestTexture = new THREE.CanvasTexture(forestCanvas);
    this.forestTexture.wrapS = THREE.RepeatWrapping;
    this.forestTexture.wrapT = THREE.RepeatWrapping;
    this.forestTexture.repeat.set(4, 4); // Match ground texture repeat

    this.lakeTexture = new THREE.CanvasTexture(lakeCanvas);
    this.lakeTexture.wrapS = THREE.RepeatWrapping;
    this.lakeTexture.wrapT = THREE.RepeatWrapping;
    this.lakeTexture.repeat.set(4, 4); // Match ground texture repeat
  }

  private generateForestClusters(ctx: CanvasRenderingContext2D, size: number): void {
    const clusterCount = 15 + Math.floor(Math.random() * 10);

    for (let i = 0; i < clusterCount; i++) {
      const cx = Math.random() * size;
      const cy = Math.random() * size;
      const clusterRadius = 30 + Math.random() * 50;

      // Draw multiple trees in cluster
      const treeCount = 5 + Math.floor(Math.random() * 10);

      for (let j = 0; j < treeCount; j++) {
        const angle = (j / treeCount) * Math.PI * 2;
        const dist = Math.random() * clusterRadius * 0.7;
        const tx = cx + Math.cos(angle) * dist;
        const ty = cy + Math.sin(angle) * dist;

        // Tree size variation
        const treeSize = 8 + Math.random() * 12;

        // Deep forest green colors - very dark with gradient
        const hue = 100 + Math.random() * 40;
        const saturation = 30 + Math.random() * 15;
        const centerLightness = 6 + Math.random() * 6; // Very dark center: 6-12%
        const edgeLightness = centerLightness + 8 + Math.random() * 6; // Lighter edge: +8-14%

        // Create gradient for smooth transition from center to edge
        const gradient = ctx.createRadialGradient(tx, ty, 0, tx, ty, treeSize);
        gradient.addColorStop(0, `hsl(${hue}, ${Math.max(20, saturation - 10)}%, ${centerLightness}%)`);
        gradient.addColorStop(0.5, `hsl(${hue}, ${saturation}%, ${(centerLightness + edgeLightness) / 2}%)`);
        gradient.addColorStop(1, `hsl(${hue}, ${saturation}%, ${edgeLightness}%)`);

        ctx.fillStyle = gradient;

        // Draw tree as irregular circle/blob
        ctx.beginPath();
        const points = 6 + Math.floor(Math.random() * 4);
        for (let p = 0; p <= points; p++) {
          const pa = (p / points) * Math.PI * 2;
          const pr = treeSize * (0.7 + Math.random() * 0.3);
          const px = tx + Math.cos(pa) * pr;
          const py = ty + Math.sin(pa) * pr;
          if (p === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // Add darker center accent (small, for depth)
        const accentGradient = ctx.createRadialGradient(tx, ty, 0, tx, ty, treeSize * 0.3);
        accentGradient.addColorStop(0, `hsl(${hue}, ${Math.max(15, saturation - 15)}%, ${Math.max(2, centerLightness - 4)}%)`);
        accentGradient.addColorStop(1, `hsla(${hue}, ${saturation}%, ${centerLightness}%, 0)`);
        ctx.fillStyle = accentGradient;
        ctx.beginPath();
        ctx.arc(tx, ty, treeSize * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private generateLakeShapes(ctx: CanvasRenderingContext2D, size: number): void {
    const lakeCount = 3 + Math.floor(Math.random() * 4);

    for (let i = 0; i < lakeCount; i++) {
      const cx = Math.random() * size;
      const cy = Math.random() * size;
      const lakeWidth = 40 + Math.random() * 60;
      const lakeHeight = 20 + Math.random() * 40;

      // Create irregular lake shape - deep dark blue
      // Main lake body: very dark blue
      ctx.fillStyle = 'rgba(15, 35, 65, 0.88)';
      ctx.beginPath();

      const points = 8 + Math.floor(Math.random() * 6);
      for (let p = 0; p <= points; p++) {
        const pa = (p / points) * Math.PI * 2;
        const rX = lakeWidth * (0.6 + Math.random() * 0.4);
        const rY = lakeHeight * (0.6 + Math.random() * 0.4);
        const px = cx + Math.cos(pa) * rX;
        const py = cy + Math.sin(pa) * rY;
        if (p === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();

      // Add slightly lighter inner area for depth variation
      ctx.fillStyle = 'rgba(25, 55, 95, 0.75)';
      ctx.beginPath();
      for (let p = 0; p <= points; p++) {
        const pa = (p / points) * Math.PI * 2;
        const rX = lakeWidth * 0.5 * (0.6 + Math.random() * 0.4);
        const rY = lakeHeight * 0.5 * (0.6 + Math.random() * 0.4);
        const px = cx + Math.cos(pa) * rX;
        const py = cy + Math.sin(pa) * rY;
        if (p === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();

      // Add subtle sparkle highlights (low contrast, blended)
      for (let s = 0; s < 3; s++) {
        const sx = cx + (Math.random() - 0.5) * lakeWidth;
        const sy = cy + (Math.random() - 0.5) * lakeHeight;
        const ss = 2 + Math.random() * 2;

        const gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, ss);
        gradient.addColorStop(0, 'rgba(60, 100, 150, 0.25)');
        gradient.addColorStop(0.5, 'rgba(45, 80, 125, 0.12)');
        gradient.addColorStop(1, 'rgba(30, 60, 100, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(sx, sy, ss, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private createForestLayer(): void {
    const forestGeom = new THREE.PlaneGeometry(80, 80, 32, 32);

    // Vertex displacement for slight 3D effect
    const positions = forestGeom.attributes.position.array;
    const heights = new Float32Array(positions.length / 3);

    for (let i = 0; i < positions.length / 3; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      // Simple noise for height variation
      heights[i] = Math.sin(x * 0.2) * Math.cos(y * 0.2) * 0.5 + Math.random() * 0.3;
    }

    forestGeom.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1));

    const forestMat = new THREE.ShaderMaterial({
      uniforms: {
        uForestTexture: { value: this.forestTexture },
        uTime: { value: 0 },
        uSeed: { value: this.seed },
        uTextureRepeat: { value: 4.0 },
        uTextureOffset: { value: new THREE.Vector2(0, 0) },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        attribute float aHeight;
        uniform float uTime;
        uniform float uSeed;

        void main() {
          vUv = uv;
          vec3 pos = position;
          pos.z += aHeight * 0.5;
          vPosition = pos;
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uForestTexture;
        uniform float uTime;
        uniform float uSeed;
        uniform float uTextureRepeat;
        uniform vec2 uTextureOffset;
        varying vec2 vUv;
        varying vec3 vPosition;

        // Simple noise function
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          vec2 uv = (vUv * uTextureRepeat) + uTextureOffset;
          vec4 forestColor = texture2D(uForestTexture, uv);

          // Darken the base color significantly
          vec3 darkenedColor = forestColor.rgb * 0.35;

          // Subtle wind variation (very small)
          float wind = sin(uTime * 0.5 + vPosition.x * 0.1) * 0.015;

          // Subtle ambient variation
          float variation = hash(floor(uv * 10.0) + uSeed) * 0.04;

          // Apply dark green tint
          vec3 greenTint = vec3(0.015, 0.025, 0.01);
          vec3 finalColor = darkenedColor * (1.0 + greenTint + wind + variation);

          // Darken edges significantly (edges have low alpha, make them much darker)
          float edgeDarken = 0.35 + 0.65 * forestColor.a;
          finalColor *= edgeDarken;

          gl_FragColor = vec4(finalColor, forestColor.a * 0.7);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.forestMesh = new THREE.Mesh(forestGeom, forestMat);
    this.forestMesh.rotation.x = -Math.PI / 2;
    this.forestMesh.position.y = -1.85; // Below lake layer
    this.scene.add(this.forestMesh);
  }

  private createLakeLayer(): void {
    const lakeGeom = new THREE.PlaneGeometry(80, 80, 64, 64);

    const lakeMat = new THREE.ShaderMaterial({
      uniforms: {
        uLakeTexture: { value: this.lakeTexture },
        uTime: { value: 0 },
        uColorDeep: { value: new THREE.Color(0x0f2341) }, // Very dark blue
        uColorShallow: { value: new THREE.Color(0x19375f) }, // Dark blue
        uSparkleColor: { value: new THREE.Color(0x2a4a6a) }, // Subtle dark sparkle
        uTextureRepeat: { value: 4.0 },
        uTextureOffset: { value: new THREE.Vector2(0, 0) },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;

        void main() {
          vUv = uv;
          vec3 pos = position;
          pos.z -= 0.2;
          vPosition = pos;
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uLakeTexture;
        uniform float uTime;
        uniform vec3 uColorDeep;
        uniform vec3 uColorShallow;
        uniform vec3 uSparkleColor;
        uniform float uTextureRepeat;
        uniform vec2 uTextureOffset;
        varying vec2 vUv;
        varying vec3 vPosition;

        void main() {
          vec2 uv = (vUv * uTextureRepeat) + uTextureOffset;
          vec4 lakeMask = texture2D(uLakeTexture, uv);

          if (lakeMask.a < 0.1) discard;

          // Animated sparkle (low contrast, subtle)
          float sparkle = 0.0;
          for (int i = 0; i < 3; i++) {
            float t = uTime * (0.5 + float(i) * 0.3);
            sparkle += sin(vPosition.x * 2.0 + t) * cos(vPosition.y * 1.5 + t * 0.7);
          }
          sparkle = sparkle * 0.3 + 0.35; // Reduced contrast
          sparkle *= lakeMask.a * 0.5; // More subtle

          // Mix deep and shallow based on mask intensity
          float depthMix = lakeMask.r;
          vec3 baseColor = mix(uColorDeep, uColorShallow, depthMix);

          // Add subtle sparkle highlights (low intensity)
          vec3 finalColor = baseColor + uSparkleColor * sparkle * 0.25;

          gl_FragColor = vec4(finalColor, lakeMask.a * 0.85);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.lakeMesh = new THREE.Mesh(lakeGeom, lakeMat);
    this.lakeMesh.rotation.x = -Math.PI / 2;
    this.lakeMesh.position.y = -1.75; // Above forest layer
    this.scene.add(this.lakeMesh);
  }

  update(deltaTime: number, groundScrollSpeed: number = 1.0): void {
    this.time += deltaTime;
    
    // Apply scroll offset to textures (additive, matching ground scroll)
    const scrollAmount = groundScrollSpeed * deltaTime * 0.05;
    
    if (this.forestTexture) {
      this.forestTexture.offset.y += scrollAmount;
      // Also update shader uniform for forest
      if (this.forestMesh) {
        const forestMat = this.forestMesh.material as THREE.ShaderMaterial;
        forestMat.uniforms.uTextureOffset.value.copy(this.forestTexture.offset);
      }
    }
    
    if (this.lakeTexture) {
      this.lakeTexture.offset.y += scrollAmount;
      // Also update shader uniform for lake
      if (this.lakeMesh) {
        const lakeMat = this.lakeMesh.material as THREE.ShaderMaterial;
        lakeMat.uniforms.uTextureOffset.value.copy(this.lakeTexture.offset);
      }
    }

    if (this.forestMesh) {
      (this.forestMesh.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time;
    }

    if (this.lakeMesh) {
      (this.lakeMesh.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time;
    }
  }

  regenerate(): void {
    // Remove old meshes
    if (this.forestMesh) {
      this.scene.remove(this.forestMesh);
      (this.forestMesh.material as THREE.Material).dispose();
      this.forestMesh.geometry.dispose();
    }
    if (this.lakeMesh) {
      this.scene.remove(this.lakeMesh);
      (this.lakeMesh.material as THREE.Material).dispose();
      this.lakeMesh.geometry.dispose();
    }

    // Generate new random textures
    this.seed = Math.random() * 1000;
    this.generateTextures();
    this.createForestLayer();
    this.createLakeLayer();
  }

  dispose(): void {
    if (this.forestMesh) {
      this.scene.remove(this.forestMesh);
      (this.forestMesh.material as THREE.Material).dispose();
      this.forestMesh.geometry.dispose();
    }
    if (this.lakeMesh) {
      this.scene.remove(this.lakeMesh);
      (this.lakeMesh.material as THREE.Material).dispose();
      this.lakeMesh.geometry.dispose();
    }
    this.forestTexture.dispose();
    this.lakeTexture.dispose();
  }
}
