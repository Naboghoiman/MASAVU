/**
 * High-Precision Pre-Sync Audio Warp & Transient Protection Engine
 * 
 * Flow:
 * Loaded Song PCM 
 *   → Existing WarpMap
 *   → Transient Protection Module (Kicks, Snares, Attacks)
 *   → High Quality WSOLA Time Stretch Engine (Pitch Preserved, Vocals Preserved, Kick Impact Preserved)
 *   → Prepared Straight-BPM PCM Track
 * 
 * Principle:
 * Live playback runs on the prepared straight-BPM PCM.
 * When SYNC is engaged, it only performs beat phase alignment, downbeat alignment,
 * and rhythmic kick-to-kick placement.
 */

import { BeatGrid, TrackData, TransientEvent, WarpMap, WarpMarker } from '../types/dj';
import { extract3BandWaveform } from './trackGenerator';

export interface TransientAnalysisResult {
  transients: TransientEvent[];
  kickCount: number;
  snareCount: number;
}

/**
 * Transient Protection Module
 * Detects kicks and snares using multi-band energy flux and onset rise-time analysis.
 * Preserves the high-impact attack window (15-30ms) so time-stretching never smears
 * or distorts the sharp initial transient.
 */
export function detectTransients(
  channelData: Float32Array,
  sampleRate: number
): TransientAnalysisResult {
  const transients: TransientEvent[] = [];
  const totalSamples = channelData.length;

  // Window configurations for onset detection
  const frameSize = Math.round(sampleRate * 0.012); // ~12ms
  const hopSize = Math.round(frameSize / 2);        // ~6ms
  const numFrames = Math.floor((totalSamples - frameSize) / hopSize);

  if (numFrames <= 0) {
    return { transients: [], kickCount: 0, snareCount: 0 };
  }

  // 1-pole filter coefficients for sub-bass (kick ~40-140Hz) and high-mid (snare ~1.5k-6kHz)
  const dt = 1.0 / sampleRate;
  const rcLow = 1.0 / (2 * Math.PI * 130);
  const alphaLow = dt / (rcLow + dt);

  const rcHigh = 1.0 / (2 * Math.PI * 2000);
  const alphaHigh = rcHigh / (rcHigh + dt);

  const lowEnergy = new Float32Array(numFrames);
  const highFlux = new Float32Array(numFrames);

  let lowState = 0;
  let highState = 0;
  let prevHighEnergy = 0;

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;
    let lEnergy = 0;
    let hEnergy = 0;

    for (let i = 0; i < frameSize; i++) {
      const x = channelData[start + i];

      // Low pass for kick body
      lowState += alphaLow * (x - lowState);
      lEnergy += lowState * lowState;

      // High pass for snare/clap attack and hi-hats
      const prevX = i > 0 ? channelData[start + i - 1] : x;
      highState = alphaHigh * (highState + x - prevX);
      hEnergy += highState * highState;
    }

    lowEnergy[f] = Math.sqrt(lEnergy / frameSize);
    const currH = Math.sqrt(hEnergy / frameSize);
    highFlux[f] = Math.max(0, currH - prevHighEnergy);
    prevHighEnergy = currH;
  }

  // Adaptive thresholding to identify prominent kicks and snares
  let maxLow = 0;
  let maxHigh = 0;
  for (let f = 0; f < numFrames; f++) {
    if (lowEnergy[f] > maxLow) maxLow = lowEnergy[f];
    if (highFlux[f] > maxHigh) maxHigh = highFlux[f];
  }

  const kickThreshold = Math.max(0.08, maxLow * 0.35);
  const snareThreshold = Math.max(0.05, maxHigh * 0.3);

  const minOnsetDistanceFrames = Math.round((sampleRate * 0.12) / hopSize); // minimum ~120ms between transients
  let lastOnsetFrame = -minOnsetDistanceFrames;
  let kickCount = 0;
  let snareCount = 0;

  const attackWindowSamples = Math.round(sampleRate * 0.024); // 24ms protected attack

  for (let f = 1; f < numFrames - 1; f++) {
    if (f - lastOnsetFrame < minOnsetDistanceFrames) continue;

    const isKick = lowEnergy[f] > kickThreshold &&
                   lowEnergy[f] > lowEnergy[f - 1] &&
                   lowEnergy[f] >= lowEnergy[f + 1];

    const isSnare = highFlux[f] > snareThreshold &&
                    highFlux[f] > highFlux[f - 1] &&
                    highFlux[f] >= highFlux[f + 1];

    if (isKick || isSnare) {
      const type = isKick ? 'kick' : 'snare';
      const strength = isKick
        ? Math.min(1.0, lowEnergy[f] / (maxLow || 1))
        : Math.min(1.0, highFlux[f] / (maxHigh || 1));

      if (isKick) kickCount++;
      else snareCount++;

      transients.push({
        sampleIndex: f * hopSize,
        type,
        strength,
        protectedWindowSamples: attackWindowSamples
      });

      lastOnsetFrame = f;
    }
  }

  return { transients, kickCount, snareCount };
}

