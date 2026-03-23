/**
 * AudioManager — Web Audio API based audio system.
 * Procedurally generates all game sounds and music.
 * Supports SFX, BGM with fade transitions, and boss themes.
 */

export type SfxType =
  | 'shoot_vulcan'
  | 'shoot_laser'
  | 'shoot_homing'
  | 'explosion_small'
  | 'explosion_medium'
  | 'explosion_large'
  | 'explosion_boss'
  | 'hit'
  | 'powerup'
  | 'bomb'
  | 'boss_warning'
  | 'medal'
  | 'menu_select'
  | 'menu_hover'
  | 'level_start'
  | 'level_clear'
  | 'game_over'
  | 'continue'
  | 'victory'
  | 'laser_beam';

export interface BgmConfig {
  id: string;
  notes: number[];
  tempo: number;
  volume: number;
  instrument: 'triangle' | 'square' | 'sine' | 'sawtooth';
  loop: boolean;
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;

  // BGM state
  private bgmOscillators: OscillatorNode[] = [];
  private bgmPlaying = false;
  private currentBgmId: string | null = null;
  private bgmFadeTimer: number | null = null;

  // Volume settings
  private sfxVolume = 0.4;
  private bgmVolume = 0.15;

  public muted = false;

  // BGM presets
  private bgmPresets: Record<string, BgmConfig> = {
    stage1: {
      id: 'stage1',
      notes: [130.81, 164.81, 196.00, 261.63, 196.00, 164.81, 130.81, 98.00],
      tempo: 0.15,
      volume: 0.15,
      instrument: 'triangle',
      loop: true,
    },
    stage2: {
      id: 'stage2',
      notes: [146.83, 196.00, 220.00, 293.66, 220.00, 196.00, 146.83, 110.00],
      tempo: 0.12,
      volume: 0.15,
      instrument: 'sawtooth',
      loop: true,
    },
    stage3: {
      id: 'stage3',
      notes: [98.00, 130.81, 164.81, 196.00, 261.63, 196.00, 164.81, 130.81],
      tempo: 0.18,
      volume: 0.15,
      instrument: 'triangle',
      loop: true,
    },
    boss: {
      id: 'boss',
      notes: [65.41, 77.78, 98.00, 130.81, 98.00, 77.78, 65.41, 49.00],
      tempo: 0.1,
      volume: 0.18,
      instrument: 'square',
      loop: true,
    },
    boss_enraged: {
      id: 'boss_enraged',
      notes: [73.42, 87.31, 110.00, 146.83, 110.00, 87.31, 73.42, 55.00],
      tempo: 0.08,
      volume: 0.2,
      instrument: 'sawtooth',
      loop: true,
    },
    victory: {
      id: 'victory',
      notes: [261.63, 329.63, 392.00, 523.25, 392.00, 329.63, 261.63, 196.00],
      tempo: 0.2,
      volume: 0.18,
      instrument: 'triangle',
      loop: false,
    },
    game_over: {
      id: 'game_over',
      notes: [196.00, 185.00, 174.61, 164.81, 155.56, 146.83, 138.59, 130.81],
      tempo: 0.4,
      volume: 0.15,
      instrument: 'sawtooth',
      loop: false,
    },
  };

  init(): void {
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.ctx.destination);

