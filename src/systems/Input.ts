/**
 * Input — Unified input system abstracting keyboard, mouse, and touch.
 * Exposes a normalized direction vector and discrete action buttons.
 */
export interface InputState {
  /** Movement direction, normalized (-1 to 1 for each axis) */
  moveX: number;
  moveY: number;
  /** Whether the slow-mode modifier is active (Shift key) */
  slow: boolean;
  /** Whether the shoot action is active */
  shoot: boolean;
  /** Whether the bomb action was just triggered (read and clear) */
  bomb: boolean;
}

export class Input {
  private keys: Set<string> = new Set();
  private mouseDown = false;
  private mouseRight = false;
  private mousePos = { x: 0, y: 0 };
  private mouseDragStart: { x: number; y: number } | null = null;

  // Touch state
  private touchActive = false;
  private touchPos = { x: 0, y: 0 };
  private touchStartPos = { x: 0, y: 0 };
  private lastTapTime = 0;

  // Bomb flag (consumed on read)
  private bombTriggered = false;

  // Bound event handlers (for proper removal in dispose)
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchEnd: (e: TouchEvent) => void;

  constructor() {
    // Bind event handlers for proper removal
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundTouchStart = this.onTouchStart.bind(this);
    this.boundTouchMove = this.onTouchMove.bind(this);
    this.boundTouchEnd = this.onTouchEnd.bind(this);

    // Keyboard
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);

    // Mouse
    window.addEventListener('mousedown', this.boundMouseDown);
    window.addEventListener('mouseup', this.boundMouseUp);
    window.addEventListener('mousemove', this.boundMouseMove);
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch
    window.addEventListener('touchstart', this.boundTouchStart, { passive: false });
    window.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    window.addEventListener('touchend', this.boundTouchEnd, { passive: false });
  }

  /**
   * Get the current input state. Call once per frame.
   */
  getState(): InputState {
    let moveX = 0;
    let moveY = 0;

    // Keyboard movement
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) moveX -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) moveX += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) moveY += 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) moveY -= 1;

    // Normalize diagonal movement
    if (moveX !== 0 && moveY !== 0) {
      const len = Math.sqrt(moveX * moveX + moveY * moveY);
      moveX /= len;
      moveY /= len;
    }

    const slow = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const shoot = this.keys.has('KeyJ') || this.mouseDown || this.touchActive;

    // Bomb: keyboard K, or mouse right, or double-tap
    const bomb = this.bombTriggered || this.keys.has('KeyK') || this.mouseRight;

    // Consume single-fire bomb trigger
    const state: InputState = { moveX, moveY, slow, shoot, bomb };
    this.bombTriggered = false;

    return state;
  }

  // ---- Keyboard ----
  private onKeyDown(e: KeyboardEvent): void {
    this.keys.add(e.code);
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.code);
  }

  // ---- Mouse ----
  private onMouseDown(e: MouseEvent): void {
    if (e.button === 0) {
      this.mouseDown = true;
      this.mouseDragStart = { x: e.clientX, y: e.clientY };
    } else if (e.button === 2) {
      this.mouseRight = true;
      this.bombTriggered = true;
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      this.mouseDown = false;
      this.mouseDragStart = null;
    } else if (e.button === 2) {
      this.mouseRight = false;
    }
  }

  private onMouseMove(e: MouseEvent): void {
    this.mousePos = { x: e.clientX, y: e.clientY };
  }

  // ---- Touch ----
  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.touches[0];
    this.touchActive = true;
    this.touchPos = { x: touch.clientX, y: touch.clientY };
    this.touchStartPos = { x: touch.clientX, y: touch.clientY };

    // Double-tap detection for bomb
    const now = performance.now();
    if (now - this.lastTapTime < 300) {
      this.bombTriggered = true;
    }
    this.lastTapTime = now;
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.touches[0];
    this.touchPos = { x: touch.clientX, y: touch.clientY };
  }

  private onTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    this.touchActive = false;
  }

  /**
   * Get the touch/mouse drag delta in screen pixels (for direct movement control).
   * Returns { dx, dy } in pixels. Resets the drag start after reading.
   */
  getDragDelta(): { dx: number; dy: number } | null {
    if (this.touchActive) {
      const dx = this.touchPos.x - this.touchStartPos.x;
      const dy = this.touchPos.y - this.touchStartPos.y;
      this.touchStartPos = { ...this.touchPos };
      return { dx, dy };
    }
    if (this.mouseDown && this.mouseDragStart) {
      const dx = this.mousePos.x - this.mouseDragStart.x;
      const dy = this.mousePos.y - this.mouseDragStart.y;
      this.mouseDragStart = { ...this.mousePos };
      return { dx, dy };
    }
    return null;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('mousedown', this.boundMouseDown);
    window.removeEventListener('mouseup', this.boundMouseUp);
    window.removeEventListener('mousemove', this.boundMouseMove);
    window.removeEventListener('touchstart', this.boundTouchStart);
    window.removeEventListener('touchmove', this.boundTouchMove);
    window.removeEventListener('touchend', this.boundTouchEnd);
  }
}
