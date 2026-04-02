import * as THREE from 'three';
import { Enemy } from './Enemy';

/**
 * EnemyAI — Updates enemy positions based on their AI behavior type.
 * Runs at a throttled rate (10 FPS) per the PRD.
 */
export class EnemyAI {
  private throttleAccum = 0;
  private static readonly AI_INTERVAL = 1 / 10; // 10 FPS
  private static readonly SCROLL_SPEED = 4.0; // Base speed for ground units to match environment scroll

  /**
   * Update all enemy AI. Call every frame; internally throttles to 10 FPS.
   * @param difficultySpeedMult  Multiplier from DifficultyManager (1.0 = normal).
   */
  update(enemies: Enemy[], playerPos: THREE.Vector3, deltaTime: number, difficultySpeedMult = 1.0): void {
    this.throttleAccum += deltaTime;
    if (this.throttleAccum < EnemyAI.AI_INTERVAL) return;

    const dt = this.throttleAccum;
    this.throttleAccum = 0;

    for (const enemy of enemies) {
      if (!enemy.alive) continue;

      // Skip off-screen enemies (frustum culling for AI)
      if (Math.abs(enemy.position.x) > 25 || Math.abs(enemy.position.z) > 25) continue;

      switch (enemy.config.ai) {
        case 'linear':
          this.updateLinear(enemy, dt, difficultySpeedMult);
          break;
        case 'sine':
          this.updateSine(enemy, dt, difficultySpeedMult);
          break;
        case 'chase':
          this.updateChase(enemy, playerPos, dt, difficultySpeedMult);
          break;
        case 'patrol':
          this.updatePatrol(enemy, dt, difficultySpeedMult);
          break;
        case 'stationary':
          // Move down at scroll speed to appear fixed to the ground
          enemy.position.z += EnemyAI.SCROLL_SPEED * dt;
          break;
        case 'spawn_units':
          this.updateLinear(enemy, dt * 0.5, difficultySpeedMult);
          break;
      }
    }
  }

  private updateLinear(enemy: Enemy, dt: number, speedMult: number): void {
    enemy.position.z += enemy.config.speed * speedMult * dt;
  }

  private updateSine(enemy: Enemy, dt: number, speedMult: number): void {
    enemy.aiTimer += dt;
    enemy.position.z += enemy.config.speed * speedMult * dt;
    enemy.position.x = enemy.startX + Math.sin(enemy.aiTimer * 2 + enemy.sineOffset) * 3;
  }

  private updateChase(enemy: Enemy, playerPos: THREE.Vector3, dt: number, speedMult: number): void {
    // Move down but also drift toward player X
    enemy.position.z += enemy.config.speed * speedMult * dt * 0.7;

    const dx = playerPos.x - enemy.position.x;
    const chase = Math.sign(dx) * Math.min(Math.abs(dx), enemy.config.speed * speedMult * dt * 0.5);
    enemy.position.x += chase;
  }

  private updatePatrol(enemy: Enemy, dt: number, speedMult: number): void {
    // Move down slowly while sweeping left-right
    enemy.position.z += enemy.config.speed * speedMult * dt * 0.3;
    enemy.aiTimer += dt;

    // Sweep with longer period
    enemy.position.x = enemy.startX + Math.sin(enemy.aiTimer * 0.8 + enemy.sineOffset) * 5;
  }
}
