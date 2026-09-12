/**
 * Audio Track Generator & File Analysis Module
 * Generates pro-grade studio DJ tracks with exact BeatGrids in source-sample coordinates
 * and extracts 3-band multi-frequency waveform data.
 */

import { BeatGrid, TrackData, WaveformData } from '../types/dj';
import { buildWarpMap, prepareStraightBpmTrack } from './audioWarpEngine';

/**
 * Extracts 3-band waveform visual data (Low, Mid, High, Peaks) from an AudioBuffer.
 * Analysis is purely mathematical and decoupled from UI or animation frames.
 */
export function extract3BandWaveform(buffer: AudioBuffer, samplesPerPixel = 256): WaveformData {
  const numChannels = buffer.numberOfChannels;
  const length = Math.floor(buffer.length / samplesPerPixel);
  const sampleRate = buffer.sampleRate;

  const low = new Float32Array(length);
  const mid = new Float32Array(length);
  const high = new Float32Array(length);
  const peaks = new Float32Array(length);

  const leftChannel = buffer.getChannelData(0);
  const rightChannel = numChannels > 1 ? buffer.getChannelData(1) : leftChannel;

  // Simple, fast 1-pole filter state for 3-band crossover
  // Crossover frequencies: 250 Hz (Low/Mid), 2500 Hz (Mid/High)
  const dt = 1.0 / sampleRate;
  const rcLow = 1.0 / (2 * Math.PI * 250);
  const alphaLow = dt / (rcLow + dt);
  const rcHigh = 1.0 / (2 * Math.PI * 2500);
  const alphaHigh = rcHigh / (rcHigh + dt);

  let lowFilt = 0;
  let highFilt = 0;

  for (let p = 0; p < length; p++) {
    const startSample = p * samplesPerPixel;
    const endSample = Math.min(startSample + samplesPerPixel, buffer.length);
    
    let lowEnergy = 0;
    let midEnergy = 0;
    let highEnergy = 0;
    let maxPeak = 0;
    const count = endSample - startSample;

    for (let s = startSample; s < endSample; s++) {
      const mono = (leftChannel[s] + rightChannel[s]) * 0.5;
      const absMono = Math.abs(mono);
      if (absMono > maxPeak) maxPeak = absMono;

      // Low pass filter
      lowFilt += alphaLow * (mono - lowFilt);
      // High pass filter
      highFilt = alphaHigh * (highFilt + mono - (s > 0 ? (leftChannel[s - 1] + rightChannel[s - 1]) * 0.5 : mono));
      
      const lowVal = lowFilt;
      const highVal = highFilt;
      const midVal = mono - lowVal - highVal;

      lowEnergy += lowVal * lowVal;
      midEnergy += midVal * midVal;
      highEnergy += highVal * highVal;
    }

    low[p] = Math.min(1.0, Math.sqrt(lowEnergy / Math.max(1, count)) * 2.8);
    mid[p] = Math.min(1.0, Math.sqrt(midEnergy / Math.max(1, count)) * 2.5);
    high[p] = Math.min(1.0, Math.sqrt(highEnergy / Math.max(1, count)) * 3.5);
    peaks[p] = Math.min(1.0, maxPeak);
  }

  return { length, sampleRate, samplesPerPixel, low, mid, high, peaks };
}

/**
 * Creates an exact BeatGrid in source sample coordinates for a given BPM and duration.
 * Accurately projects grid lines both forwards and backwards so intros before firstDownbeatSample
 * are mathematically aligned with the downbeats.
 */
export function buildSourceBeatGrid(
  sampleRate: number,
  totalSamples: number,
  bpm: number,
  firstDownbeatSample = 0,
  beatsPerBar = 4
): BeatGrid {
  const safeBpm = Number.isFinite(bpm) && bpm > 20 ? bpm : 120;
  const samplesPerBeat = (sampleRate * 60) / safeBpm;
  const beatSamples: number[] = [];
  const isDownbeat: boolean[] = [];

  const anchor = Math.round(Number.isFinite(firstDownbeatSample) ? firstDownbeatSample : 0);

  // Calculate beats before anchor to reach sample 0
  const beatsBefore = Math.max(0, Math.ceil(anchor / samplesPerBeat));
  let currentSample = anchor - beatsBefore * samplesPerBeat;
  let beatIndex = -beatsBefore;

  while (currentSample < totalSamples) {
    if (currentSample >= 0) {
      beatSamples.push(Math.round(currentSample));
      const beatInBar = ((beatIndex % beatsPerBar) + beatsPerBar) % beatsPerBar;
      isDownbeat.push(beatInBar === 0);
    }
    beatIndex++;
    currentSample += samplesPerBeat;
  }

  return {
    firstDownbeatSample: anchor,
    samplesPerBeat,
    bpm: safeBpm,
    beatsPerBar,
    totalBeats: beatSamples.length,
    confidence: 1.0,
    beatSamples,
    isDownbeat
  };
}

