/**
 * GameLoop — Fixed-timestep game loop using requestAnimationFrame.
 * Updates systems in the correct order each frame.
 */
export class GameLoop {
  private isRunning = false;
  private lastTime = 0;
  private animationFrameId = 0;
  private fpsElement: HTMLElement | null = null;

  // FPS tracking
  private frameCount = 0;
  private fpsTimer = 0;
  private currentFps = 0;

  // Max delta to prevent spiral of death
  private static readonly MAX_DELTA = 1 / 30; // 33ms

  private updateCallback: (deltaTime: number) => void;
  private renderCallback: () => void;

  constructor(
    updateCallback: (deltaTime: number) => void,
    renderCallback: () => void
  ) {
    this.updateCallback = updateCallback;
    this.renderCallback = renderCallback;
    this.fpsElement = document.getElementById('fps-counter');
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
  }

  private loop(currentTime: number): void {
    if (!this.isRunning) return;

    this.animationFrameId = requestAnimationFrame(this.loop.bind(this));

    let deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Cap delta to prevent physics explosion after tab switch
    deltaTime = Math.min(deltaTime, GameLoop.MAX_DELTA);

    // Update FPS counter
    this.frameCount++;
    this.fpsTimer += deltaTime;
    if (this.fpsTimer >= 1.0) {
      this.currentFps = this.frameCount;
      this.frameCount = 0;
      this.fpsTimer -= 1.0;
      if (this.fpsElement) {
        this.fpsElement.textContent = `FPS: ${this.currentFps}`;
      }
    }

    // Game logic update
    this.updateCallback(deltaTime);

    // Render
    this.renderCallback();
  }

  getFps(): number {
    return this.currentFps;
  }
}
