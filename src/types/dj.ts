/**
 * DJ Synchronization Engine Types & Interfaces
 * Adheres strictly to V2.2 Required Technical Corrections
 */

export interface BeatGrid {
  /** Timestamp of the first downbeat in original source-sample coordinates */
  firstDownbeatSample: number;
  /** Average number of source samples between beats */
  samplesPerBeat: number;
  /** Track native tempo in beats per minute */
  bpm: number;
  /** Number of beats per musical bar (standard: 4) */
  beatsPerBar: number;
  /** Total number of detected beats in song */
  totalBeats: number;
  /** Estimation confidence (0.0 to 1.0) */
  confidence: number;
  /** Array of exact source sample coordinates for every beat */
  beatSamples: number[];
  /** Array of boolean flags indicating if beat is a downbeat (Bar start) */
  isDownbeat: boolean[];
}

export interface TransientEvent {
  /** Sample coordinate of transient onset in source audio */
  sampleIndex: number;
  /** Transient classification: kick, snare, or generic drum attack */
  type: 'kick' | 'snare' | 'attack';
  /** Normalized onset energy strength (0.0 to 1.0) */
  strength: number;
  /** Protected attack duration in samples (typically 15-30ms) */
  protectedWindowSamples: number;
}

export interface WarpMarker {
  /** Original sample index in source PCM */
  originalSample: number;
  /** Target uniform sample index in straight-BPM PCM */
  targetSample: number;
  /** Corresponding beat index in track */
  beatIndex: number;
  /** True if start of bar (beat 1) */
  isDownbeat: boolean;
  /** Whether a kick transient was detected at this beat */
  isKick: boolean;
  /** Whether a snare transient was detected at this beat */
  isSnare: boolean;
  /** Instantaneous local BPM measured in this interval */
  instantaneousBpm: number;
  /** WSOLA time-stretch ratio applied to this beat interval */
  stretchRatio: number;
}

export interface WarpMap {
  /** Average/nominal source BPM before straightening */
  sourceBpm: number;
  /** Constant straightened target BPM */
  targetBpm: number;
  /** Beat-by-beat warp alignment markers */
  markers: WarpMarker[];
  /** Sample positions of protected drum attacks */
  transientMarkers: number[];
  /** Whether straight-BPM time-stretching has been rendered to PCM */
  isWarpApplied: boolean;
  /** Maximum detected BPM fluctuation in original song */
  maxBpmDeviation: number;
  /** Average detected BPM fluctuation */
  averageBpmDeviation: number;
}

export interface AudioClockMapping {
  /** Source sample position anchor */
  startSourceSample: number;
  /** Monotonic output-render frame anchor */
  startRenderFrame: number;
  /** Current effective tempo stretch ratio */
  tempoMultiplier: number;
  /** Source audio sample rate (Hz) */
  sourceSampleRate: number;
  /** AudioContext hardware render output sample rate (Hz) */
  outputSampleRate: number;
}

export interface PLLControllerConfig {
  /** Proportional gain Kp */
  kp: number;
  /** Integral gain Ki */
  ki: number;
  /** Configurable deadband in seconds (e.g. 0.0015 = ±1.5ms) */
  deadbandSeconds: number;
  /** Correction duration window in beats (e.g. 2 to 4 beats) */
  correctionWindowBeats: number;
  /** Maximum allowable tempo correction fraction (e.g. ±0.08 = ±8%) */
  maxCorrectionFraction: number;
  /** Severe error threshold in seconds (e.g. > 0.25 beat) triggering re-anchor */
  severeErrorThresholdSeconds: number;
}

