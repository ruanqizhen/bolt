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

    // Base score: 500 for stationary, 1000 for moving (in-flight) pickup
    let score = isMoving ? 1000 : 500;

    // Chain bonuses (additional bonus on top of base score)
    if (this.chain >= 30) {
      score += 100000; // Rainbow medal bonus
    } else if (this.chain >= 20) {
      score += 20000; // Gold flash medal bonus
    } else if (this.chain >= 10) {
      score += 5000; // Gold medal bonus
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
