/**
 * MedalSystem — Tracks consecutive medal pickups for chain bonuses.
 */
export class MedalSystem {
  private chain = 0;
  private lastPickupMoving = false;

  /**
   * Record a medal pickup.
   * @param isMoving Whether the medal was collected while in flight (vs stationary/dropped)
   * @returns The score awarded for this pickup
   */
  collect(isMoving: boolean): number {
    this.chain++;
    this.lastPickupMoving = isMoving;

    // Base score
    let score = isMoving ? 1000 : 500;

    // Chain bonuses
    if (this.chain >= 30) {
      score = 100000;
    } else if (this.chain >= 20) {
      score = 20000;
    } else if (this.chain >= 10) {
      score = 5000;
    }

    return score;
  }

  /**
   * Break the chain (e.g., medal falls off screen or player dies).
   */
  breakChain(): void {
    this.chain = 0;
  }

  getChain(): number {
    return this.chain;
  }

  /**
   * Get the current medal visual state.
   */
  getState(): 'normal' | 'gold' | 'gold_flash' | 'rainbow' {
    if (this.chain >= 30) return 'rainbow';
    if (this.chain >= 20) return 'gold_flash';
    if (this.chain >= 10) return 'gold';
    return 'normal';
  }
}