      // Separate gain nodes for SFX and BGM
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0; // Start silent for fade-in
      this.bgmGain.connect(this.masterGain);
    } catch (e) {
      console.warn('[Audio] Web Audio API not available');
    }
  }

  private ensureContext(): void {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Play a sound effect with optional 3D positioning
   */
  playSfx(type: SfxType, position?: { x: number; z: number }): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.ensureContext();

    const now = this.ctx.currentTime;
    const pan = position ? this.createPanner(position.x) : null;
    const output = pan || this.sfxGain;

    switch (type) {
      case 'shoot_vulcan':
        this.playVulcanShoot(now, output);
        break;
      case 'shoot_laser':
        this.playLaserShoot(now, output);
        break;
      case 'shoot_homing':
        this.playHomingShoot(now, output);
        break;
      case 'explosion_small':
        this.playExplosion(now, output, 'small');
        break;
      case 'explosion_medium':
        this.playExplosion(now, output, 'medium');
        break;
      case 'explosion_large':
        this.playExplosion(now, output, 'large');
        break;
      case 'explosion_boss':
        this.playExplosion(now, output, 'boss');
        break;
      case 'hit':
        this.playHit(now, output);
        break;
      case 'powerup':
        this.playPowerup(now, output);
        break;
      case 'bomb':
        this.playBomb(now, output);
        break;
      case 'boss_warning':
        this.playBossWarning(now, output);
        break;
      case 'medal':
        this.playMedal(now, output);
        break;
      case 'menu_select':
        this.playMenuSelect(now, output);
        break;
      case 'menu_hover':
        this.playMenuHover(now, output);
        break;
      case 'level_start':
        this.playLevelStart(now, output);
        break;
      case 'level_clear':
        this.playLevelClear(now, output);
        break;
      case 'game_over':
        this.playGameOver(now, output);
        break;
      case 'continue':
        this.playContinue(now, output);
        break;
      case 'victory':
        this.playVictory(now, output);
        break;
      case 'laser_beam':
        this.playLaserBeam(now, output);
        break;
    }

    if (pan) {
      pan.connect(this.sfxGain);
    }
  }

  private createPanner(x: number): StereoPannerNode {
    const panner = this.ctx!.createStereoPanner();
    // Clamp x between -15 and 15 to -1 and 1
    const panValue = Math.max(-1, Math.min(1, x / 15));
    panner.pan.value = panValue;
    return panner;
  }

  // --- Sound Effect Implementations ---

  private playVulcanShoot(time: number, output: AudioNode): void {
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, time);
    osc.frequency.exponentialRampToValueAtTime(220, time + 0.06);
    gain.gain.setValueAtTime(0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
    osc.connect(gain).connect(output);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  private playLaserShoot(time: number, output: AudioNode): void {
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, time);
    osc.frequency.linearRampToValueAtTime(800, time + 0.1);
    gain.gain.setValueAtTime(0.06, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    osc.connect(gain).connect(output);
    osc.start(time);
    osc.stop(time + 0.1);
  }

  private playHomingShoot(time: number, output: AudioNode): void {
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, time);
    osc.frequency.linearRampToValueAtTime(1000, time + 0.08);
    gain.gain.setValueAtTime(0.08, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    osc.connect(gain).connect(output);
    osc.start(time);
    osc.stop(time + 0.08);
  }

  private playExplosion(time: number, output: AudioNode, size: 'small' | 'medium' | 'large' | 'boss'): void {
    const duration = size === 'boss' ? 1.5 : size === 'large' ? 0.8 : size === 'medium' ? 0.5 : 0.3;
    const bufferSize = this.ctx!.sampleRate * duration;
    const buffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
    const data = buffer.getChannelData(0);

    const decay = size === 'boss' ? 0.3 : size === 'large' ? 0.2 : 0.15;
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * decay));
    }

    const noise = this.ctx!.createBufferSource();
    noise.buffer = buffer;

    const gain = this.ctx!.createGain();
    const baseGain = size === 'boss' ? 0.5 : size === 'large' ? 0.35 : size === 'medium' ? 0.25 : 0.15;
    gain.gain.setValueAtTime(baseGain, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    const filter = this.ctx!.createBiquadFilter();
    filter.type = 'lowpass';
    const baseFreq = size === 'boss' ? 300 : size === 'large' ? 500 : size === 'medium' ? 700 : 900;
    filter.frequency.setValueAtTime(baseFreq, time);
    filter.frequency.exponentialRampToValueAtTime(50, time + duration);

    noise.connect(filter).connect(gain).connect(output);
    noise.start(time);

    // Add low frequency rumble for large explosions
    if (size === 'large' || size === 'boss') {
      const rumbleOsc = this.ctx!.createOscillator();
      const rumbleGain = this.ctx!.createGain();
      rumbleOsc.type = 'sine';
      rumbleOsc.frequency.setValueAtTime(60, time);
      rumbleOsc.frequency.exponentialRampToValueAtTime(30, time + duration);
      rumbleGain.gain.setValueAtTime(size === 'boss' ? 0.4 : 0.25, time);
      rumbleGain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      rumbleOsc.connect(rumbleGain).connect(output);
      rumbleOsc.start(time);
      rumbleOsc.stop(time + duration);
    }
  }

  private playHit(time: number, output: AudioNode): void {
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(350, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.1);
    gain.gain.setValueAtTime(0.08, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    osc.connect(gain).connect(output);
    osc.start(time);
    osc.stop(time + 0.1);
  }

  private playPowerup(time: number, output: AudioNode): void {
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, time); // C5
    osc.frequency.setValueAtTime(659.25, time + 0.08); // E5
    osc.frequency.setValueAtTime(783.99, time + 0.16); // G5
    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
    osc.connect(gain).connect(output);
    osc.start(time);
    osc.stop(time + 0.25);
  }

  private playBomb(time: number, output: AudioNode): void {
    // Deep rumble with shockwave effect
    const duration = 1.2;
    const bufferSize = this.ctx!.sampleRate * duration;
    const buffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }

    const noise = this.ctx!.createBufferSource();
    noise.buffer = buffer;

    const gain = this.ctx!.createGain();
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    const filter = this.ctx!.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, time);
    filter.frequency.exponentialRampToValueAtTime(40, time + duration);

    noise.connect(filter).connect(gain).connect(output);
    noise.start(time);

    // Sub-bass punch
    const subOsc = this.ctx!.createOscillator();
    const subGain = this.ctx!.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(50, time);
    subOsc.frequency.exponentialRampToValueAtTime(25, time + 0.5);
    subGain.gain.setValueAtTime(0.6, time);
    subGain.gain.exponentialRampToValueAtTime(0.001, time + 0.8);
    subOsc.connect(subGain).connect(output);
    subOsc.start(time);
    subOsc.stop(time + 0.8);
  }

  private playBossWarning(time: number, output: AudioNode): void {
    // Dramatic alarm sound
    for (let i = 0; i < 4; i++) {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sawtooth';
      const freqTime = time + i * 0.35;
      osc.frequency.setValueAtTime(500, freqTime);
      osc.frequency.setValueAtTime(350, freqTime + 0.17);
      gain.gain.setValueAtTime(0.12, freqTime);
      gain.gain.setValueAtTime(0, freqTime + 0.3);
      osc.connect(gain).connect(output);
      osc.start(freqTime);
      osc.stop(freqTime + 0.3);
    }
  }

  private playMedal(time: number, output: AudioNode): void {
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.50, time); // C6
    osc.frequency.setValueAtTime(1318.51, time + 0.06); // E6
    gain.gain.setValueAtTime(0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    osc.connect(gain).connect(output);
    osc.start(time);
    osc.stop(time + 0.15);
  }

  private playMenuSelect(time: number, output: AudioNode): void {
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, time);
    osc.frequency.setValueAtTime(1100, time + 0.05);
    gain.gain.setValueAtTime(0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    osc.connect(gain).connect(output);
    osc.start(time);
    osc.stop(time + 0.1);
  }

  private playMenuHover(time: number, output: AudioNode): void {
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, time);
    gain.gain.setValueAtTime(0.05, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(gain).connect(output);
    osc.start(time);
    osc.stop(time + 0.05);
  }

  private playLevelStart(time: number, output: AudioNode): void {
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      const noteTime = time + i * 0.1;
      osc.frequency.setValueAtTime(freq, noteTime);
      gain.gain.setValueAtTime(0.1, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.2);
      osc.connect(gain).connect(output);
      osc.start(noteTime);
      osc.stop(noteTime + 0.2);
    });
  }

  private playLevelClear(time: number, output: AudioNode): void {
    const notes = [783.99, 987.77, 1046.50, 1318.51, 1567.98, 2093.00]; // G5 B5 C6 E6 G6 C7
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      const noteTime = time + i * 0.12;
      osc.frequency.setValueAtTime(freq, noteTime);
      gain.gain.setValueAtTime(0.12, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.25);
      osc.connect(gain).connect(output);
      osc.start(noteTime);
      osc.stop(noteTime + 0.25);
    });
  }

  private playGameOver(time: number, output: AudioNode): void {
    const notes = [392.00, 369.99, 349.23, 329.63, 311.13, 293.66]; // G4 F#4 F4 E4 Eb4 D4
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sawtooth';
      const noteTime = time + i * 0.4;
      osc.frequency.setValueAtTime(freq, noteTime);
      gain.gain.setValueAtTime(0.1, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);
      osc.connect(gain).connect(output);
      osc.start(noteTime);
      osc.stop(noteTime + 0.35);
    });
  }

  private playContinue(time: number, output: AudioNode): void {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      const noteTime = time + i * 0.1;
      osc.frequency.setValueAtTime(freq, noteTime);
      gain.gain.setValueAtTime(0.12, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.2);
      osc.connect(gain).connect(output);
      osc.start(noteTime);
      osc.stop(noteTime + 0.2);
    });
  }

  private playVictory(time: number, output: AudioNode): void {
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00];
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      const noteTime = time + i * 0.15;
      osc.frequency.setValueAtTime(freq, noteTime);
      gain.gain.setValueAtTime(0.15, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.3);
      osc.connect(gain).connect(output);
      osc.start(noteTime);
      osc.stop(noteTime + 0.3);
    });
  }

  private playLaserBeam(time: number, output: AudioNode): void {
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    const filter = this.ctx!.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, time);
    osc.frequency.exponentialRampToValueAtTime(200, time + 0.15);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, time);
    filter.frequency.exponentialRampToValueAtTime(300, time + 0.15);
    filter.Q.value = 2;

    gain.gain.setValueAtTime(0.08, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    osc.connect(filter).connect(gain).connect(output);
    osc.start(time);
    osc.stop(time + 0.15);
  }

  // --- BGM Methods ---

  /**
   * Start background music with fade-in
   */
  startBGM(bgmId: string = 'stage1'): void {
    if (!this.ctx || !this.bgmGain || this.muted) return;
    this.ensureContext();

    const config = this.bgmPresets[bgmId];
    if (!config) return;

    // If same BGM is already playing, do nothing
    if (this.bgmPlaying && this.currentBgmId === bgmId) return;

    // Stop current BGM with fade-out
    if (this.bgmPlaying) {
      this.fadeOutBGM(0.5);
    }

    this.currentBgmId = bgmId;
    this.bgmPlaying = true;

    // Fade in
    this.bgmGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.bgmGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.bgmGain.gain.linearRampToValueAtTime(config.volume, this.ctx.currentTime + 1.0);

    const playLoop = () => {
      if (!this.bgmPlaying || !this.ctx || !this.bgmGain) return;
      const now = this.ctx.currentTime;

      for (let i = 0; i < config.notes.length; i++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = config.instrument;
        osc.frequency.setValueAtTime(config.notes[i], now + i * config.tempo);

        gain.gain.setValueAtTime(config.volume * 0.5, now + i * config.tempo);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (i + 1) * config.tempo);

        osc.connect(gain).connect(this.bgmGain);
        osc.start(now + i * config.tempo);
        osc.stop(now + (i + 1) * config.tempo + 0.1);
        this.bgmOscillators.push(osc);
      }

      if (config.loop) {
        this.bgmFadeTimer = setTimeout(playLoop, config.notes.length * config.tempo * 1000);
      }
    };

    playLoop();
  }

  /**
   * Stop background music with fade-out
   */
  stopBGM(fadeDuration = 0.5): void {
    if (!this.bgmPlaying || !this.bgmGain) return;

    this.fadeOutBGM(fadeDuration);
    this.bgmPlaying = false;
    this.currentBgmId = null;
  }

  private fadeOutBGM(duration: number): void {
    if (!this.ctx || !this.bgmGain) return;

    this.bgmGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, this.ctx.currentTime);
    this.bgmGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);

    // Clear oscillators after fade
    setTimeout(() => {
      for (const osc of this.bgmOscillators) {
        try {
          osc.stop();
        } catch (e) {
          // Already stopped
        }
      }
      this.bgmOscillators = [];
    }, duration * 1000 + 100);
  }

  /**
   * Transition to a new BGM with crossfade
   */
  transitionBGM(newBgmId: string, crossfadeDuration = 0.5): void {
    if (!this.bgmPlaying || this.currentBgmId === newBgmId) {
      this.startBGM(newBgmId);
      return;
    }

    const config = this.bgmPresets[newBgmId];
    if (!config) return;

    // Fade out current
    this.fadeOutBGM(crossfadeDuration);

    // Start new with delay
    setTimeout(() => {
      this.startBGM(newBgmId);
    }, crossfadeDuration * 1000);
  }

  /**
   * Play boss theme with enraged transition at 50% HP
   */
  startBossBGM(enraged = false): void {
    this.startBGM(enraged ? 'boss_enraged' : 'boss');
  }

  /**
   * Transition boss music to enraged phase
   */
  transitionToEnraged(): void {
    this.transitionBGM('boss_enraged', 0.3);
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : 1.0;
    }
    if (this.muted) {
      this.stopBGM(0.1);
    }
  }

  setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    if (this.sfxGain) {
      this.sfxGain.gain.value = this.sfxVolume;
    }
  }

  setBgmVolume(volume: number): void {
    this.bgmVolume = Math.max(0, Math.min(1, volume));
    // Will affect next BGM start
  }

  dispose(): void {
    this.stopBGM(0.1);
    if (this.bgmFadeTimer) {
      clearTimeout(this.bgmFadeTimer);
    }
    this.ctx?.close();
  }
}