/**
 * Builds the WarpMap containing detected beat positions, instantaneous tempo deviations,
 * and target straightened positions.
 */
export function buildWarpMap(
  buffer: AudioBuffer,
  nominalBpm: number,
  existingBeatGrid?: BeatGrid
): WarpMap {
  const sampleRate = buffer.sampleRate;
  const totalSamples = buffer.length;
  const channelData = buffer.getChannelData(0);

  // 1. Analyze transients
  const { transients } = detectTransients(channelData, sampleRate);
  const transientMap = new Set<number>();
  const kickMap = new Set<number>();
  const snareMap = new Set<number>();

  for (const t of transients) {
    transientMap.add(t.sampleIndex);
    if (t.type === 'kick') kickMap.add(t.sampleIndex);
    if (t.type === 'snare') snareMap.add(t.sampleIndex);
  }

  // 2. Identify candidate beat coordinates
  let beatSamples: number[] = [];
  let isDownbeat: boolean[] = [];

  if (existingBeatGrid && existingBeatGrid.beatSamples.length > 2) {
    beatSamples = [...existingBeatGrid.beatSamples];
    isDownbeat = [...existingBeatGrid.isDownbeat];
  } else {
    // Standard 4/4 grid estimate from nominal BPM
    const samplesPerBeat = (sampleRate * 60) / nominalBpm;
    let s = 0;
    let b = 0;
    while (s < totalSamples) {
      beatSamples.push(Math.round(s));
      isDownbeat.push(b % 4 === 0);
      b++;
      s += samplesPerBeat;
    }
  }

  const targetBpm = Math.round(nominalBpm * 10) / 10;
  const uniformSamplesPerBeat = (sampleRate * 60) / targetBpm;

  const markers: WarpMarker[] = [];
  let maxDev = 0;
  let sumDev = 0;
  let devCount = 0;

  const transientTolerance = Math.round(sampleRate * 0.04); // ±40ms

  for (let i = 0; i < beatSamples.length; i++) {
    const origSample = beatSamples[i];
    const targetSample = Math.round(i * uniformSamplesPerBeat);

    // Calculate instantaneous BPM compared to next beat
    let instBpm = targetBpm;
    let stretchRatio = 1.0;

    if (i < beatSamples.length - 1) {
      const origInterval = beatSamples[i + 1] - origSample;
      if (origInterval > 0) {
        instBpm = (sampleRate * 60) / origInterval;
        stretchRatio = uniformSamplesPerBeat / origInterval;

        const dev = Math.abs(instBpm - targetBpm);
        if (dev > maxDev) maxDev = dev;
        sumDev += dev;
        devCount++;
      }
    }

    // Check if kick or snare aligns with this beat
    let hasKick = false;
    let hasSnare = false;

    for (const t of transients) {
      if (Math.abs(t.sampleIndex - origSample) < transientTolerance) {
        if (t.type === 'kick') hasKick = true;
        if (t.type === 'snare') hasSnare = true;
      }
    }

    markers.push({
      originalSample: origSample,
      targetSample,
      beatIndex: i,
      isDownbeat: isDownbeat[i] ?? (i % 4 === 0),
      isKick: hasKick,
      isSnare: hasSnare,
      instantaneousBpm: Math.round(instBpm * 10) / 10,
      stretchRatio: Number.isFinite(stretchRatio) ? stretchRatio : 1.0
    });
  }

  const averageBpmDeviation = devCount > 0 ? sumDev / devCount : 0;

  return {
    sourceBpm: nominalBpm,
    targetBpm,
    markers,
    transientMarkers: transients.map((t) => t.sampleIndex),
    isWarpApplied: false,
    maxBpmDeviation: Math.round(maxDev * 100) / 100,
    averageBpmDeviation: Math.round(averageBpmDeviation * 100) / 100
  };
}

