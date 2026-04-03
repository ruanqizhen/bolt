/**
 * Pool — Generic object pool with pre-allocation.
 * Avoids GC pressure from frequent creation/destruction of bullets, particles, etc.
 */
export interface Poolable {
  /** Whether this object is currently active/in-use */
  active: boolean;
  /** Internal index to track position in active list (used for O(1) release) */
  poolIndex: number;
  /** Reset the object to its initial state for reuse */
  reset(): void;
}

export class Pool<T extends Poolable> {
  private activeItems: T[] = [];
  private inactiveItems: T[] = [];
  private factory: () => T;
  private maxSize: number;

  constructor(factory: () => T, initialSize: number, maxSize = initialSize * 2) {
    this.factory = factory;
    this.maxSize = maxSize;

    // Pre-allocate
    for (let i = 0; i < initialSize; i++) {
      const item = this.factory();
      item.active = false;
      item.poolIndex = -1;
      this.inactiveItems.push(item);
    }
  }

  /**
   * Get an inactive item from the pool, or create a new one if space allows.
   * Returns null if pool is at max capacity and all items are active.
   */
  acquire(): T | null {
    let item: T | null = null;

    if (this.inactiveItems.length > 0) {
      item = this.inactiveItems.pop()!;
    } else if (this.activeItems.length + this.inactiveItems.length < this.maxSize) {
      // Grow if under max size
      item = this.factory();
    }

    if (item) {
      item.active = true;
      item.poolIndex = this.activeItems.length;
      this.activeItems.push(item);
      return item;
    }

    return null;
  }

  /**
   * Release an item back to the pool.
   */
  release(item: T): void {
    if (!item.active) return;

    // Constant-time removal: swap with last element
    const index = item.poolIndex;
    const lastIdx = this.activeItems.length - 1;
    
    if (index !== lastIdx) {
      const lastItem = this.activeItems[lastIdx];
      this.activeItems[index] = lastItem;
      lastItem.poolIndex = index;
    }
    
    this.activeItems.pop();
    item.poolIndex = -1;
    item.active = false;
    item.reset();
    this.inactiveItems.push(item);
  }

  /**
   * Get all currently active items.
   */
  getActive(): T[] {
    return this.activeItems;
  }

  /**
   * Get total pool size (active + inactive).
   */
  get size(): number {
    return this.activeItems.length + this.inactiveItems.length;
  }

  /**
   * Get number of currently active items.
   */
  get activeCount(): number {
    return this.activeItems.length;
  }

  forEach(callback: (item: T) => void): void {
    // Note: Iterate over a copy or from end to start if release can happen during loop
    for (let i = 0; i < this.activeItems.length; i++) {
      callback(this.activeItems[i]);
    }
  }

  releaseAll(): void {
    while (this.activeItems.length > 0) {
      this.release(this.activeItems[0]);
    }
  }
}