export interface ContinuousPhaseLockState {
  /** Signed phase error in seconds (Slave output time - Master output time) */
  phaseErrorSeconds: number;
  /** Signed phase error in milliseconds */
  phaseErrorMs: number;
  /** Wrapped phase error to nearest corresponding beat in seconds */
  wrappedErrorSeconds: number;
  /** Phase error in degrees (-180° to +180°) */
  phaseErrorDegrees: number;
  /** Whether absolute phase error is within deadband threshold */
  inDeadband: boolean;
  /** Dynamic correction fraction computed by PLL/PI controller */
  correctionFraction: number;
  /** Accumulated PI integral term */
  integralAccumulator: number;
  /** Base tempo multiplier (Master BPM / Slave BPM) */
  baseTempoMultiplier: number;
  /** Corrected tempo multiplier = Base × (1 + Correction Fraction) */
  correctedTempoMultiplier: number;
  /** Current synchronization status */
  status: 'locked' | 'deadband' | 'correcting' | 'reanchoring' | 'idle';
  /** Whether phase is actively locked or in deadband */
  isPhaseLocked?: boolean;
  /** Instantaneous phase error in milliseconds */
  instantaneousPhaseErrorMs?: number;
  /** Cumulative count of transport discontinuities / seeks */
  transportDiscontinuities: number;
  /** Monitor for buffer / rounding drift in output frames */
  roundingDiscontinuityFrames: number;
}

export interface SlaveStartPlan {
  /** Target monotonic output-render frame for slave to become audible */
  targetOutputFrame: number;
  /** Target output audio time (in AudioContext seconds) */
  targetOutputTime: number;
  /** Master beat number being matched (1-4) */
  masterBeatNumber: number;
  /** Master downbeat status */
  masterIsDownbeat: boolean;
  /** Master bar number */
  masterBarIndex: number;
  /** Selected Slave BeatGrid source sample coordinate */
  slaveSourceSample: number;
  /** Selected Slave beat number */
  slaveBeatNumber: number;
  /** Selected Slave downbeat status */
  slaveIsDownbeat: boolean;
  /** Base Tempo Multiplier = Master BPM / Slave BPM */
  baseTempoMultiplier: number;
  /** Measured decoder latency in frames */
  decoderLatencyFrames: number;
  /** Measured time-stretcher lookahead latency in frames */
  timeStretcherLatencyFrames: number;
  /** Measured audio-buffer output latency in frames */
  audioBufferLatencyFrames: number;
  /** Total latency in seconds */
  totalLatencySeconds: number;
  /** Timestamp when silent preroll begins */
  prerollOutputTime: number;
}

export interface TrackData {
  id: string;
  title: string;
  artist: string;
  genre: string;
  bpm: number;
  key: string;
  durationSeconds: number;
  sampleRate: number;
  totalSamples: number;
  beatGrid: BeatGrid;
  audioBuffer: AudioBuffer | null;
  /** 3-band waveform visual data (downsampled RMS for Bass, Mid, High) */
  waveform: WaveformData;
  isCustomUpload?: boolean;
  /** WarpMap representing transient alignment and beat correction */
  warpMap?: WarpMap;
  /** Whether the PCM audio has been straightened by the WSOLA pre-sync warp engine */
  isStraightened?: boolean;
  /** Whether this track is a prepared/normalized track */
  isPreparedTrack?: boolean;
  /** Original detected BPM before straight-BPM correction */
  originalBpm?: number;
}

export interface PreparedTrack extends TrackData {
  /** Explicitly marked as prepared track with corrected PCM & BeatGrid */
  isPreparedTrack: true;
  /** Corrected uniform mastered BPM value */
  bpm: number;
  /** Corrected duration in seconds */
  durationSeconds: number;
  /** Corrected total sample count */
  totalSamples: number;
  /** Corrected PCM audio buffer */
  audioBuffer: AudioBuffer;
  /** Corrected uniform BeatGrid */
  beatGrid: BeatGrid;
  /** Original metadata preserved for reference */
  originalMetadata?: {
    bpm: number;
    durationSeconds: number;
    totalSamples: number;
  };
}

export interface WaveformData {
  length: number;
  sampleRate: number;
  samplesPerPixel: number;
  /** Low frequency power 20Hz-250Hz (Red band) */
  low: Float32Array;
  /** Mid frequency power 250Hz-2500Hz (Green band) */
  mid: Float32Array;
  /** High frequency power 2500Hz-20kHz (Blue band) */
  high: Float32Array;
  /** Overall peak amplitude for waveform envelope */
  peaks: Float32Array;
}

export interface HotCue {
  id: number;
  sourceSample: number;
  beatNumber: number;
  label: string;
  color: string;
  isActive: boolean;
}

export interface LoopState {
  isActive: boolean;
  startSourceSample: number;
  endSourceSample: number;
  lengthBeats: number;
}

