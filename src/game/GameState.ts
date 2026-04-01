/**
 * GameState — Manages overall game state transitions.
 */
export type GameScreen = 'title' | 'playing' | 'game_over' | 'level_clear' | 'victory' | 'help';

export class GameState {
  public screen: GameScreen = 'title';
  public currentLevel = 1;
  public totalLevels = 3;
  public continues = 3;

  // Score persistence
  public highScore = 0;

  constructor() {
    const saved = localStorage.getItem('bolt_highscore');
    if (saved) this.highScore = parseInt(saved, 10) || 0;
  }

  startGame(): void {
    this.screen = 'playing';
    this.currentLevel = 1;
    this.continues = 3;
  }

  levelCleared(): void {
    if (this.currentLevel >= this.totalLevels) {
      this.screen = 'victory';
    } else {
      this.screen = 'level_clear';
    }
  }

  nextLevel(): void {
    this.currentLevel++;
    this.screen = 'playing';
  }

  gameOver(): void {
    this.screen = 'game_over';
  }

  useContinue(): boolean {
    if (this.continues > 0) {
      this.continues--;
      this.screen = 'playing';
      return true;
    }
    return false;
  }

  saveHighScore(score: number): void {
    if (score > this.highScore) {
      this.highScore = score;
      localStorage.setItem('bolt_highscore', String(score));
    }
  }

  reset(): void {
    this.screen = 'title';
    this.currentLevel = 1;
    this.continues = 3;
  }
}