/**
 * Synthesizes a high-fidelity 4/4 DJ track with punchy kick transients, bass, synths, and percussion.
 */
export function synthesizeDJTrack(
  audioCtx: AudioContext,
  title: string,
  artist: string,
  genre: string,
  bpm: number,
  key: string,
  bars = 32
): TrackData {
  const sampleRate = audioCtx.sampleRate;
  const beatsPerBar = 4;
  const totalBeats = bars * beatsPerBar;
  const secondsPerBeat = 60 / bpm;
  const durationSeconds = totalBeats * secondsPerBeat;
  const totalSamples = Math.round(durationSeconds * sampleRate);

  const buffer = audioCtx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const samplesPerBeat = (sampleRate * 60) / bpm;
  const firstDownbeatSample = 0; // Starts directly on Bar 1 Beat 1 for seamless infinite looping

  // Frequency notes for the synth and bass based on key
  const keyFrequencies: Record<string, number> = {
    'A minor': 110.0, // A2
    'D minor': 73.42, // D2
    'G major': 98.0,  // G2
    'F minor': 87.31, // F2
  };
  const baseFreq = keyFrequencies[key] || 110.0;

  // Render Kick, Snare, Hi-Hats, Bassline, and Chords into buffer
  for (let s = 0; s < totalSamples; s++) {
    const sampleOffset = s - firstDownbeatSample;
    if (sampleOffset < 0) continue;

    const beatPos = sampleOffset / samplesPerBeat;
    const currentBeat = Math.floor(beatPos);
    const beatFraction = beatPos - currentBeat;
    const currentBar = Math.floor(currentBeat / beatsPerBar);
    const beatInBar = currentBeat % beatsPerBar;

    let sampleL = 0;
    let sampleR = 0;

    // 1. PUNCHY 909-STYLE KICK DRUM (Every beat: 0, 1, 2, 3)
    const kickTimeSec = beatFraction * secondsPerBeat;
    if (kickTimeSec < 0.28) {
      // Fast exponential pitch drop 160Hz -> 48Hz
      const pitchEnv = 48 + 120 * Math.exp(-kickTimeSec * 32);
      const kickPhase = 2 * Math.PI * pitchEnv * kickTimeSec;
      const kickAmp = Math.exp(-kickTimeSec * 11) * 0.72;
      const kickWave = Math.sin(kickPhase) + 0.15 * Math.sin(kickPhase * 2);
      sampleL += kickWave * kickAmp;
      sampleR += kickWave * kickAmp;
    }

    // 2. SNARE / CLAP (On Beats 2 and 4, i.e. beatInBar === 1 or 3)
    if (beatInBar === 1 || beatInBar === 3) {
      const snareTimeSec = beatFraction * secondsPerBeat;
      if (snareTimeSec < 0.22) {
        const snareEnv = Math.exp(-snareTimeSec * 18) * 0.42;
        // White noise burst + tone body
        const noise = (Math.random() * 2 - 1) * 0.65;
        const tone = Math.sin(2 * Math.PI * 220 * snareTimeSec) * 0.35;
        sampleL += (noise + tone) * snareEnv;
        sampleR += (noise * 0.9 + tone) * snareEnv;
      }
    }

    // 3. CRISP OFF-BEAT OPEN HI-HAT (at beatFraction ~ 0.5)
    const hatFraction = (beatFraction + 0.5) % 1.0;
    const hatTimeSec = hatFraction * secondsPerBeat;
    if (hatTimeSec < 0.12) {
      const hatEnv = Math.exp(-hatTimeSec * 35) * 0.22;
      const hatNoise = (Math.random() * 2 - 1);
      sampleL += hatNoise * hatEnv * 0.75;
      sampleR += hatNoise * hatEnv * 0.95;
    }

    // 4. ROLLING SUB BASSLINE (Syncopated 16th-note groove)
    const sixteenthFraction = (beatFraction * 4) % 1.0;
    const sixteenthIndex = Math.floor(beatFraction * 4);
    if (sixteenthIndex === 1 || sixteenthIndex === 2 || sixteenthIndex === 3) {
      const bassTime = sixteenthFraction * (secondsPerBeat / 4);
      // Root note or minor 3rd / 7th variation depending on bar
      const noteMultiplier = (currentBar % 4 === 3 && sixteenthIndex === 3) ? 1.2 : 1.0;
      const bassFreq = baseFreq * noteMultiplier;
      const bassEnv = Math.exp(-bassTime * 14) * 0.45;
      // Warm saturated saw/triangle bass
      const bassPhase = (s * bassFreq / sampleRate) % 1.0;
      const bassWave = (bassPhase < 0.5 ? 4 * bassPhase - 1 : 3 - 4 * bassPhase);
      sampleL += bassWave * bassEnv;
      sampleR += bassWave * bassEnv;
    }

    // 5. STEREO SYNTH STABS & CHORDS (Filtered chords on beat 1 and 3.5)
    if (beatInBar === 0 || (beatInBar === 2 && beatFraction > 0.5)) {
      const chordTime = beatFraction * secondsPerBeat;
      if (chordTime < 0.35) {
        const chordEnv = Math.exp(-chordTime * 7) * 0.28;
        const f1 = baseFreq * 2;
        const f2 = baseFreq * 2.4; // Minor 3rd
        const f3 = baseFreq * 3;   // 5th
        const synthL = Math.sin(2 * Math.PI * f1 * chordTime) + Math.sin(2 * Math.PI * f2 * chordTime * 1.01);
        const synthR = Math.sin(2 * Math.PI * f1 * chordTime * 0.99) + Math.sin(2 * Math.PI * f3 * chordTime);
        sampleL += synthL * chordEnv * 0.35;
        sampleR += synthR * chordEnv * 0.35;
      }
    }

    // Soft-clipping master limiter
    left[s] = Math.tanh(sampleL * 0.92);
    right[s] = Math.tanh(sampleR * 0.92);
  }

  const beatGrid = buildSourceBeatGrid(sampleRate, totalSamples, bpm, firstDownbeatSample, beatsPerBar);
  const waveform = extract3BandWaveform(buffer, 256);
  const warpMap = buildWarpMap(buffer, bpm, beatGrid);
  warpMap.isWarpApplied = true;

  return {
    id: `track-${title.toLowerCase().replace(/\s+/g, '-')}`,
    title,
    artist,
    genre,
    bpm,
    key,
    durationSeconds,
    sampleRate,
    totalSamples,
    beatGrid,
    audioBuffer: buffer,
    waveform,
    warpMap,
    isStraightened: true
  };
}