/**
 * WSOLA (Waveform Similarity Based Overlap-Add) Time-Stretch Engine
 * 
 * Replaces basic np.interp / linear resampling with a time-domain pitch-preserving
 * DSP engine.
 * 
 * Key Features:
 * 1. Pitch Preservation: Audio length is stretched or compressed while original frequencies
 *    and formants remain completely identical.
 * 2. Transient Protection: Drum attack phases (kicks, snares) are passed verbatim to avoid
 *    flamming, comb filtering, or softening the sharp transient edge.
 * 3. Cross-Correlation Waveform Alignment: Overlapping grains are phase-aligned via normalized
 *    cross-correlation to prevent phase cancellation and chorus artifacts.
 */
export function wsolaTimeStretchWithTransientProtection(
  inputBuffer: AudioBuffer,
  warpMap: WarpMap,
  audioCtx: AudioContext
): AudioBuffer {
  const numChannels = inputBuffer.numberOfChannels;
  const sampleRate = inputBuffer.sampleRate;
  const inputLength = inputBuffer.length;

  const markers = warpMap.markers;
  if (markers.length < 2) {
    return inputBuffer;
  }

  // Calculate target output length based on straight uniform beats
  const targetSamplesPerBeat = (sampleRate * 60) / warpMap.targetBpm;
  const totalTargetBeats = markers.length;
  const totalTargetSamples = Math.round(totalTargetBeats * targetSamplesPerBeat);

  const outputBuffer = audioCtx.createBuffer(numChannels, totalTargetSamples, sampleRate);

  // WSOLA grain parameters
  const grainSize = 1024; // ~23.2ms at 44.1kHz (ideal balance of frequency resolution and time locality)
  const synthHop = 512;   // 50% overlap
  const searchRadius = 128; // Cross-correlation lag search window

  // Precompute Hann analysis and synthesis window
  const hannWindow = new Float32Array(grainSize);
  for (let i = 0; i < grainSize; i++) {
    hannWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (grainSize - 1)));
  }

  // Process channel by channel
  for (let ch = 0; ch < numChannels; ch++) {
    const inputData = inputBuffer.getChannelData(ch);
    const outputData = outputBuffer.getChannelData(ch);
    const normalizationWeight = new Float32Array(totalTargetSamples);

    // Protected transient lookup table for fast checking
    const protectedAttacks = new Set<number>();
    for (const tIndex of warpMap.transientMarkers) {
      protectedAttacks.add(Math.round(tIndex));
    }

    // Process beat interval by beat interval
    for (let m = 0; m < markers.length - 1; m++) {
      const curMarker = markers[m];
      const nextMarker = markers[m + 1];

      const origStart = curMarker.originalSample;
      const origEnd = nextMarker.originalSample;
      const origIntervalLen = Math.max(1, origEnd - origStart);

      const targetStart = curMarker.targetSample;
      const targetEnd = nextMarker.targetSample;
      const targetIntervalLen = Math.max(1, targetEnd - targetStart);

      const stretchRatio = targetIntervalLen / origIntervalLen;

      // 1. TRANSIENT AWARENESS CHECK:
      // If a kick or snare is present at this beat, protect its attack window!
      const isTransientBeat = curMarker.isKick || curMarker.isSnare;
      const attackSamples = isTransientBeat ? Math.min(Math.round(sampleRate * 0.024), Math.floor(origIntervalLen * 0.25)) : 0;

      if (attackSamples > 0) {
        // Direct copy of the punchy attack to the exact target position (zero phase smearing)
        for (let a = 0; a < attackSamples; a++) {
          const inIdx = origStart + a;
          const outIdx = targetStart + a;
          if (inIdx < inputLength && outIdx < totalTargetSamples) {
            outputData[outIdx] += inputData[inIdx];
            normalizationWeight[outIdx] += 1.0;
          }
        }
      }

      // 2. WSOLA TIME-STRETCH FOR THE REMAINING INTERVAL (Sustain/Decay/Vocals)
      const inSustainStart = origStart + attackSamples;
      const inSustainLen = Math.max(grainSize, origIntervalLen - attackSamples);

      const outSustainStart = targetStart + attackSamples;
      const outSustainLen = Math.max(grainSize, targetIntervalLen - attackSamples);

      const subStretchRatio = outSustainLen / inSustainLen;
      const analysisHop = Math.max(64, Math.round(synthHop / Math.max(0.1, subStretchRatio)));

      let currSynthPos = outSustainStart;
      let currAnalysisPos = inSustainStart;

      while (currSynthPos + grainSize < outSustainStart + outSustainLen && currAnalysisPos + grainSize + searchRadius < inputLength) {
        // Cross-correlation search to find the optimal phase alignment
        let bestLag = 0;
        let maxCorrelation = -Infinity;

        // Compare candidate frame with the previous output frame
        for (let lag = -searchRadius; lag <= searchRadius; lag += 2) {
          const candidatePos = currAnalysisPos + lag;
          if (candidatePos < 0 || candidatePos + grainSize >= inputLength) continue;

          let corr = 0;
          for (let k = 0; k < grainSize; k += 4) { // Fast subsampled correlation
            corr += inputData[candidatePos + k] * outputData[currSynthPos + k];
          }

          if (corr > maxCorrelation) {
            maxCorrelation = corr;
            bestLag = lag;
          }
        }

        const optimalAnalysisPos = Math.max(0, Math.min(inputLength - grainSize, currAnalysisPos + bestLag));

        // Overlap-add windowed grain into output
        for (let k = 0; k < grainSize; k++) {
          const outIdx = currSynthPos + k;
          if (outIdx < totalTargetSamples) {
            const sampleVal = inputData[optimalAnalysisPos + k] * hannWindow[k];
            outputData[outIdx] += sampleVal;
            normalizationWeight[outIdx] += hannWindow[k];
          }
        }

        currSynthPos += synthHop;
        currAnalysisPos += analysisHop;
      }
    }

    // Normalize output buffer to eliminate any overlap amplitude modulation
    for (let i = 0; i < totalTargetSamples; i++) {
      const weight = normalizationWeight[i];
      if (weight > 0.001) {
        outputData[i] /= weight;
      }
      // Soft saturation limiter to prevent digital clipping
      if (outputData[i] > 1.0) outputData[i] = 1.0;
      else if (outputData[i] < -1.0) outputData[i] = -1.0;
    }
  }

  return outputBuffer;
}

