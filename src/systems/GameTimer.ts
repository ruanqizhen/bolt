/**
 * GameTimer — A unified, game-loop-driven timer system.
 *
 * All delayed operations accumulate deltaTime instead of relying on
 * wall-clock setTimeout, so they automatically pause when the browser
 * tab is inactive and requestAnimationFrame stops firing.
 */

interface PendingTimer {
  remaining: number;
  callback: () => void;
  /** If true, the timer is cancelled and will be cleaned up on next update. */
  cancelled: boolean;
}

export class GameTimer {
  private static _instance: GameTimer;
  private timers: PendingTimer[] = [];

  static getInstance(): GameTimer {
    if (!GameTimer._instance) {
      GameTimer._instance = new GameTimer();
    }
    return GameTimer._instance;
  }

  /**
   * Schedule a one-shot callback after `delaySec` seconds of game time.
   * Returns a handle that can be used to cancel the timer.
   */
  schedule(delaySec: number, callback: () => void): PendingTimer {
    const timer: PendingTimer = {
      remaining: delaySec,
      callback,
      cancelled: false,
    };
    this.timers.push(timer);
    return timer;
  }

  /**
   * Schedule a sequence of callbacks at staggered intervals.
   * @param count     Number of callbacks to fire.
   * @param interval  Seconds between each callback.
   * @param callback  Called with the index (0..count-1) of the current step.
   * @returns Array of timer handles (one per step).
   */
  scheduleSequence(
    count: number,
    interval: number,
    callback: (index: number) => void,
  ): PendingTimer[] {
    const handles: PendingTimer[] = [];
    for (let i = 0; i < count; i++) {
      handles.push(this.schedule(i * interval, () => callback(i)));
    }
    return handles;
  }

  /**
   * Cancel a previously scheduled timer.
   */
  cancel(timer: PendingTimer): void {
    timer.cancelled = true;
  }

  /**
   * Cancel all timers in an array.
   */
  cancelAll(timers: PendingTimer[]): void {
    for (const t of timers) {
      t.cancelled = true;
    }
  }

  /**
   * Tick all pending timers. Call once per frame from the main game loop.
   */
  update(deltaTime: number): void {
    let writeIdx = 0;
    for (let i = 0; i < this.timers.length; i++) {
      const t = this.timers[i];
      if (t.cancelled) continue;

      t.remaining -= deltaTime;
      if (t.remaining <= 0) {
        t.callback();
        // One-shot: don't keep it
        continue;
      }
      // Keep alive
      this.timers[writeIdx++] = t;
    }
    this.timers.length = writeIdx;
  }

  /**
   * Remove all pending timers. Useful on level transitions / game over.
   */
  clear(): void {
    this.timers.length = 0;
  }
}