export type DeckId = 'A' | 'B';

export interface DeckTelemetry {
  deckId: DeckId;
  trackId: string | null;
  trackTitle: string;
  bpm: number;
  effectiveBpm: number;
  pitchPercentage: number;
  keyLock: boolean;
  isPlaying: boolean;
  isMaster: boolean;
  isSyncEnabled: boolean;
  /** Current playhead in original source-sample coordinate */
  currentSourceSample: number;
  /** Current monotonic rendered output frame */
  currentOutputFrame: number;
  /** Current audio time in seconds */
  currentTimeSeconds: number;
  /** Beat position index in song */
  currentBeatIndex: number;
  /** Beat within bar (1, 2, 3, 4) */
  beatInBar: number;
  /** Bar number in song */
  barIndex: number;
  /** Phase within current beat (0.0 to 1.0) */
  beatPhase: number;
  /** Volume level meter (left & right 0..1) */
  vuLevel: [number, number];
  /** Whether Slip Mode is active on this deck */
  isSlipMode: boolean;
  /** Whether the user is actively touching / scrubbing / slipping the wave */
  isSlipping: boolean;
  /** Virtual background playhead source sample coordinate */
  slipSourceSample: number;
  /** Virtual background playhead time in seconds */
  slipTimeSeconds: number;
  /** Whether straight-BPM PCM audio preparation is active */
  isStraightened?: boolean;
  /** Warp and transient protection telemetry */
  warpStatus?: {
    hasWarpMap: boolean;
    kickTransientsProtected: number;
    snareTransientsProtected: number;
    maxBpmDeviation: number;
    sourceBpm: number;
  };
}

export type LooperSyncTarget = 'AUTO' | 'DECK_A' | 'DECK_B';
export type LooperQuantize = '1_BAR' | '1_BEAT' | 'HALF_BEAT' | 'INSTANT';

export interface LoopSlotData {
  id: string;
  name: string;
  category: 'drum' | 'percussion' | 'bass' | 'synth' | 'vocal' | 'custom';
  bpm: number;
  totalBeats: number;
  audioBuffer: AudioBuffer | null;
  waveform: Float32Array;
  isPlaying: boolean;
  isMuted: boolean;
  isSoloed: boolean;
  volume: number; // 0.0 to 1.2
  filter: number; // -1.0 (Low-Pass) to 0.0 (Neutral) to +1.0 (High-Pass)
  activeLoopBeats: number; // 0.25, 0.5, 1, 2, 4, 8, 16
  currentBeatIndex: number;
  beatInLoop: number;
  beatPhase: number;
  isPendingQuantize: boolean;
  isRollActive: boolean;
  rollBeats: number;
  vuLevel: number;
  isUserUploaded?: boolean;
  fileName?: string;
}

export interface LooperTelemetry {
  syncTarget: LooperSyncTarget;
  quantize: LooperQuantize;
  isMasterSynced: boolean;
  activeTargetBpm: number;
  masterBarIndex: number;
  masterBeatInBar: number;
  masterBeatPhase: number;
  isAnyPlaying: boolean;
  masterVolume: number;
  slots: LoopSlotData[];
}

export type SamplerPlayMode = 'oneshot' | 'gate' | 'loop';
export type SamplerQuantize = 'INSTANT' | 'QUARTER_BEAT' | 'HALF_BEAT' | '1_BEAT';

export interface SamplerPadData {
  id: string;
  name: string;
  color: string;
  category: 'drum' | 'vocal' | 'fx' | 'synth' | 'drop' | 'custom';
  audioBuffer: AudioBuffer | null;
  waveform: Float32Array;
  isPlaying: boolean;
  playMode: SamplerPlayMode;
  volume: number; // 0.0 to 1.5
  pitchSemitones: number; // -12 to +12
  tempoSync: boolean;
  originalBpm: number;
  quantize: SamplerQuantize;
  vuLevel: number;
  isUserUploaded?: boolean;
  fileName?: string;
}

export interface SamplerTelemetry {
  masterVolume: number;
  syncTargetBpm: number;
  isMasterSynced: boolean;
  quantize: SamplerQuantize;
  tempoSyncAll: boolean;
  pads: SamplerPadData[];
}

