/**
 * Pool — Generic object pool with pre-allocation.
 * Avoids GC pressure from frequent creation/destruction of bullets, particles, etc.
 */
export interface Poolable {
  /** Whether this object is currently active/in-use */
  active: boolean;
  /** Reset the object to its initial state for reuse */
  reset(): void;
}

export class Pool<T extends Poolable> {
  private items: T[] = [];
  private factory: () => T;
  private maxSize: number;

  constructor(factory: () => T, initialSize: number, maxSize = initialSize * 2) {
    this.factory = factory;
    this.maxSize = maxSize;

    // Pre-allocate
    for (let i = 0; i < initialSize; i++) {
      const item = this.factory();
      item.active = false;
      this.items.push(item);
    }
  }

  /**
   * Get an inactive item from the pool, or create a new one if space allows.
   * Returns null if pool is at max capacity and all items are active.
   */
  acquire(): T | null {
    // Find first inactive item
    for (const item of this.items) {
      if (!item.active) {
        item.active = true;
        return item;
      }
    }

    // Grow if under max size
    if (this.items.length < this.maxSize) {
      const item = this.factory();
      item.active = true;
      this.items.push(item);
      return item;
    }

    return null;
  }

  /**
   * Release an item back to the pool.
   */
  release(item: T): void {
    item.active = false;
    item.reset();
  }

  /**
   * Get all currently active items.
   */
  getActive(): T[] {
    return this.items.filter((item) => item.active);
  }

  /**
   * Get total pool size (active + inactive).
   */
  get size(): number {
    return this.items.length;
  }

  /**
   * Get number of currently active items.
   */
  get activeCount(): number {
    return this.items.filter((item) => item.active).length;
  }

  /**
   * Run a callback on every active item.
   */
  forEach(callback: (item: T) => void): void {
    for (const item of this.items) {
      if (item.active) {
        callback(item);
      }
    }
  }

  /**
   * Release all items.
   */
  releaseAll(): void {
    for (const item of this.items) {
      if (item.active) {
        this.release(item);
      }
    }
  }
}