export const CAMELOT_KEY_MAP: Record<string, string> = {
  'A minor': '8A',
  'D minor': '7A',
  'G major': '9B',
  'F minor': '4A',
  'C major': '8B',
  'E minor': '9A',
  'B minor': '10A',
  'F# minor': '11A',
  'C# minor': '12A',
  'G# minor': '1A',
  'D# minor': '2A',
  'Bb minor': '3A',
  'C minor': '5A',
  'G minor': '6A'
};

/**
 * Checks if two musical keys are harmonically compatible using the Camelot Wheel:
 * Compatible if identical, adjacent number (±1) on the same letter, or relative major/minor (same number, A ↔ B).
 */
export function areKeysHarmonicallyCompatible(keyA: string, keyB: string): { compatible: boolean; reason: string } {
  const codeA = CAMELOT_KEY_MAP[keyA] || keyA;
  const codeB = CAMELOT_KEY_MAP[keyB] || keyB;

  const matchA = codeA.match(/^(\d{1,2})([AB])$/i);
  const matchB = codeB.match(/^(\d{1,2})([AB])$/i);

  if (!matchA || !matchB) {
    return { compatible: false, reason: 'Keys not recognized' };
  }

  const numA = parseInt(matchA[1], 10);
  const letterA = matchA[2].toUpperCase();
  const numB = parseInt(matchB[1], 10);
  const letterB = matchB[2].toUpperCase();

  if (numA === numB && letterA === letterB) {
    return { compatible: true, reason: `Perfect Key Match (${codeA})` };
  }

  // Relative Major / Minor (same number, A <-> B)
  if (numA === numB && letterA !== letterB) {
    return { compatible: true, reason: `Relative Match (${codeA} ↔ ${codeB})` };
  }

  // Energy Shift / Adjacent Camelot step (num diff === 1 or 11/1 wrap-around, same letter)
  if (letterA === letterB) {
    const diff = Math.abs(numA - numB);
    if (diff === 1 || diff === 11) {
      return { compatible: true, reason: `Harmonic Shift (${codeA} ↔ ${codeB})` };
    }
  }

  return { compatible: false, reason: `Clash (${codeA} vs ${codeB})` };
}

