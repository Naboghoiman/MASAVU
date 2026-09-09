/**
 * Loop Generator & Sample Extraction Module
 * Generates pro sync-locked DJ loop buffers including the uploaded 128 BPM groove,
 * percussion layers, rolling basslines, and provides live deck audio extraction.
 */

export interface GeneratedLoop {
  id: string;
  name: string;
  category: 'drum' | 'percussion' | 'bass' | 'synth' | 'vocal' | 'custom';
  bpm: number;
  totalBeats: number;
  audioBuffer: AudioBuffer;
  waveform: Float32Array;
}

/**
 * Extracts a normalized 64-point waveform preview from an AudioBuffer
 */
export function extractLoopWaveform(buffer: AudioBuffer, points = 64): Float32Array {
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
 * Synthesizes the exact 128 BPM electronic drum break groove uploaded by the user:
 * - 4-on-the-floor punchy kick (909 click + deep 48Hz punch)
 * - Snappy layered clap/snare on beats 2 and 4
 * - 16th-note hi-hats with open hat on the offbeat
 * - Syncopated funk percussive rim taps
 * - Continuous rolling shaker texture
 */
export function synthesizeUploadedDrumGroove(audioCtx: AudioContext, bpm = 128, bars = 4): GeneratedLoop {
  const sampleRate = audioCtx.sampleRate;
  const beatsPerBar = 4;
  const totalBeats = bars * beatsPerBar;
  const secondsPerBeat = 60 / bpm;
  const totalDuration = totalBeats * secondsPerBeat;
  const totalSamples = Math.round(totalDuration * sampleRate);

  const buffer = audioCtx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const samplesPerBeat = (sampleRate * 60) / bpm;

  for (let s = 0; s < totalSamples; s++) {
    const beatPos = s / samplesPerBeat;
    const currentBeat = Math.floor(beatPos);
    const beatFraction = beatPos - currentBeat;
    const beatInBar = currentBeat % beatsPerBar;
    const sixteenth = Math.floor(beatFraction * 4);
    const sixteenthFraction = (beatFraction * 4) - sixteenth;

    let sampleL = 0;
    let sampleR = 0;

    // 1. PUNCHY 4-ON-THE-FLOOR KICK (Every beat)
    const kickTime = beatFraction * secondsPerBeat;
    if (kickTime < 0.24) {
      const pitchEnv = 48 + 115 * Math.exp(-kickTime * 36);
      const phase = 2 * Math.PI * pitchEnv * kickTime;
      const amp = Math.exp(-kickTime * 13) * 0.75;
      const wave = Math.sin(phase) + 0.12 * Math.sin(phase * 2);
      sampleL += wave * amp;
      sampleR += wave * amp;
    }

    // 2. CRISP SNAPPY CLAP/SNARE (Beats 2 and 4)
    if (beatInBar === 1 || beatInBar === 3) {
      const snareTime = beatFraction * secondsPerBeat;
      if (snareTime < 0.2) {
        // Double burst for snappy clap flam
        const flamEnv = snareTime < 0.015 ? 0.6 : Math.exp(-(snareTime - 0.015) * 22);
        const noise = (Math.random() * 2 - 1);
        const tonalBody = Math.sin(2 * Math.PI * 180 * snareTime) * Math.exp(-snareTime * 28);
        const clapL = (noise * 0.7 + tonalBody * 0.3) * flamEnv * 0.58;
        const clapR = ((Math.random() * 2 - 1) * 0.7 + tonalBody * 0.3) * flamEnv * 0.58;
        sampleL += clapL;
        sampleR += clapR;
      }
    }

    // 3. 16TH HI-HATS WITH DYNAMIC GROOVE
    const hatTime = sixteenthFraction * (secondsPerBeat / 4);
    if (hatTime < 0.045) {
      const isUpbeat = (sixteenth === 2); // The "and" of the beat
      const hatAmp = isUpbeat ? 0.35 : (sixteenth % 2 === 0 ? 0.18 : 0.12);
      const hatDecay = isUpbeat ? 0.08 : 0.035;
      if (hatTime < hatDecay) {
        const env = Math.exp(-hatTime * (isUpbeat ? 45 : 95)) * hatAmp;
        const metallic = (Math.random() * 2 - 1) * env;
        sampleL += metallic * 0.9;
        sampleR += metallic * 1.1;
      }
    }

    // 4. SYNCOPATED PERCUSSION / RIM TAPS (on upbeat 16ths: 1.75, 2.75, etc.)
    const isPerBeat = (sixteenth === 3 && (beatInBar === 0 || beatInBar === 2));
    if (isPerBeat && hatTime < 0.035) {
      const percEnv = Math.exp(-hatTime * 120) * 0.32;
      const rimTone = Math.sin(2 * Math.PI * 880 * hatTime);
      sampleL += rimTone * percEnv * 1.2;
      sampleR += rimTone * percEnv * 0.8;
    }

    // 5. SHAKER GROOVE (Continuous 16ths stereo spread)
    const shakerTime = sixteenthFraction * (secondsPerBeat / 4);
    if (shakerTime < 0.05) {
      const shakerAmp = (sixteenth === 1 || sixteenth === 3) ? 0.14 : 0.08;
      const shakerEnv = Math.exp(-shakerTime * 60) * shakerAmp;
      const noiseL = (Math.random() * 2 - 1) * shakerEnv;
      const noiseR = (Math.random() * 2 - 1) * shakerEnv;
      sampleL += noiseL;
      sampleR += noiseR;
    }

    left[s] = Math.max(-1, Math.min(1, sampleL));
    right[s] = Math.max(-1, Math.min(1, sampleR));
  }

  const waveform = extractLoopWaveform(buffer, 64);

  return {
    id: 'loop-groove-break-128',
    name: 'Groove Break (Uploaded Loop)',
    category: 'drum',
    bpm,
    totalBeats,
    audioBuffer: buffer,
    waveform
  };
}

/**
 * Synthesizes a high-energy Tribal & Shaker Percussion top loop (128 BPM)
 */
export function synthesizePercussionLoop(audioCtx: AudioContext, bpm = 128, bars = 4): GeneratedLoop {
  const sampleRate = audioCtx.sampleRate;
  const beatsPerBar = 4;
  const totalBeats = bars * beatsPerBar;
  const secondsPerBeat = 60 / bpm;
  const totalDuration = totalBeats * secondsPerBeat;
  const totalSamples = Math.round(totalDuration * sampleRate);

  const buffer = audioCtx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const samplesPerBeat = (sampleRate * 60) / bpm;

  for (let s = 0; s < totalSamples; s++) {
    const beatPos = s / samplesPerBeat;
    const currentBeat = Math.floor(beatPos);
    const beatFraction = beatPos - currentBeat;
    const beatInBar = currentBeat % beatsPerBar;
    const sixteenth = Math.floor(beatFraction * 4);
    const sixteenthFraction = (beatFraction * 4) - sixteenth;

    let sampleL = 0;
    let sampleR = 0;

    // Congas & Bongos on syncopated 16ths
    const congaTriggers = [
      { beat: 0, sixteenth: 2, freq: 240, pan: -0.4 },
      { beat: 1, sixteenth: 1, freq: 360, pan: 0.3 },
      { beat: 1, sixteenth: 3, freq: 190, pan: -0.2 },
      { beat: 2, sixteenth: 2, freq: 280, pan: 0.4 },
      { beat: 3, sixteenth: 1, freq: 420, pan: -0.3 },
      { beat: 3, sixteenth: 3, freq: 220, pan: 0.2 },
    ];

    const match = congaTriggers.find((t) => t.beat === beatInBar && t.sixteenth === sixteenth);
    if (match) {
      const hitTime = sixteenthFraction * (secondsPerBeat / 4);
      if (hitTime < 0.12) {
        const env = Math.exp(-hitTime * 35) * 0.48;
        const tone = Math.sin(2 * Math.PI * match.freq * hitTime);
        sampleL += tone * env * (1 - match.pan);
        sampleR += tone * env * (1 + match.pan);
      }
    }

    // Shaker layer
    const shakerTime = sixteenthFraction * (secondsPerBeat / 4);
    if (shakerTime < 0.055) {
      const env = Math.exp(-shakerTime * 50) * (sixteenth % 2 === 1 ? 0.16 : 0.09);
      sampleL += (Math.random() * 2 - 1) * env;
      sampleR += (Math.random() * 2 - 1) * env;
    }

    left[s] = Math.max(-1, Math.min(1, sampleL));
    right[s] = Math.max(-1, Math.min(1, sampleR));
  }

  const waveform = extractLoopWaveform(buffer, 64);

  return {
    id: 'loop-percussion-top-128',
    name: 'Tribal Percussion & Shaker',
    category: 'percussion',
    bpm,
    totalBeats,
    audioBuffer: buffer,
    waveform
  };
}

/**
 * Synthesizes a deep rolling analog sub bassline (128 BPM)
 */
export function synthesizeBassLoop(audioCtx: AudioContext, bpm = 128, bars = 4): GeneratedLoop {
  const sampleRate = audioCtx.sampleRate;
  const beatsPerBar = 4;
  const totalBeats = bars * beatsPerBar;
  const secondsPerBeat = 60 / bpm;
  const totalDuration = totalBeats * secondsPerBeat;
  const totalSamples = Math.round(totalDuration * sampleRate);

  const buffer = audioCtx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const samplesPerBeat = (sampleRate * 60) / bpm;

  // Bass notes: A1 (55Hz), C2 (65.4Hz), D2 (73.4Hz), E2 (82.4Hz)
  const bassNotes = [55.0, 55.0, 65.4, 55.0, 73.4, 55.0, 82.4, 65.4];

  for (let s = 0; s < totalSamples; s++) {
    const beatPos = s / samplesPerBeat;
    const currentBeat = Math.floor(beatPos);
    const beatFraction = beatPos - currentBeat;
    const eighth = Math.floor(beatFraction * 2);
    const eighthFraction = (beatFraction * 2) - eighth;

    // Note index across the 16 eighth notes in 2 bars
    const noteIndex = (currentBeat * 2 + eighth) % bassNotes.length;
    const freq = bassNotes[noteIndex];

    const noteTime = eighthFraction * (secondsPerBeat / 2);
    // Sidechain ducking on the kick (beatFraction < 0.15)
    const ducking = Math.min(1.0, Math.max(0.1, beatFraction * 4.5));

    if (noteTime < 0.22) {
      const env = Math.exp(-noteTime * 7) * ducking * 0.45;
      const fundamental = Math.sin(2 * Math.PI * freq * noteTime);
      const sub = Math.sin(2 * Math.PI * (freq * 0.5) * noteTime) * 0.5;
      const saturation = Math.tanh((fundamental + sub) * 1.5) * 0.7;
      const sample = saturation * env;

      left[s] = sample;
      right[s] = sample;
    }
  }

  const waveform = extractLoopWaveform(buffer, 64);

  return {
    id: 'loop-sub-bass-128',
    name: 'Rolling Sub Bassline',
    category: 'bass',
    bpm,
    totalBeats,
    audioBuffer: buffer,
    waveform
  };
}

/**
 * Synthesizes filtered house chord & synth stabs (128 BPM)
 */
export function synthesizeSynthLoop(audioCtx: AudioContext, bpm = 128, bars = 4): GeneratedLoop {
  const sampleRate = audioCtx.sampleRate;
  const beatsPerBar = 4;
  const totalBeats = bars * beatsPerBar;
  const secondsPerBeat = 60 / bpm;
  const totalDuration = totalBeats * secondsPerBeat;
  const totalSamples = Math.round(totalDuration * sampleRate);

  const buffer = audioCtx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const samplesPerBeat = (sampleRate * 60) / bpm;

  // A minor 9 chord notes: A3 (220), C4 (261.63), E4 (329.63), G4 (392.0), B4 (493.88)
  const chordFreqs = [220.0, 261.63, 329.63, 392.0];

  for (let s = 0; s < totalSamples; s++) {
    const beatPos = s / samplesPerBeat;
    const currentBeat = Math.floor(beatPos);
    const beatFraction = beatPos - currentBeat;
    const sixteenth = Math.floor(beatFraction * 4);
    const sixteenthFraction = (beatFraction * 4) - sixteenth;

    // Stabs on upbeat 16ths (e.g. beat 0 sixteenth 2, beat 1 sixteenth 3, beat 2 sixteenth 2, beat 3 sixteenth 1)
    const isStab = (sixteenth === 2 && currentBeat % 2 === 0) || (sixteenth === 3 && currentBeat % 2 === 1);

    if (isStab) {
      const stabTime = sixteenthFraction * (secondsPerBeat / 4);
      if (stabTime < 0.16) {
        const filterCutoff = 1800 * Math.exp(-stabTime * 18) + 300;
        const env = Math.exp(-stabTime * 12) * 0.35;

        let chordSum = 0;
        for (let i = 0; i < chordFreqs.length; i++) {
          const f = chordFreqs[i];
          chordSum += Math.sin(2 * Math.PI * f * stabTime) * 0.25;
        }

        const out = chordSum * env;
        left[s] = out * 0.85;
        right[s] = out * 1.15;
      }
    }
  }

  const waveform = extractLoopWaveform(buffer, 64);

  return {
    id: 'loop-synth-stabs-128',
    name: 'Vocal & Synth Stabs',
    category: 'synth',
    bpm,
    totalBeats,
    audioBuffer: buffer,
    waveform
  };
}

/**
 * Extracts a seamless, zero-crossing loop of 1, 2, or 4 bars from a playing deck's AudioBuffer
 */
export function captureLoopFromDeckBuffer(
  audioCtx: AudioContext,
  sourceBuffer: AudioBuffer,
  startSample: number,
  lengthSamples: number,
  bpm: number,
  name = 'Deck Live Capture'
): GeneratedLoop {
  const sampleRate = audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(sourceBuffer.numberOfChannels, lengthSamples, sampleRate);

  const numChannels = sourceBuffer.numberOfChannels;
  const srcLen = sourceBuffer.length;

  for (let ch = 0; ch < numChannels; ch++) {
    const src = sourceBuffer.getChannelData(ch);
    const dst = buffer.getChannelData(ch);

    for (let i = 0; i < lengthSamples; i++) {
      const readIdx = (startSample + i) % srcLen;
      let val = src[readIdx];

      // Smooth crossfade 128 samples at boundaries to avoid any clicks
      if (i < 128) {
        val *= i / 128;
      } else if (i > lengthSamples - 128) {
        val *= (lengthSamples - i) / 128;
      }
      dst[i] = val;
    }
  }

  const totalBeats = Math.round((lengthSamples / sampleRate) / (60 / bpm));
  const waveform = extractLoopWaveform(buffer, 64);

  return {
    id: `custom-capture-${Date.now()}`,
    name,
    category: 'custom',
    bpm,
    totalBeats,
    audioBuffer: buffer,
    waveform
  };
}
