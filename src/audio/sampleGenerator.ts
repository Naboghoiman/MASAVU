/**
 * Synthesizer for high-energy DJ drops & performance sampler pads
 */

export interface GeneratedSample {
  id: string;
  name: string;
  category: 'drop' | 'fx' | 'vocal' | 'drum' | 'custom';
  color: string;
  audioBuffer: AudioBuffer;
  waveform: Float32Array;
  bpm: number;
}

function extractWaveform(buffer: AudioBuffer, points = 48): Float32Array {
  const output = new Float32Array(points);
  const data = buffer.getChannelData(0);
  const blockSize = Math.floor(data.length / points);
  for (let i = 0; i < points; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, data.length);
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += Math.abs(data[j]);
    }
    output[i] = Math.min(1.0, (sum / (end - start)) * 2.8);
  }
  return output;
}

/**
 * 1. Classic DJ Reggae Airhorn sound
 */
export function synthesizeAirhorn(audioCtx: AudioContext): GeneratedSample {
  const sampleRate = audioCtx.sampleRate;
  const duration = 0.9;
  const totalSamples = Math.round(duration * sampleRate);
  const buffer = audioCtx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Staccato blasts: 3 rapid bursts
  const burstTimes = [0.0, 0.18, 0.36];
  const burstDuration = 0.14;

  for (let s = 0; s < totalSamples; s++) {
    const t = s / sampleRate;
    let sample = 0;

    for (let b = 0; b < burstTimes.length; b++) {
      const bt = t - burstTimes[b];
      if (bt >= 0 && bt < burstDuration) {
        const env = Math.sin((bt / burstDuration) * Math.PI);
        // Multi-tone brass horn chords: F4, A4, C5 + detune
        const f1 = 349.23;
        const f2 = 440.0;
        const f3 = 523.25;
        const tone =
          Math.sin(2 * Math.PI * f1 * bt) * 0.4 +
          Math.sin(2 * Math.PI * f2 * bt * 1.01) * 0.35 +
          Math.sin(2 * Math.PI * f3 * bt * 0.99) * 0.3 +
          Math.sin(2 * Math.PI * f1 * 2 * bt) * 0.15; // harmonic
        sample += tone * env * 0.8;
      }
    }

    left[s] = Math.max(-1, Math.min(1, sample));
    right[s] = Math.max(-1, Math.min(1, sample * 0.95));
  }

  return {
    id: 'sample-airhorn',
    name: 'AIRHORN',
    category: 'drop',
    color: '#F59E0B', // Amber
    audioBuffer: buffer,
    waveform: extractWaveform(buffer),
    bpm: 128
  };
}

/**
 * 2. Club Rave Siren Sweep
 */
export function synthesizeSiren(audioCtx: AudioContext): GeneratedSample {
  const sampleRate = audioCtx.sampleRate;
  const duration = 1.2;
  const totalSamples = Math.round(duration * sampleRate);
  const buffer = audioCtx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  for (let s = 0; s < totalSamples; s++) {
    const t = s / sampleRate;
    const lfo = Math.sin(2 * Math.PI * 3.5 * t); // 3.5 Hz wail
    const freq = 650 + lfo * 280;
    const env = t < 0.05 ? t / 0.05 : Math.exp(-(t - 0.05) * 1.8);
    const wave = Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(2 * Math.PI * freq * 2 * t);
    left[s] = wave * env * 0.65;
    right[s] = wave * env * 0.65;
  }

  return {
    id: 'sample-siren',
    name: 'CLUB SIREN',
    category: 'fx',
    color: '#EF4444', // Red
    audioBuffer: buffer,
    waveform: extractWaveform(buffer),
    bpm: 128
  };
}

/**
 * 3. Electro Laser Zap
 */
export function synthesizeLaser(audioCtx: AudioContext): GeneratedSample {
  const sampleRate = audioCtx.sampleRate;
  const duration = 0.55;
  const totalSamples = Math.round(duration * sampleRate);
  const buffer = audioCtx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  for (let s = 0; s < totalSamples; s++) {
    const t = s / sampleRate;
    // Exponential pitch plunge from 3800Hz down to 80Hz
    const freq = 80 + 3720 * Math.exp(-t * 22);
    const env = Math.exp(-t * 8);
    const wave = Math.sin(2 * Math.PI * freq * t);
    left[s] = wave * env * 0.7;
    right[s] = wave * env * 0.7;
  }

  return {
    id: 'sample-laser',
    name: 'LASER ZAP',
    category: 'fx',
    color: '#06B6D4', // Cyan
    audioBuffer: buffer,
    waveform: extractWaveform(buffer),
    bpm: 128
  };
}

/**
 * 4. Vocal "DROP THE BASS" synthetic punch
 */
export function synthesizeVocalDrop(audioCtx: AudioContext): GeneratedSample {
  const sampleRate = audioCtx.sampleRate;
  const duration = 0.85;
  const totalSamples = Math.round(duration * sampleRate);
  const buffer = audioCtx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  for (let s = 0; s < totalSamples; s++) {
    const t = s / sampleRate;
    // Formant vocal synthesis
    const env = t < 0.04 ? t / 0.04 : Math.exp(-(t - 0.04) * 4);
    const f0 = 110 + 20 * Math.sin(t * 15);
    const vocal =
      Math.sin(2 * Math.PI * f0 * t) * 0.5 +
      Math.sin(2 * Math.PI * 750 * t) * 0.35 +
      Math.sin(2 * Math.PI * 1220 * t) * 0.25;
    const noise = (Math.random() * 2 - 1) * 0.15 * env;
    left[s] = (vocal + noise) * env * 0.8;
    right[s] = (vocal + noise) * env * 0.8;
  }

  return {
    id: 'sample-vocal-drop',
    name: 'DROP BASS',
    category: 'vocal',
    color: '#A855F7', // Purple
    audioBuffer: buffer,
    waveform: extractWaveform(buffer),
    bpm: 128
  };
}