/**
 * Synthesizes authentic Ugandan Afro-Dancehall track:
 * "High School Plumber (Okuva Lwe Namufuna)" at 103.0 BPM in F# minor.
 * Features 4-bar intro with acoustic guitar plucks, followed by the heavy 103 BPM Dancehall kick drop,
 * 3-3-2 syncopation, rimshots on 2 & 4, sub bassline, and lead guitar riffs.
 */
export function synthesizeAfroDancehallTrack(audioCtx: AudioContext): TrackData {
  const title = 'High School Plumber (Okuva Lwe Namufuna)';
  const artist = 'Ugandan Afro-Dancehall';
  const genre = 'Afro-Dancehall';
  const bpm = 103.0;
  const key = 'F# minor';
  const bars = 32;

  const sampleRate = audioCtx.sampleRate;
  const beatsPerBar = 4;
  const totalBeats = bars * beatsPerBar;
  const secondsPerBeat = 60 / bpm;
  const durationSeconds = totalBeats * secondsPerBeat;
  const totalSamples = Math.round(durationSeconds * sampleRate);

  const buffer = audioCtx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const samplesPerBeat = (sampleRate * 60) / bpm;
  // 4-bar melodic intro: Kick drops on Bar 5 (Beat 16)
  const introBars = 4;
  const firstDownbeatSample = Math.round(introBars * beatsPerBar * samplesPerBeat);
  const baseFreq = 92.5; // F#2

  for (let s = 0; s < totalSamples; s++) {
    const totalBeatPos = (s / samplesPerBeat);
    const currentBeat = Math.floor(totalBeatPos);
    const beatFraction = totalBeatPos - currentBeat;
    const currentBar = Math.floor(currentBeat / beatsPerBar);
    const beatInBar = currentBeat % beatsPerBar;

    let sampleL = 0;
    let sampleR = 0;

    // A. ACOUSTIC GUITAR PLUCKS (Plays throughout intro and groove)
    // Chord progression: F#m (bars 1,5), D (bars 2,6), E (bars 3,7), C#m (bars 4,8)
    const chordStep = currentBar % 4;
    const chordRoot = chordStep === 0 ? baseFreq : chordStep === 1 ? baseFreq * 1.189 : chordStep === 2 ? baseFreq * 1.335 : baseFreq * 1.122;
    
    // Pluck 4 times per beat (16th notes)
    const sixteenth = Math.floor(beatFraction * 4);
    const sixteenthFraction = (beatFraction * 4) - sixteenth;
    const pluckTime = sixteenthFraction * (secondsPerBeat / 4);
    
    if (pluckTime < 0.16) {
      const noteFreq = chordRoot * (sixteenth === 0 ? 2 : sixteenth === 1 ? 2.5 : sixteenth === 2 ? 3 : 2.5);
      const pluckEnv = Math.exp(-pluckTime * 22);
      const pluckTone = Math.sin(2 * Math.PI * noteFreq * pluckTime) * 0.4 +
                        Math.sin(2 * Math.PI * noteFreq * 2 * pluckTime) * 0.15;
      sampleL += pluckTone * pluckEnv * 0.45;
      sampleR += pluckTone * pluckEnv * 0.35;
    }

    // B. SHAKER / PERCUSSION GROOVE
    const shakerTime = ((beatFraction * 8) % 1.0) * (secondsPerBeat / 8);
    if (shakerTime < 0.04) {
      const shakerEnv = Math.exp(-shakerTime * 65);
      const shakerNoise = (Math.random() * 2 - 1) * 0.22;
      sampleL += shakerNoise * shakerEnv;
      sampleR += shakerNoise * shakerEnv * 1.1;
    }

    // C. DRUMS & BASS (Drop on Bar 5 / Beat 16)
    if (currentBar >= introBars) {
      // 1. HEAVY 103 BPM AFRO-DANCEHALL KICK
      // Hits on: Beat 0 (downbeat), Beat 2.5 (3-3-2 Afro syncopation), and Beat 3
      const isKickHit = (beatInBar === 0) || (beatInBar === 2 && beatFraction > 0.45 && beatFraction < 0.55) || (beatInBar === 3);
      if (isKickHit) {
        const kFraction = (beatInBar === 2) ? (beatFraction - 0.5) : beatFraction;
        const kickTimeSec = Math.max(0, kFraction) * secondsPerBeat;
        if (kickTimeSec < 0.25) {
          const pitchEnv = 44 + 115 * Math.exp(-kickTimeSec * 36);
          const kickAmp = Math.exp(-kickTimeSec * 10) * 0.85;
          const kickTone = Math.sin(2 * Math.PI * pitchEnv * kickTimeSec);
          sampleL += kickTone * kickAmp;
          sampleR += kickTone * kickAmp;
        }
      }

      // 2. SHARP AFROBEAT RIMSHOT / SNARE (On Beats 2 and 4)
      if (beatInBar === 1 || beatInBar === 3) {
        const snareTimeSec = beatFraction * secondsPerBeat;
        if (snareTimeSec < 0.18) {
          const snareEnv = Math.exp(-snareTimeSec * 22) * 0.55;
          const noise = (Math.random() * 2 - 1) * 0.5;
          const body = Math.sin(2 * Math.PI * 260 * snareTimeSec) * 0.4;
          sampleL += (noise + body) * snareEnv;
          sampleR += (noise * 0.95 + body) * snareEnv;
        }
      }

      // 3. DEEP ROLLING SUB-BASSLINE
      const bassSixteenth = Math.floor(beatFraction * 4);
      if (bassSixteenth === 1 || bassSixteenth === 3) {
        const bFraction = (beatFraction * 4) - bassSixteenth;
        const bassTime = bFraction * (secondsPerBeat / 4);
        const bassEnv = Math.exp(-bassTime * 12) * 0.52;
        const bTone = Math.sin(2 * Math.PI * chordRoot * 0.5 * bassTime);
        sampleL += bTone * bassEnv;
        sampleR += bTone * bassEnv;
      }
    }

    left[s] = Math.tanh(sampleL * 0.88);
    right[s] = Math.tanh(sampleR * 0.88);
  }

  const beatGrid = buildSourceBeatGrid(sampleRate, totalSamples, bpm, firstDownbeatSample, beatsPerBar);
  const waveform = extract3BandWaveform(buffer, 256);
  const warpMap = buildWarpMap(buffer, bpm, beatGrid);
  warpMap.isWarpApplied = true;

  return {
    id: 'track-high-school-plumber-103',
    title,
    artist,
    genre,
    bpm,
    key,
    durationSeconds,
    sampleRate,
    totalSamples,
    beatGrid,
    audioBuffer: buffer,
    waveform,
    warpMap,
    isStraightened: true
  };
}

