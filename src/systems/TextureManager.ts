import * as THREE from 'three';

/**
 * TextureManager — Preloads and caches all game textures from PNG files.
 */
export class TextureManager {
  private loader = new THREE.TextureLoader();
  private cache = new Map<string, THREE.Texture>();
  private static instance: TextureManager;

  static getInstance(): TextureManager {
    if (!TextureManager.instance) {
      TextureManager.instance = new TextureManager();
    }
    return TextureManager.instance;
  }

  /**
   * Preload all game textures. Returns a promise that resolves when all loaded.
   */
  async preloadAll(): Promise<void> {
    const paths = [
      // Player
      'player/ship.png',
      // Enemies
      'enemies/scout_drone.png', 'enemies/serpent_drone.png', 'enemies/dive_scout.png',
      'enemies/interceptor.png', 'enemies/heavy_fighter.png', 'enemies/laser_fighter.png',
      'enemies/missile_fighter.png', 'enemies/parasite_tank.png', 'enemies/artillery_carrier.png',
      'enemies/missile_truck.png', 'enemies/walker_mech.png', 'enemies/aa_turret.png',
      'enemies/laser_tower.png', 'enemies/bullet_tower.png', 'enemies/missile_silo.png',
      'enemies/elite_interceptor.png', 'enemies/laser_destroyer.png', 'enemies/missile_cruiser.png',
      'enemies/drone_carrier.png', 'enemies/alien_core.png', 'enemies/fairy.png', 'enemies/ufo.png',
      // Bosses
      'bosses/tank_boss.png', 'bosses/bomber_boss.png', 'bosses/carrier_boss.png',
      // Drops
      'drops/powerup_red.png', 'drops/powerup_blue.png', 'drops/powerup_purple.png',
      'drops/bomb.png', 'drops/medal.png',
      // Backgrounds
      'bg/bg1.png', 'bg/bg2.png', 'bg/bg3.png',
    ];

    const promises = paths.map((p) => this.loadTexture(p));
    await Promise.all(promises);
  }

  private loadTexture(relativePath: string): Promise<THREE.Texture> {
    return new Promise((resolve) => {
      // Use different paths for dev vs production
      const fullPath = `/assets/images/${relativePath}`;
      this.loader.load(
        fullPath,
        (texture) => {
          texture.minFilter = THREE.NearestFilter;
          texture.magFilter = THREE.NearestFilter;
          // Apply sRGB to everything except backgrounds for brighter procedural-like look
          if (!relativePath.startsWith('bg/')) {
            texture.colorSpace = THREE.SRGBColorSpace;
          }
          this.cache.set(relativePath, texture);
          resolve(texture);
        },
        undefined,
        () => {
          console.warn(`[TextureManager] Failed to load: ${fullPath}, using fallback`);
          // Create a fallback texture (magenta checker pattern to indicate missing texture)
          const fallback = this.createFallbackTexture();
          this.cache.set(relativePath, fallback);
          resolve(fallback);
        }
      );
    });
  }

  /**
   * Create a fallback texture (purple checker pattern) for missing textures.
   */
  private createFallbackTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Fill with magenta background
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(0, 0, 64, 64);

    // Draw checker pattern
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillRect(32, 32, 32, 32);

    // Draw "MISSING" text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MISSING', 32, 36);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    return texture;
  }

  /**
   * Get a cached texture by relative path (e.g. 'enemies/scout_drone.png').
   */
  get(relativePath: string): THREE.Texture {
    return this.cache.get(relativePath) || new THREE.Texture();
  }

  /**
   * Get enemy texture by enemy ID.
   */
  getEnemy(enemyId: string): THREE.Texture {
    return this.get(`enemies/${enemyId}.png`);
  }

  /**
   * Get boss texture by boss ID.
   */
  getBoss(bossId: string): THREE.Texture {
    return this.get(`bosses/${bossId}.png`);
  }

  /**
   * Get drop texture by drop type.
   */
  getDrop(dropType: string): THREE.Texture {
    return this.get(`drops/${dropType}.png`);
  }

  /**
   * Create a SpriteMaterial from a texture path.
   */
  createSpriteMaterial(relativePath: string): THREE.SpriteMaterial {
    return new THREE.SpriteMaterial({
      map: this.get(relativePath),
      transparent: true,
    });
  }

  dispose(): void {
    this.cache.forEach((t) => t.dispose());
    this.cache.clear();
  }
}
