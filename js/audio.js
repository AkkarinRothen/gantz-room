// Web Audio API Procedural Synth for Gantz Web Cloud
class GantzAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isMuted = false;
    this.radioPlaying = false;
    this.radioTimeouts = [];
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  getDestination() {
    this.init();
    return this.masterGain || this.ctx.destination;
  }

  setMasterVolume(vol) {
    this.init();
    this.volume = Math.max(0, Math.min(1, parseFloat(vol) || 0));
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  playAssetSound(filename, fallbackFn) {
    if (this.isMuted) return;
    const path = `assets/audio/${filename}`;
    const audio = new Audio(path);
    audio.volume = this.volume !== undefined ? this.volume : 1.0;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        if (typeof fallbackFn === 'function') {
          fallbackFn.call(this);
        }
      });
    }
  }

  stopAll() {
    this.radioPlaying = false;
    this.radioTimeouts.forEach(t => clearTimeout(t));
    this.radioTimeouts = [];
  }

  playClick() {
    if (this.isMuted) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200 + Math.random() * 400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.03);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);

    osc.connect(gain);
    gain.connect(this.getDestination());

    osc.start();
    osc.stop(this.ctx.currentTime + 0.035);
  }

  playTypewriter() {
    if (this.isMuted) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime);
    osc.frequency.setValueAtTime(1760, this.ctx.currentTime + 0.015);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);

    osc.connect(gain);
    gain.connect(this.getDestination());

    osc.start();
    osc.stop(this.ctx.currentTime + 0.035);
  }

  playSphereBoot() {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;
    
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(55, now);
    subOsc.frequency.exponentialRampToValueAtTime(110, now + 1.2);
    subGain.gain.setValueAtTime(0.25, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    subOsc.connect(subGain);
    subGain.connect(this.getDestination());
    subOsc.start(now);
    subOsc.stop(now + 1.5);

    const freqs = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.08);
      gain.gain.setValueAtTime(0.15, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 1.2);
      osc.connect(gain);
      gain.connect(this.getDestination());
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 1.3);
    });
  }

  playCountdownBeep(high = false) {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(high ? 1760 : 880, now);
    gain.gain.setValueAtTime(high ? 0.2 : 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.getDestination());

    osc.start(now);
    osc.stop(now + 0.16);
  }

  playAlarm() {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      const t = now + i * 0.22;
      osc.frequency.setValueAtTime(1100, t);
      osc.frequency.linearRampToValueAtTime(650, t + 0.15);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain);
      gain.connect(this.getDestination());
      osc.start(t);
      osc.stop(t + 0.2);
    }
  }

  playTransferEffect() {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(4000, now + 1.2);
    osc.frequency.linearRampToValueAtTime(150, now + 1.6);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 1.0);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

    osc.connect(gain);
    gain.connect(this.getDestination());
    osc.start(now);
    osc.stop(now + 1.85);

    const bufferSize = this.ctx.sampleRate * 1.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.05, now + 0.6);
    noiseGain.gain.linearRampToValueAtTime(0.2, now + 1.2);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.7);

    whiteNoise.connect(noiseGain);
    noiseGain.connect(this.getDestination());
    whiteNoise.start(now + 0.6);
    whiteNoise.stop(now + 1.75);
  }

  playScoreJingle() {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;
    const notes = [
      { f: 523.25, d: 0.12 },
      { f: 659.25, d: 0.12 },
      { f: 783.99, d: 0.12 },
      { f: 1046.50, d: 0.35 }
    ];
    let offset = 0;
    notes.forEach(n => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, now + offset);
      gain.gain.setValueAtTime(0.2, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + n.d);
      osc.connect(gain);
      gain.connect(this.getDestination());
      osc.start(now + offset);
      osc.stop(now + offset + n.d + 0.05);
      offset += n.d * 0.8;
    });
  }

  playRadioTaisou() {
    if (this.isMuted) return;
    this.stopRadio();
    this.init();
    this.radioPlaying = true;

    const N = {
      C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
      G4: 392.00, A4: 440.00, B4: 493.88, C5: 523.25,
      D5: 587.33, E5: 659.25, G5: 783.99
    };

    const score = [
      { n: N.G4, d: 0.28 }, { n: N.C5, d: 0.28 }, { n: N.E5, d: 0.28 }, { n: N.G5, d: 0.5 },
      { n: N.E5, d: 0.28 }, { n: N.C5, d: 0.28 }, { n: N.D5, d: 0.5 },
      { n: N.G4, d: 0.28 }, { n: N.D5, d: 0.28 }, { n: N.F4, d: 0.28 }, { n: N.G5, d: 0.5 },
      { n: N.D5, d: 0.28 }, { n: N.B4, d: 0.28 }, { n: N.C5, d: 0.6 }
    ];

    let currentDelay = 0;
    score.forEach(item => {
      const tid = setTimeout(() => {
        if (!this.radioPlaying) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(item.n, now);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + item.d);

        osc.connect(gain);
        gain.connect(this.getDestination());

        osc.start(now);
        osc.stop(now + item.d + 0.05);
      }, currentDelay * 1000);

      this.radioTimeouts.push(tid);
      currentDelay += item.d + 0.08;
    });

    const endTid = setTimeout(() => {
      this.radioPlaying = false;
    }, currentDelay * 1000);
    this.radioTimeouts.push(endTid);
  }

  stopRadio() {
    this.radioPlaying = false;
    this.radioTimeouts.forEach(tid => clearTimeout(tid));
    this.radioTimeouts = [];
  }

  // ------------------ SPATIAL REVERB CONVOLVER & FM SYNTH ENGINE ------------------
  createReverbNode(duration = 1.6, decay = 2.2) {
    if (!this.ctx) return null;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = (length - i) / length;
      left[i] = (Math.random() * 2 - 1) * Math.pow(n, decay);
      right[i] = (Math.random() * 2 - 1) * Math.pow(n, decay);
    }

    const convolver = this.ctx.createConvolver();
    convolver.buffer = impulse;
    return convolver;
  }

  // ------------------ GANTZ WEAPON SYNTHESIZERS ------------------
  // 1. X-Gun: FM Synthesis + High-frequency capacitor charge + 2.5s DELAYED EXPLOSION!
  playXGun() {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;

    // A. Capacitor Whine (Charging)
    const chargeOsc = this.ctx.createOscillator();
    const chargeGain = this.ctx.createGain();
    chargeOsc.type = 'sine';
    chargeOsc.frequency.setValueAtTime(600, now);
    chargeOsc.frequency.exponentialRampToValueAtTime(4200, now + 0.18);
    chargeGain.gain.setValueAtTime(0.2, now);
    chargeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    chargeOsc.connect(chargeGain);
    chargeGain.connect(this.getDestination());
    chargeOsc.start(now);
    chargeOsc.stop(now + 0.22);

    // B. FM Laser Burst (Carrier + Modulator)
    const carrier = this.ctx.createOscillator();
    const modulator = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const mainGain = this.ctx.createGain();

    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(1400, now + 0.05);
    carrier.frequency.exponentialRampToValueAtTime(180, now + 0.35);

    modulator.type = 'sine';
    modulator.frequency.setValueAtTime(280, now + 0.05);
    modGain.gain.setValueAtTime(600, now + 0.05);

    modulator.connect(carrier.frequency);

    mainGain.gain.setValueAtTime(0.4, now + 0.05);
    mainGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    carrier.connect(mainGain);
    mainGain.connect(this.getDestination());

    modulator.start(now + 0.05);
    carrier.start(now + 0.05);
    modulator.stop(now + 0.42);
    carrier.stop(now + 0.42);

    // C. Delayed 2.5 second Internal Thermal Explosion with Spatial Reverb
    setTimeout(() => {
      if (!this.ctx) return;
      const boomTime = this.ctx.currentTime;
      
      // Low bass shockwave
      const boomOsc = this.ctx.createOscillator();
      const boomGain = this.ctx.createGain();
      boomOsc.type = 'sine';
      boomOsc.frequency.setValueAtTime(160, boomTime);
      boomOsc.frequency.exponentialRampToValueAtTime(25, boomTime + 1.1);

      boomGain.gain.setValueAtTime(0.65, boomTime);
      boomGain.gain.exponentialRampToValueAtTime(0.001, boomTime + 1.15);

      const reverb = this.createReverbNode(1.8, 2.5);
      if (reverb) {
        boomOsc.connect(boomGain);
        boomGain.connect(reverb);
        reverb.connect(this.getDestination());
      } else {
        boomOsc.connect(boomGain);
        boomGain.connect(this.getDestination());
      }

      boomOsc.start(boomTime);
      boomOsc.stop(boomTime + 1.2);

      // Organic rupture noise crackle
      const bufferSize = this.ctx.sampleRate * 0.9;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.3));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.45, boomTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, boomTime + 0.85);

      noise.connect(noiseGain);
      noiseGain.connect(this.getDestination());
      noise.start(boomTime);
      noise.stop(boomTime + 0.9);
    }, 2500);
  }

  // 1b. Z-Gun: Heavy Gravitational Compression Cannon
  playZGun() {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;

    const gravOsc = this.ctx.createOscillator();
    const gravGain = this.ctx.createGain();
    gravOsc.type = 'sawtooth';
    gravOsc.frequency.setValueAtTime(50, now);
    gravOsc.frequency.exponentialRampToValueAtTime(600, now + 0.2);
    gravOsc.frequency.exponentialRampToValueAtTime(20, now + 1.2);

    gravGain.gain.setValueAtTime(0.7, now);
    gravGain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

    const reverb = this.createReverbNode(2.2, 2.0);
    if (reverb) {
      gravOsc.connect(gravGain);
      gravGain.connect(reverb);
      reverb.connect(this.getDestination());
    } else {
      gravOsc.connect(gravGain);
      gravGain.connect(this.getDestination());
    }

    gravOsc.start(now);
    gravOsc.stop(now + 1.35);
  }

  // 2. Y-Gun: Three latch anchor cables + warp tone
  playYGun() {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;

    // 3 rapid anchor clicks
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1800 + i * 400, t);
      osc.frequency.exponentialRampToValueAtTime(400, t + 0.06);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

      osc.connect(gain);
      gain.connect(this.getDestination());
      osc.start(t);
      osc.stop(t + 0.08);
    }

    // Warp beam tone
    const warpOsc = this.ctx.createOscillator();
    const warpGain = this.ctx.createGain();
    warpOsc.type = 'sawtooth';
    warpOsc.frequency.setValueAtTime(300, now + 0.3);
    warpOsc.frequency.exponentialRampToValueAtTime(3500, now + 1.1);

    warpGain.gain.setValueAtTime(0.2, now + 0.3);
    warpGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    warpOsc.connect(warpGain);
    warpGain.connect(this.getDestination());
    warpOsc.start(now + 0.3);
    warpOsc.stop(now + 1.25);
  }

  // 3. Gantz Suit: Muscle servo charge surge
  playSuitSurge() {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.linearRampToValueAtTime(450, now + 0.4);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.9);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

    osc.connect(gain);
    gain.connect(this.getDestination());
    osc.start(now);
    osc.stop(now + 1.0);
  }

  // 4. Gantz Sword: Metallic extension & slash
  playSwordSlash() {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;

    // Metallic ring
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(3200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.getDestination());
    osc.start(now);
    osc.stop(now + 0.38);

    // Whoosh
    const bufferSize = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, now + 0.05);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    noise.connect(noiseGain);
    noiseGain.connect(this.getDestination());
    noise.start(now + 0.05);
    noise.stop(now + 0.28);
  }

  // 5. Tactical Optical Scan / Inspection Zoom Lock-on Sound
  playTacticalScan() {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;

    // High tech optical lock-on chirp sequence
    const freqs = [1500, 2200, 3100, 4400];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.045;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 1.25, t + 0.04);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

      osc.connect(gain);
      gain.connect(this.getDestination());
      osc.start(t);
      osc.stop(t + 0.05);
    });

    // Sub sonar pulse
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(60, now + 0.35);
    subGain.gain.setValueAtTime(0.3, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    subOsc.connect(subGain);
    subGain.connect(this.getDestination());
    subOsc.start(now);
    subOsc.stop(now + 0.38);
  }

  // 6. Tactical Radar Ping (Discrete, non-intrusive sci-fi sonar ping)
  playRadarPing() {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1760, now); // A6
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.getDestination());
    osc.start(now);
    osc.stop(now + 0.25);
  }

  // 7. Tactical Radar Danger Threshold Alert (3-burst gentle sci-fi chime: pip-pip-pip)
  playRadarThresholdAlert() {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;

    [0, 0.08, 0.16].forEach((offset, idx) => {
      const t = now + offset;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const freq = 2000 + idx * 250;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.9, t + 0.045);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      osc.connect(gain);
      gain.connect(this.getDestination());
      osc.start(t);
      osc.stop(t + 0.06);
    });
  }

  // 8. Tactical Radar Signal Lost / Stealth Glitch
  playRadarSignalLost() {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.18);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.getDestination());
    osc.start(now);
    osc.stop(now + 0.22);
  }

  // 9. Z-Gun (Heavy Gravity Compression Blast)
  playZGun() {
    if (this.isMuted) return;
    this.playAssetSound('zgun.mp3', () => {
      this.init();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 1.2);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
      osc.connect(gain);
      gain.connect(this.getDestination());
      osc.start(now);
      osc.stop(now + 1.4);
    });
  }

  // 10. ElevenLabs Pre-rendered Gantz Voice Lines
  playVoiceLine(key) {
    if (this.isMuted) return;
    this.playAssetSound(`voice_${key}.mp3`, () => {
      console.warn(`[GantzAudio] Voice line voice_${key}.mp3 not loaded`);
    });
  }

  // 11. Suit Breach (Nodes Overload & Blue Fluid Burst)
  playSuitBreach() {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;

    // High frequency pop
    const popOsc = this.ctx.createOscillator();
    const popGain = this.ctx.createGain();
    popOsc.type = 'square';
    popOsc.frequency.setValueAtTime(2400, now);
    popOsc.frequency.exponentialRampToValueAtTime(120, now + 0.12);
    popGain.gain.setValueAtTime(0.35, now);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    popOsc.connect(popGain);
    popGain.connect(this.getDestination());
    popOsc.start(now);
    popOsc.stop(now + 0.16);

    // Liquid hiss & failure hum
    const humOsc = this.ctx.createOscillator();
    const humGain = this.ctx.createGain();
    humOsc.type = 'sawtooth';
    humOsc.frequency.setValueAtTime(95, now + 0.08);
    humOsc.frequency.linearRampToValueAtTime(60, now + 0.6);
    humGain.gain.setValueAtTime(0.001, now);
    humGain.gain.setValueAtTime(0.28, now + 0.08);
    humGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    humOsc.connect(humGain);
    humGain.connect(this.getDestination());
    humOsc.start(now + 0.08);
    humOsc.stop(now + 0.7);
  }

  // 12. X-Gun / X-Rifle Delayed Molecular Detonation
  playDelayedExplosion() {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;

    // 3 Inward suction pulses
    [0, 0.12, 0.24].forEach((offset, idx) => {
      const t = now + offset;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180 + idx * 80, t);
      osc.frequency.exponentialRampToValueAtTime(800 + idx * 200, t + 0.09);
      gain.gain.setValueAtTime(0.15 + idx * 0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.connect(gain);
      gain.connect(this.getDestination());
      osc.start(t);
      osc.stop(t + 0.11);
    });

    // Heavy delayed blast at +0.38s
    const blastT = now + 0.38;
    const blastOsc = this.ctx.createOscillator();
    const blastGain = this.ctx.createGain();
    blastOsc.type = 'sawtooth';
    blastOsc.frequency.setValueAtTime(320, blastT);
    blastOsc.frequency.exponentialRampToValueAtTime(30, blastT + 0.9);
    blastGain.gain.setValueAtTime(0.45, blastT);
    blastGain.gain.exponentialRampToValueAtTime(0.001, blastT + 0.95);
    blastOsc.connect(blastGain);
    blastGain.connect(this.getDestination());
    blastOsc.start(blastT);
    blastOsc.stop(blastT + 1.0);
  }

  // 13. Horror & Panic Glitch Alert
  playPanicAlert() {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;

    // Dissonant tritone chord
    [440, 622.25, 880].forEach(f => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * 0.92, now + 0.45);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.connect(gain);
      gain.connect(this.getDestination());
      osc.start(now);
      osc.stop(now + 0.55);
    });
  }
}

window.GantzAudio = new GantzAudioEngine();