/**
 * 5. Deep 808 Sub Boom Kick
 */
export function synthesize808Sub(audioCtx: AudioContext): GeneratedSample {
  const sampleRate = audioCtx.sampleRate;
  const duration = 0.95;
  const totalSamples = Math.round(duration * sampleRate);
  const buffer = audioCtx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  for (let s = 0; s < totalSamples; s++) {
    const t = s / sampleRate;
    const pitch = 46 + 120 * Math.exp(-t * 30);
    const click = t < 0.01 ? (Math.random() * 2 - 1) * (1 - t / 0.01) * 0.5 : 0;
    const body = Math.sin(2 * Math.PI * pitch * t);
    const env = Math.exp(-t * 4.2);
    left[s] = (body + click) * env * 0.85;
    right[s] = (body + click) * env * 0.85;
  }

  return {
    id: 'sample-808-sub',
    name: '808 BOOM',
    category: 'drum',
    color: '#3B82F6', // Blue
    audioBuffer: buffer,
    waveform: extractWaveform(buffer),
    bpm: 128
  };
}

/**
 * 6. Trap Clap / Snare
 */
export function synthesizeTrapClap(audioCtx: AudioContext): GeneratedSample {
  const sampleRate = audioCtx.sampleRate;
  const duration = 0.45;
  const totalSamples = Math.round(duration * sampleRate);
  const buffer = audioCtx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  for (let s = 0; s < totalSamples; s++) {
    const t = s / sampleRate;
    let burst = 0;
    // Flam bursts at 0, 0.015, 0.03
    if (t < 0.012) burst = 0.5;
    else if (t < 0.025) burst = 0.7;
    else burst = Math.exp(-(t - 0.025) * 18);

    const noise = (Math.random() * 2 - 1) * burst;
    const tonal = Math.sin(2 * Math.PI * 220 * t) * Math.exp(-t * 25) * 0.3;
    left[s] = (noise + tonal) * 0.75;
    right[s] = (noise + tonal) * 0.75;
  }

  return {
    id: 'sample-trap-clap',
    name: 'TRAP CLAP',
    category: 'drum',
    color: '#EC4899', // Pink
    audioBuffer: buffer,
    waveform: extractWaveform(buffer),
    bpm: 128
  };
}

/**
 * 7. Open Hi-Hat Metallic Sizzle
 */
export function synthesizeOpenHat(audioCtx: AudioContext): GeneratedSample {
  const sampleRate = audioCtx.sampleRate;
  const duration = 0.65;
  const totalSamples = Math.round(duration * sampleRate);
  const buffer = audioCtx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  for (let s = 0; s < totalSamples; s++) {
    const t = s / sampleRate;
    const env = Math.exp(-t * 9);
    // 6 inharmonic square wave metallic ratios
    const metallic =
      (Math.sin(2 * Math.PI * 2400 * t) > 0 ? 1 : -1) * 0.2 +
      (Math.sin(2 * Math.PI * 3700 * t) > 0 ? 1 : -1) * 0.2 +
      (Math.sin(2 * Math.PI * 5200 * t) > 0 ? 1 : -1) * 0.2 +
      (Math.random() * 2 - 1) * 0.4;
    left[s] = metallic * env * 0.6;
    right[s] = metallic * env * 0.6;
  }

  return {
    id: 'sample-open-hat',
    name: 'OPEN HAT',
    category: 'drum',
    color: '#10B981', // Emerald
    audioBuffer: buffer,
    waveform: extractWaveform(buffer),
    bpm: 128
  };
}

/**
 * 8. Explosive Crash Cymbal
 */
export function synthesizeCrashCymbal(audioCtx: AudioContext): GeneratedSample {
  const sampleRate = audioCtx.sampleRate;
  const duration = 1.6;
  const totalSamples = Math.round(duration * sampleRate);
  const buffer = audioCtx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  for (let s = 0; s < totalSamples; s++) {
    const t = s / sampleRate;
    const initialAttack = t < 0.02 ? t / 0.02 : 1;
    const decay = Math.exp(-t * 2.8);
    const noise = (Math.random() * 2 - 1) * initialAttack * decay;
    const shimmer = Math.sin(2 * Math.PI * 6800 * t) * decay * 0.15;
    left[s] = (noise + shimmer) * 0.7;
    right[s] = (noise + shimmer) * 0.7;
  }

  return {
    id: 'sample-crash',
    name: 'CRASH CYMBAL',
    category: 'drum',
    color: '#F97316', // Orange
    audioBuffer: buffer,
    waveform: extractWaveform(buffer),
    bpm: 128
  };
}

export function getDefaultSamplerPresets(audioCtx: AudioContext): GeneratedSample[] {
  return [
    synthesizeAirhorn(audioCtx),
    synthesizeSiren(audioCtx),
    synthesizeLaser(audioCtx),
    synthesizeVocalDrop(audioCtx),
    synthesize808Sub(audioCtx),
    synthesizeTrapClap(audioCtx),
    synthesizeOpenHat(audioCtx),
    synthesizeCrashCymbal(audioCtx)
  ];
}
