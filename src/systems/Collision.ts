import * as THREE from 'three';
import { BulletData } from '../game/Bullet';
import { Player } from '../game/Player';

/**
 * Simple Quadtree node for spatial partitioning.
 */
interface QuadBounds {
  x: number;
  z: number;
  halfW: number;
  halfH: number;
}

interface QuadItem {
  position: THREE.Vector3;
  radius: number;
  data: any;
}

class QuadTree {
  private items: QuadItem[] = [];
  private children: QuadTree[] | null = null;
  private static readonly MAX_ITEMS = 8;
  private static readonly MAX_DEPTH = 5;

  constructor(private bounds: QuadBounds, private depth = 0) {}

  clear(): void {
    this.items.length = 0;
    this.children = null;
  }

  insert(item: QuadItem): void {
    if (!this.contains(item.position)) return;

    if (this.children) {
      for (const child of this.children) {
        child.insert(item);
      }
      return;
    }

    this.items.push(item);

    if (this.items.length > QuadTree.MAX_ITEMS && this.depth < QuadTree.MAX_DEPTH) {
      this.subdivide();
    }
  }

  query(pos: THREE.Vector3, radius: number, results: QuadItem[]): void {
    if (!this.intersectsCircle(pos, radius)) return;

    for (const item of this.items) {
      const dx = item.position.x - pos.x;
      const dz = item.position.z - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < radius + item.radius) {
        results.push(item);
      }
    }

    if (this.children) {
      for (const child of this.children) {
        child.query(pos, radius, results);
      }
    }
  }

  private contains(pos: THREE.Vector3): boolean {
    return (
      pos.x >= this.bounds.x - this.bounds.halfW &&
      pos.x <= this.bounds.x + this.bounds.halfW &&
      pos.z >= this.bounds.z - this.bounds.halfH &&
      pos.z <= this.bounds.z + this.bounds.halfH
    );
  }

  private intersectsCircle(pos: THREE.Vector3, radius: number): boolean {
    const closestX = Math.max(this.bounds.x - this.bounds.halfW, Math.min(pos.x, this.bounds.x + this.bounds.halfW));
    const closestZ = Math.max(this.bounds.z - this.bounds.halfH, Math.min(pos.z, this.bounds.z + this.bounds.halfH));
    const dx = pos.x - closestX;
    const dz = pos.z - closestZ;
    return dx * dx + dz * dz <= radius * radius;
  }

  private subdivide(): void {
    const { x, z, halfW, halfH } = this.bounds;
    const qw = halfW / 2;
    const qh = halfH / 2;

    this.children = [
      new QuadTree({ x: x - qw, z: z - qh, halfW: qw, halfH: qh }, this.depth + 1),
      new QuadTree({ x: x + qw, z: z - qh, halfW: qw, halfH: qh }, this.depth + 1),
      new QuadTree({ x: x - qw, z: z + qh, halfW: qw, halfH: qh }, this.depth + 1),
      new QuadTree({ x: x + qw, z: z + qh, halfW: qw, halfH: qh }, this.depth + 1),
    ];

    for (const item of this.items) {
      for (const child of this.children) {
        child.insert(item);
      }
    }
    this.items.length = 0;
  }
}

/**
 * CollisionResult — What happened in a collision.
 */
export interface CollisionResult {
  /** Player was hit by an enemy bullet */
  playerHit: boolean;
  /** Bullets that hit enemies: [bullet, enemyIndex] pairs */
  bulletHits: Array<{ bullet: BulletData; enemyIndex: number }>;
  /** Player collided with an enemy body */
  playerEnemyCollision: number | null;
}

/**
 * Enemy hitbox data passed to collision checks.
 */
export interface EnemyHitbox {
  position: THREE.Vector3;
  radius: number;
  alive: boolean;
  /** Whether enemy is in the visible game area */
  inView?: boolean;
}

/**
 * CollisionSystem — Handles all collision detection.
 * Uses sphere-sphere for player checks, Quadtree for bullet-vs-enemy.
 */
export class CollisionSystem {
  private quadTree: QuadTree;

  constructor() {
    this.quadTree = new QuadTree({ x: 0, z: 0, halfW: 50, halfH: 50 });
  }

  /**
   * Run all collision checks for one frame.
   */
  check(
    player: Player,
    playerBullets: BulletData[],
    enemyBullets: BulletData[],
    enemies: EnemyHitbox[]
  ): CollisionResult {
    const result: CollisionResult = {
      playerHit: false,
      bulletHits: [],
      playerEnemyCollision: null,
    };

    if (!player.isAlive) return result;

    // 1. Player vs enemy bullets (sphere collision, hitbox radius = 0.1)
    if (!player.isInvincible) {
      for (const bullet of enemyBullets) {
        const dx = bullet.position.x - player.position.x;
        const dz = bullet.position.z - player.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < Player.HITBOX_RADIUS + 0.1) {
          result.playerHit = true;
          break;
        }
      }
    }

    // 2. Player vs enemy bodies (body radius = 1.2)
    if (!player.isInvincible) {
      for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        if (!enemy.alive || enemy.inView === false) continue;
        const dx = enemy.position.x - player.position.x;
        const dz = enemy.position.z - player.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < Player.BODY_RADIUS + enemy.radius) {
          result.playerEnemyCollision = i;
          break;
        }
      }
    }

    // 3. Player bullets vs enemies (Quadtree)
    this.quadTree.clear();

    // Insert enemies into quadtree (only those in view)
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (!enemy.alive || enemy.inView === false) continue;
      this.quadTree.insert({
        position: enemy.position,
        radius: enemy.radius,
        data: i,
      });
    }

    // Query for each player bullet and deduplicate hits
    const queryResults: QuadItem[] = [];
    const hitSet = new Set<string>(); // Track unique bullet-enemy hits

    for (const bullet of playerBullets) {
      queryResults.length = 0;
      this.quadTree.query(bullet.position, 0.3, queryResults);
      for (const hit of queryResults) {
        // Create unique key for bullet-enemy pair to prevent duplicate hits
        const hitKey = `${bullet.position.x},${bullet.position.z}-${hit.data as number}`;
        if (!hitSet.has(hitKey)) {
          hitSet.add(hitKey);
          result.bulletHits.push({
            bullet,
            enemyIndex: hit.data as number,
          });
        }
      }
    }

    return result;
  }
}
