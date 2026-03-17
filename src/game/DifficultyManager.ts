/**
 * DifficultyManager — Dynamic difficulty based on score and time.
 * difficulty = base + (score / 100000) * 0.5 + (time * 0.02)
 * Capped at 3.0
 */
export class DifficultyManager {
  private baseDifficulty = 1.0;

  /**
   * Calculate current difficulty.
   */
  getDifficulty(score: number, elapsedTime: number): number {
    const d = this.baseDifficulty
      + (score / 100000) * 0.5
      + (elapsedTime * 0.02);
    return Math.min(d, 3.0);
  }

  /**
   * Get bullet speed multiplier based on difficulty.
   * Returns 0.8 to 1.2 range.
   */
  getBulletSpeedMult(difficulty: number): number {
    return 0.8 + (difficulty - 1.0) * 0.2;
  }

  /**
   * Get enemy spawn count multiplier.
   */
  getSpawnMult(difficulty: number): number {
    return 1.0 + (difficulty - 1.0) * 0.3;
  }

  /**
   * Get boss attack interval multiplier (lower = faster attacks).
   */
  getBossIntervalMult(difficulty: number): number {
    return Math.max(0.5, 1.0 - (difficulty - 1.0) * 0.15);
  }
}