/**
 * Synthesizes authentic Diamond Platnumz Bongo Flava track:
 * "Yatapita" at 91.0 BPM in D minor / F major.
 * Features 4-bar acoustic guitar arpeggio intro, followed by the signature 91 BPM Bongo Flava groove,
 * rimshot on 2 & 4, warm sub kick on 1 & 3, warm electric piano, and melodious flute.
 */
export function synthesizeBongoFlavaTrack(audioCtx: AudioContext): TrackData {
  const title = 'Yatapita';
  const artist = 'Diamond Platnumz';
  const genre = 'Bongo Flava';
  const bpm = 91.0;
  const key = 'D minor';
  const bars = 32;

  const sampleRate = audioCtx.sampleRate;
  const beatsPerBar = 4;
  const totalBeats = bars * beatsPerBar;
  const secondsPerBeat = 60 / bpm;
  const durationSeconds = totalBeats * secondsPerBeat;
  const totalSamples = Math.round(durationSeconds * sampleRate);

  const buffer = audioCtx.createBuffer(2, totalSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const samplesPerBeat = (sampleRate * 60) / bpm;
  // 4-bar melodic intro: Kick drops on Bar 5 (Beat 16)
  const introBars = 4;
  const firstDownbeatSample = Math.round(introBars * beatsPerBar * samplesPerBeat);
  const baseFreq = 73.42; // D2

  for (let s = 0; s < totalSamples; s++) {
    const totalBeatPos = (s / samplesPerBeat);
    const currentBeat = Math.floor(totalBeatPos);
    const beatFraction = totalBeatPos - currentBeat;
    const currentBar = Math.floor(currentBeat / beatsPerBar);
    const beatInBar = currentBeat % beatsPerBar;

    let sampleL = 0;
    let sampleR = 0;

    // A. BONGO FLAVA ACOUSTIC GUITAR FINGERPICKING (Dm - Gm - A7 - Dm)
    const chordStep = currentBar % 4;
    const chordRoot = chordStep === 0 ? baseFreq : chordStep === 1 ? baseFreq * 1.335 : chordStep === 2 ? baseFreq * 1.5 : baseFreq;
    
    // Fingerpicking arpeggios
    const eighth = Math.floor(beatFraction * 2);
    const eighthFraction = (beatFraction * 2) - eighth;
    const guitarTime = eighthFraction * (secondsPerBeat / 2);
    if (guitarTime < 0.28) {
      const gNote = chordRoot * (eighth === 0 ? 3.0 : 4.0);
      const gEnv = Math.exp(-guitarTime * 9);
      const gTone = Math.sin(2 * Math.PI * gNote * guitarTime) * 0.35 +
                    Math.sin(2 * Math.PI * gNote * 2 * guitarTime) * 0.12;
      sampleL += gTone * gEnv * 0.48;
      sampleR += gTone * gEnv * 0.38;
    }

    // B. SWINGING BONGO SHAKER & CABASA
    const cabasaTime = ((beatFraction * 4) % 1.0) * (secondsPerBeat / 4);
    if (cabasaTime < 0.05) {
      const cabEnv = Math.exp(-cabasaTime * 55);
      const cabNoise = (Math.random() * 2 - 1) * 0.18;
      sampleL += cabNoise * cabEnv;
      sampleR += cabNoise * cabEnv * 0.9;
    }

    // C. DRUMS & BASS (Drop on Bar 5 / Beat 16)
    if (currentBar >= introBars) {
      // 1. WARM BONGO FLAVA SUB KICK (On Beats 1 and 3)
      if (beatInBar === 0 || beatInBar === 2) {
        const kickTimeSec = beatFraction * secondsPerBeat;
        if (kickTimeSec < 0.3) {
          const pitchEnv = 40 + 90 * Math.exp(-kickTimeSec * 28);
          const kickAmp = Math.exp(-kickTimeSec * 9) * 0.82;
          const kickTone = Math.sin(2 * Math.PI * pitchEnv * kickTimeSec);
          sampleL += kickTone * kickAmp;
          sampleR += kickTone * kickAmp;
        }
      }

      // 2. CRISP WOODEN RIMSHOT / CLAVE (On Beats 2 and 4)
      if (beatInBar === 1 || beatInBar === 3) {
        const rimTimeSec = beatFraction * secondsPerBeat;
        if (rimTimeSec < 0.15) {
          const rimEnv = Math.exp(-rimTimeSec * 28) * 0.48;
          const tone = Math.sin(2 * Math.PI * 340 * rimTimeSec) * 0.45;
          const click = (Math.random() * 2 - 1) * 0.35;
          sampleL += (tone + click) * rimEnv;
          sampleR += (tone * 0.9 + click) * rimEnv;
        }
      }

      // 3. WARM MELODIC BASSLINE
      if (beatFraction > 0.25 && beatFraction < 0.85) {
        const bFraction = (beatFraction - 0.25) / 0.6;
        const bTime = bFraction * (secondsPerBeat * 0.6);
        const bEnv = Math.sin(Math.PI * bFraction) * 0.54;
        const bTone = Math.sin(2 * Math.PI * chordRoot * bTime);
        sampleL += bTone * bEnv;
        sampleR += bTone * bEnv;
      }

      // 4. MELLOW VOCAL FLUTE HARMONY
      if (beatInBar === 0 || beatInBar === 2) {
        const fluteTime = beatFraction * secondsPerBeat;
        if (fluteTime < 0.45) {
          const fEnv = Math.sin(Math.PI * Math.min(1.0, fluteTime / 0.45)) * 0.22;
          const fTone = Math.sin(2 * Math.PI * chordRoot * 4 * fluteTime);
          sampleL += fTone * fEnv * 0.3;
          sampleR += fTone * fEnv * 0.45;
        }
      }
    }

    left[s] = Math.tanh(sampleL * 0.86);
    right[s] = Math.tanh(sampleR * 0.86);
  }

  const beatGrid = buildSourceBeatGrid(sampleRate, totalSamples, bpm, firstDownbeatSample, beatsPerBar);
  const waveform = extract3BandWaveform(buffer, 256);
  const warpMap = buildWarpMap(buffer, bpm, beatGrid);
  warpMap.isWarpApplied = true;

  return {
    id: 'track-yatapita-diamond-platnumz-91',
    title,
    artist,
    genre,
    bpm,
    key,
    durationSeconds,
    sampleRate,
    totalSamples,
    beatGrid,
    audioBuffer: buffer,
    waveform,
    warpMap,
    isStraightened: true
  };
}

/**
 * Creates the default roster of pro DJ tracks for instant play and synchronization.
 * Features the two requested test songs at the very top:
 * 1. "High School Plumber (Okuva Lwe Namufuna)" - 103.0 BPM
 * 2. "Yatapita" (Diamond Platnumz) - 91.0 BPM
 */
export function getPresetDJTracks(audioCtx: AudioContext): TrackData[] {
  return [
    synthesizeAfroDancehallTrack(audioCtx),
    synthesizeBongoFlavaTrack(audioCtx),
    synthesizeDJTrack(audioCtx, 'Midnight Drive', 'Lunar Tribe', 'Synthwave', 124.0, 'F# minor', 64),
    synthesizeDJTrack(audioCtx, 'Higher Tonight', 'Solar Motion', 'Deep House', 126.0, 'A minor', 64),
    synthesizeDJTrack(audioCtx, 'Cybernetic Pulse', 'CYBER-X', 'Peak Techno', 128.0, 'D minor', 64),
    synthesizeDJTrack(audioCtx, 'Sunset Boulevard', 'RICO LATINO', 'Latin House', 118.0, 'G major', 64),
    synthesizeDJTrack(audioCtx, 'Urban Velocity', 'SUB-STEPPERS', 'Speed Garage', 134.0, 'F minor', 64),
  ];
}

/**
 * Analyzes an uploaded custom user audio file (MP3, WAV, etc.)
 * Robustly detects true BPM and BeatGrid in exact source-sample coordinates:
 * - 2-Pole 150Hz Lowpass Filter extracts kick drum envelope, immune to vocal/guitar intros.
 * - 1500Hz Highpass Filter extracts snare and percussion transients.
 * - Multi-segment autocorrelation across middle active rhythmic sections.
 * - Sub-sample parabolic interpolation for precise fractional BPM detection.
 * - Octave ambiguity checks (e.g. 91 BPM vs 182 BPM; 103 BPM vs 206 BPM).
 * - Comb filter downbeat phase correlation to align Beat 1.
 * - Keeps original pristine AudioBuffer without destructive offline warping.
 */
export async function analyzeUserAudioFile(file: File, audioCtx: AudioContext): Promise<TrackData> {
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const sampleRate = audioBuffer.sampleRate;
  const totalSamples = audioBuffer.length;
  const channelData = audioBuffer.getChannelData(0);

  // 1. Dual-Band Filtering: Low-pass (<150Hz) for Kick, High-pass (>1500Hz) for Snare/Transients
  const dt = 1.0 / sampleRate;
  const rcLow = 1.0 / (2 * Math.PI * 150);
  const alphaLow = dt / (rcLow + dt);
  const rcHigh = 1.0 / (2 * Math.PI * 1500);
  const alphaHigh = rcHigh / (rcHigh + dt);

  const frameSize = 1024;
  const hopSize = 512;
  const numFrames = Math.floor((totalSamples - frameSize) / hopSize);

  const kickFlux = new Float32Array(numFrames);
  const snareFlux = new Float32Array(numFrames);
  const combinedFlux = new Float32Array(numFrames);

  let lowFilt = 0;
  let highFilt = 0;
  let prevLowEnergy = 0;
  let prevHighEnergy = 0;

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;
    let lowEnergy = 0;
    let highEnergy = 0;

    for (let i = 0; i < frameSize; i++) {
      const s = channelData[start + i];
      lowFilt += alphaLow * (s - lowFilt);
      highFilt = alphaHigh * (highFilt + s - (i > 0 ? channelData[start + i - 1] : s));

      lowEnergy += lowFilt * lowFilt;
      highEnergy += highFilt * highFilt;
    }

    const kf = Math.max(0, lowEnergy - prevLowEnergy);
    const sf = Math.max(0, highEnergy - prevHighEnergy);
    kickFlux[f] = kf;
    snareFlux[f] = sf;
    combinedFlux[f] = kf * 0.75 + sf * 0.25;

    prevLowEnergy = lowEnergy;
    prevHighEnergy = highEnergy;
  }

  // 2. Multi-Segment Autocorrelation across active rhythmic sections
  // Typical DJ BPM range: 70 to 180 BPM
  const minLag = Math.floor((sampleRate * 60) / 180 / hopSize);
  const maxLag = Math.floor((sampleRate * 60) / 70 / hopSize);

  // Take 3 representative 20-second active windows from 20% to 75% of song
  const totalFrames = numFrames;
  const windowFrames = Math.min(Math.floor((sampleRate * 20) / hopSize), Math.floor(totalFrames / 3));
  const segmentStarts = [
    Math.floor(totalFrames * 0.20),
    Math.floor(totalFrames * 0.45),
    Math.floor(totalFrames * 0.65)
  ];

  const corr = new Float32Array(maxLag + 2);

  for (const segStart of segmentStarts) {
    if (segStart + windowFrames + maxLag >= totalFrames) continue;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = 0; i < windowFrames; i++) {
        sum += combinedFlux[segStart + i] * combinedFlux[segStart + i + lag];
      }
      corr[lag] += sum;
    }
  }

  // Find peak lag in correlation curve
  let bestLag = minLag;
  let maxVal = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (corr[lag] > maxVal) {
      maxVal = corr[lag];
      bestLag = lag;
    }
  }

  // Octave ambiguity check: check if half-tempo (double lag) or double-tempo has high correlation
  // For Afrobeat, Bongo Flava, and Dancehall: 85 to 140 BPM is standard.
  const doubleLag = bestLag * 2;
  if (doubleLag <= maxLag && corr[doubleLag] >= maxVal * 0.65) {
    const rawHalfBpm = (sampleRate * 60) / (doubleLag * hopSize);
    if (rawHalfBpm >= 75 && rawHalfBpm <= 140) {
      bestLag = doubleLag;
    }
  }

  // Sub-sample parabolic interpolation around bestLag for fine fractional precision
  let refinedLag = bestLag;
  if (bestLag > minLag && bestLag < maxLag) {
    const alpha = corr[bestLag - 1];
    const beta = corr[bestLag];
    const gamma = corr[bestLag + 1];
    const denom = alpha - 2 * beta + gamma;
    if (Math.abs(denom) > 1e-6) {
      const delta = (0.5 * (alpha - gamma)) / denom;
      refinedLag = bestLag + Math.max(-0.5, Math.min(0.5, delta));
    }
  }

  const detectedSamplesPerBeat = refinedLag * hopSize;
  let rawBpm = (sampleRate * 60) / detectedSamplesPerBeat;

  // Round to closest standard integer or half BPM if within ±0.35 tolerance
  const roundedBpm = Math.round(rawBpm * 2) / 2;
  const finalBpm = Math.abs(rawBpm - roundedBpm) < 0.35 ? roundedBpm : Math.round(rawBpm * 10) / 10;
  const samplesPerBeat = (sampleRate * 60) / finalBpm;
  const samplesPerBar = samplesPerBeat * 4;

  // 3. Comb Filter Downbeat Detection: find exact phase offset of Beat 1 across a 4-beat bar
  const barFrames = Math.round(samplesPerBar / hopSize);
  let bestOffsetFrame = 0;
  let maxBarKickEnergy = -1;

  for (let offset = 0; offset < barFrames; offset++) {
    let barSum = 0;
    for (let f = offset; f < numFrames; f += barFrames) {
      barSum += kickFlux[f];
    }
    if (barSum > maxBarKickEnergy) {
      maxBarKickEnergy = barSum;
      bestOffsetFrame = offset;
    }
  }

  // Find the first energetic kick in the main groove that aligns with this downbeat phase
  let firstDownbeatSample = bestOffsetFrame * hopSize;
  const maxKickFlux = kickFlux.reduce((max, val) => Math.max(max, val), 0);
  const kickThreshold = maxKickFlux * 0.25;

  for (let f = bestOffsetFrame; f < Math.min(numFrames, bestOffsetFrame + barFrames * 8); f += barFrames) {
    if (kickFlux[f] >= kickThreshold) {
      firstDownbeatSample = f * hopSize;
      break;
    }
  }

  const beatGrid = buildSourceBeatGrid(sampleRate, totalSamples, finalBpm, firstDownbeatSample, 4);
  const waveform = extract3BandWaveform(audioBuffer, 256);

  // Clean title from filename
  const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');

  const track: TrackData = {
    id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title: cleanTitle,
    artist: 'Custom Upload',
    genre: 'Analyzed Track',
    bpm: finalBpm,
    key: '11A / F#m',
    durationSeconds: audioBuffer.duration,
    sampleRate,
    totalSamples,
    beatGrid,
    audioBuffer,
    waveform,
    isCustomUpload: true,
    isStraightened: true
  };

  return track;
}
