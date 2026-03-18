/**
 * AudioManager — Web Audio API based audio system.
 * Procedurally generates game sounds (no external audio files needed).
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmOscillators: OscillatorNode[] = [];
  private bgmPlaying = false;
  public muted = false;

  init(): void {
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('[Audio] Web Audio API not available');
    }
  }

  private ensureContext(): void {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /** Play a short sound effect */
  playSfx(type: 'shoot' | 'explosion' | 'hit' | 'powerup' | 'bomb' | 'boss_warning' | 'medal'): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    this.ensureContext();

    const now = this.ctx.currentTime;

    switch (type) {
      case 'shoot': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain).connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.05);
        break;
      }
      case 'explosion': {
        const bufferSize = this.ctx.sampleRate * 0.3;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.3);
        noise.connect(filter).connect(gain).connect(this.masterGain);
        noise.start(now);
        break;
      }
      case 'hit': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain).connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.08);
        break;
      }
      case 'powerup': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.linearRampToValueAtTime(1200, now + 0.15);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain).connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
      }
      case 'bomb': {
        // Deep rumble
        const bufferSize = this.ctx.sampleRate * 0.8;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now);
        filter.frequency.exponentialRampToValueAtTime(50, now + 0.8);
        noise.connect(filter).connect(gain).connect(this.masterGain);
        noise.start(now);
        break;
      }
      case 'boss_warning': {
        // Alarm sound
        for (let i = 0; i < 3; i++) {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(600, now + i * 0.4);
          osc.frequency.setValueAtTime(400, now + i * 0.4 + 0.2);
          gain.gain.setValueAtTime(0.1, now + i * 0.4);
          gain.gain.setValueAtTime(0, now + i * 0.4 + 0.35);
          osc.connect(gain).connect(this.masterGain!);
          osc.start(now + i * 0.4);
          osc.stop(now + i * 0.4 + 0.35);
        }
        break;
      }
      case 'medal': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.setValueAtTime(1200, now + 0.05);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain).connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.12);
        break;
      }
    }
  }

  /** Start procedural background music (simple arpeggio loop) */
  startBGM(): void {
    if (!this.ctx || !this.masterGain || this.bgmPlaying || this.muted) return;
    this.ensureContext();
    this.bgmPlaying = true;

    const notes = [130.81, 164.81, 196.00, 261.63, 196.00, 164.81]; // C3 E3 G3 C4 ...
    const noteLen = 0.2;

    const playLoop = () => {
      if (!this.bgmPlaying || !this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;

      for (let i = 0; i < notes.length; i++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(notes[i], now + i * noteLen);
        gain.gain.setValueAtTime(0.04, now + i * noteLen);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (i + 1) * noteLen);
        osc.connect(gain).connect(this.masterGain!);
        osc.start(now + i * noteLen);
        osc.stop(now + (i + 1) * noteLen);
        this.bgmOscillators.push(osc);
      }

      setTimeout(playLoop, notes.length * noteLen * 1000);
    };

    playLoop();
  }

  stopBGM(): void {
    this.bgmPlaying = false;
    for (const osc of this.bgmOscillators) {
      try { osc.stop(); } catch (e) { /* already stopped */ }
    }
    this.bgmOscillators = [];
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : 0.3;
    }
    if (this.muted) this.stopBGM();
  }

  dispose(): void {
    this.stopBGM();
    this.ctx?.close();
  }
}
