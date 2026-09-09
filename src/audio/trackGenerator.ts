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
 */
export function buildSourceBeatGrid(
  sampleRate: number,
  totalSamples: number,
  bpm: number,
  firstDownbeatSample = 0,
  beatsPerBar = 4
): BeatGrid {
  const samplesPerBeat = (sampleRate * 60) / bpm;
  const beatSamples: number[] = [];
  const isDownbeat: boolean[] = [];

  let currentSample = firstDownbeatSample;
  let beatIndex = 0;

  while (currentSample < totalSamples) {
    if (currentSample >= 0) {
      beatSamples.push(Math.round(currentSample));
      isDownbeat.push(beatIndex % beatsPerBar === 0);
      beatIndex++;
    }
    currentSample += samplesPerBeat;
  }

  return {
    firstDownbeatSample: Math.round(firstDownbeatSample),
    samplesPerBeat,
    bpm,
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
 * Creates the default roster of pro DJ tracks for instant play and synchronization.
 */
export function getPresetDJTracks(audioCtx: AudioContext): TrackData[] {
  return [
    synthesizeDJTrack(audioCtx, 'Neon Horizon', 'KURA & ALGO', 'Tech House', 124.0, 'A minor', 64),
    synthesizeDJTrack(audioCtx, 'Cybernetic Pulse', 'CYBER-X', 'Peak Techno', 128.0, 'D minor', 64),
    synthesizeDJTrack(audioCtx, 'Sunset Boulevard', 'RICO LATINO', 'Latin House', 118.0, 'G major', 64),
    synthesizeDJTrack(audioCtx, 'Urban Velocity', 'SUB-STEPPERS', 'Speed Garage', 134.0, 'F minor', 64),
  ];
}

/**
 * Analyzes an uploaded custom user audio file (MP3, WAV, etc.)
 * Detects BPM, BeatGrid in exact source-sample coordinates, and extracts 3-band waveform.
 */
export async function analyzeUserAudioFile(file: File, audioCtx: AudioContext): Promise<TrackData> {
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const sampleRate = audioBuffer.sampleRate;
  const totalSamples = audioBuffer.length;
  const channelData = audioBuffer.getChannelData(0);

  // 1. Onset detection using energy flux in frames of 1024 samples
  const frameSize = 1024;
  const hopSize = 512;
  const numFrames = Math.floor((totalSamples - frameSize) / hopSize);
  const energyFlux = new Float32Array(numFrames);

  let prevEnergy = 0;
  for (let f = 0; f < numFrames; f++) {
    let energy = 0;
    const start = f * hopSize;
    for (let i = 0; i < frameSize; i++) {
      const v = channelData[start + i];
      energy += v * v;
    }
    const flux = Math.max(0, energy - prevEnergy);
    energyFlux[f] = flux;
    prevEnergy = energy;
  }

  // 2. Autocorrelation over typical DJ BPM range: 75 to 175 BPM
  const minLag = Math.floor((sampleRate * 60) / 175 / hopSize);
  const maxLag = Math.floor((sampleRate * 60) / 75 / hopSize);

  let bestLag = Math.floor((sampleRate * 60) / 124 / hopSize);
  let maxCorr = -1;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    const compareFrames = Math.min(numFrames - lag, 4000);
    for (let i = 0; i < compareFrames; i++) {
      sum += energyFlux[i] * energyFlux[i + lag];
    }
    if (sum > maxCorr) {
      maxCorr = sum;
      bestLag = lag;
    }
  }

  const detectedSamplesPerBeat = bestLag * hopSize;
  let rawBpm = (sampleRate * 60) / detectedSamplesPerBeat;

  // Round to closest standard integer or half BPM if within tolerance
  const roundedBpm = Math.round(rawBpm * 2) / 2;
  const finalBpm = Math.abs(rawBpm - roundedBpm) < 0.6 ? roundedBpm : Math.round(rawBpm * 10) / 10;

  // 3. Find first dominant kick downbeat in exact source samples
  let firstPeakSample = 0;
  let highestFlux = 0;
  const searchLimit = Math.min(numFrames, Math.floor(sampleRate * 4 / hopSize));
  for (let f = 0; f < searchLimit; f++) {
    if (energyFlux[f] > highestFlux) {
      highestFlux = energyFlux[f];
      firstPeakSample = f * hopSize;
    }
  }

  const beatGrid = buildSourceBeatGrid(sampleRate, totalSamples, finalBpm, firstPeakSample, 4);
  const waveform = extract3BandWaveform(audioBuffer, 256);

  // Clean title from filename
  const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');

  const rawTrack: TrackData = {
    id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title: cleanTitle,
    artist: 'Custom Upload',
    genre: 'DJ Audio Track',
    bpm: finalBpm,
    key: 'Analyzed Key',
    durationSeconds: audioBuffer.duration,
    sampleRate,
    totalSamples,
    beatGrid,
    audioBuffer,
    waveform,
    isCustomUpload: true
  };

  // Silently prepare straight-BPM PCM track using Transient Protection + WSOLA Time Stretch
  return prepareStraightBpmTrack(rawTrack, finalBpm, audioCtx);
}
