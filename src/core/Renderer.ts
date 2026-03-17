import * as THREE from 'three';

/** Fixed game area aspect ratio: 10 wide × 16 tall */
export const GAME_ASPECT = 10 / 16; // 0.625

/**
 * Renderer — Initializes Three.js WebGL renderer with shadow support,
 * anti-aliasing, and responsive resize handling.
 * Enforces a fixed 10:16 aspect ratio with black letterboxing.
 */
export class Renderer {
  public renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;
  private container: HTMLElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.container = canvas.parentElement!;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.setClearColor(0x000000, 1);

    this.updateSize();
    window.addEventListener('resize', this.onResize);
  }

  /** Calculate the largest 10:16 rectangle that fits inside the window */
  private getGameSize(): { width: number; height: number } {
    const windowW = window.innerWidth;
    const windowH = window.innerHeight;
    const windowAspect = windowW / windowH;

    let width: number;
    let height: number;

    if (windowAspect > GAME_ASPECT) {
      // Window is wider than 10:16 → fit to height, black bars on sides
      height = windowH;
      width = height * GAME_ASPECT;
    } else {
      // Window is taller than 10:16 → fit to width, black bars top/bottom
      width = windowW;
      height = width / GAME_ASPECT;
    }

    return { width: Math.floor(width), height: Math.floor(height) };
  }

  private updateSize(): void {
    const { width, height } = this.getGameSize();

    // Resize the renderer to the game area
    this.renderer.setSize(width, height);

    // Position the container centered (CSS handles the centering,
    // but we set explicit width/height on the container)
    this.container.style.width = `${width}px`;
    this.container.style.height = `${height}px`;
  }

  private onResize = (): void => {
    this.updateSize();
  };

  /** Get the current game area pixel size */
  getGamePixelSize(): { width: number; height: number } {
    return this.getGameSize();
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.render(scene, camera);
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }
}
