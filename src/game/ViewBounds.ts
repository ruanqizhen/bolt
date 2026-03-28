import * as THREE from 'three';
import { Camera } from '../core/Camera';

/**
 * ViewBounds — Defines the visible game area for gameplay logic.
 * Enemies outside this area cannot fire or be hit by bullets.
 */
export class ViewBounds {
  // Visible area boundaries (at y=0 plane)
  public readonly left: number;
  public readonly right: number;
  public readonly top: number;
  public readonly bottom: number;

  // Extra margin for spawn/despawn zones
  private static readonly MARGIN = 3;

  constructor(camera: Camera) {
    const visibleSize = camera.getVisibleSize();
    this.left = -visibleSize.width / 2;
    this.right = visibleSize.width / 2;
    this.top = -visibleSize.height / 2;
    this.bottom = visibleSize.height / 2;
  }

  /**
   * Check if a position is within the visible game area (with small margin).
   */
  isInBounds(pos: THREE.Vector3): boolean {
    return (
      pos.x >= this.left - ViewBounds.MARGIN &&
      pos.x <= this.right + ViewBounds.MARGIN &&
      pos.z >= this.top - ViewBounds.MARGIN &&
      pos.z <= this.bottom + ViewBounds.MARGIN
    );
  }

  /**
   * Check if a position is fully inside the visible area (no margin).
   * Used for enemy firing logic.
   */
  isFullyVisible(pos: THREE.Vector3): boolean {
    return (
      pos.x >= this.left &&
      pos.x <= this.right &&
      pos.z >= this.top &&
      pos.z <= this.bottom
    );
  }

  /**
   * Get the Z boundary where enemies become visible.
   * Enemies spawn above this and move down into view.
   */
  getSpawnZ(): number {
    return this.top - ViewBounds.MARGIN;
  }

  /**
   * Get the Z boundary where enemies should be despawned.
   */
  getDespawnZ(): number {
    return this.bottom + ViewBounds.MARGIN;
  }
}
