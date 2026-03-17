import * as THREE from 'three';
import { GAME_ASPECT } from './Renderer';

/**
 * Camera — PerspectiveCamera with FOV=50° and 15° tilt angle,
 * providing the 2.5D top-down perspective.
 * Uses a fixed 10:16 aspect ratio matching the game area.
 */
export class Camera {
  public camera: THREE.PerspectiveCamera;

  /** The tilt angle in degrees (pitch down from vertical) */
  private static readonly TILT_DEGREES = 15;
  private static readonly FOV = 50;
  private static readonly NEAR = 0.1;
  private static readonly FAR = 1000;

  /** Camera height above the play field */
  private static readonly HEIGHT = 30;

  constructor() {
    // Always use the fixed game aspect ratio (10:16)
    this.camera = new THREE.PerspectiveCamera(
      Camera.FOV,
      GAME_ASPECT,
      Camera.NEAR,
      Camera.FAR
    );

    this.setupPosition();
  }

  private setupPosition(): void {
    const tiltRad = THREE.MathUtils.degToRad(Camera.TILT_DEGREES);

    // Camera sits high above and slightly behind the play field
    const offsetZ = Math.sin(tiltRad) * Camera.HEIGHT;
    const offsetY = Math.cos(tiltRad) * Camera.HEIGHT;

    this.camera.position.set(0, offsetY, offsetZ);
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * Returns the visible width and height of the play field at y=0.
   * Useful for clamping player movement.
   */
  getVisibleSize(): { width: number; height: number } {
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const dist = this.camera.position.length();
    const height = 2 * Math.tan(vFov / 2) * dist;
    const width = height * this.camera.aspect;
    return { width, height };
  }

  dispose(): void {
    // No resize listener needed — aspect is fixed
  }
}