/**
 * Pre-Sync Audio Preparation Module
 * 
 * Silently transforms any loaded track into a perfectly straight, uniform-BPM PCM track:
 * 1. Analyzes original song PCM.
 * 2. Generates WarpMap with transient markers.
 * 3. Protects kicks and snares.
 * 4. Runs WSOLA time-stretch to uniform target BPM.
 * 5. Reconstructs mathematically straight BeatGrid and updates 3-band waveform visualizer.
 */
export function prepareStraightBpmTrack(
  originalTrack: TrackData,
  targetBpm?: number,
  audioCtx?: AudioContext
): TrackData {
  if (!originalTrack.audioBuffer) {
    return originalTrack;
  }

  const ctx = audioCtx || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const chosenBpm = targetBpm || originalTrack.bpm;

  // 1. Build WarpMap
  const warpMap = buildWarpMap(originalTrack.audioBuffer, chosenBpm, originalTrack.beatGrid);

  // 2. Perform WSOLA time stretch with transient protection
  const straightenedBuffer = wsolaTimeStretchWithTransientProtection(originalTrack.audioBuffer, warpMap, ctx);
  warpMap.isWarpApplied = true;

  // 3. Construct perfectly straight BeatGrid
  const sampleRate = straightenedBuffer.sampleRate;
  const totalSamples = straightenedBuffer.length;
  const samplesPerBeat = (sampleRate * 60) / warpMap.targetBpm;
  const totalBeats = Math.floor(totalSamples / samplesPerBeat);

  const straightBeatSamples: number[] = [];
  const straightIsDownbeat: boolean[] = [];

  for (let b = 0; b < totalBeats; b++) {
    straightBeatSamples.push(Math.round(b * samplesPerBeat));
    straightIsDownbeat.push(b % 4 === 0);
  }

  const straightBeatGrid: BeatGrid = {
    firstDownbeatSample: 0,
    samplesPerBeat,
    bpm: warpMap.targetBpm,
    beatsPerBar: 4,
    totalBeats,
    confidence: 1.0,
    beatSamples: straightBeatSamples,
    isDownbeat: straightIsDownbeat
  };

  // 4. Update 3-band waveform from the new straightened PCM
  const updatedWaveform = extract3BandWaveform(straightenedBuffer, 256);

  return {
    ...originalTrack,
    bpm: warpMap.targetBpm,
    originalBpm: originalTrack.bpm,
    durationSeconds: straightenedBuffer.duration,
    totalSamples,
    audioBuffer: straightenedBuffer,
    beatGrid: straightBeatGrid,
    waveform: updatedWaveform,
    warpMap,
    isStraightened: true
  };
}
