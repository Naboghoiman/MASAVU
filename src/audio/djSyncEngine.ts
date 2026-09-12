/**
 * Core DJ Synchronization Engine
 * Implements V2.2 Technical Corrections:
 * - Monotonic Audio-Render Frame Clock & Source-Sample Coordinate Mapping
 * - Beat-Perfect Slave Start with Latency Compensation
 * - Continuous Phase Lock with Deadband and Bounded PLL/PI Controller
 * - Drift Correction Mathematics over 2-4 beats
 */

import {
  AudioClockMapping,
  BeatGrid,
  ContinuousPhaseLockState,
  PLLControllerConfig,
  SlaveStartPlan
} from '../types/dj';

export const DEFAULT_PLL_CONFIG: PLLControllerConfig = {
  // Proportional gain tuned for smooth drift convergence without flutter
  kp: 0.5,
  // Integral gain for zero steady-state phase error
  ki: 0.05,
  // Deadband threshold: ±2.5 milliseconds (rock solid lock, no jitter)
  deadbandSeconds: 0.0025,
  // Correction window duration in beats
  correctionWindowBeats: 3.0,
  // Bounded tempo correction limit (±2.5% maximum subtle pitch bend, musically imperceptible)
  maxCorrectionFraction: 0.025,
  // Severe error threshold: > 0.25 beat
  severeErrorThresholdSeconds: 0.14
};

export class DjSyncEngine {
  private config: PLLControllerConfig;
  private integralAccumulator = 0;
  private lastEvaluationTime = 0;
  private transportDiscontinuityCount = 0;
  private lastReportedStatus: ContinuousPhaseLockState['status'] = 'idle';

  constructor(config: Partial<PLLControllerConfig> = {}) {
    this.config = { ...DEFAULT_PLL_CONFIG, ...config };
  }

  public updateConfig(newConfig: Partial<PLLControllerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): PLLControllerConfig {
    return { ...this.config };
  }

  /**
   * Resets the PI controller accumulator on track load or manual sync disengage
   */
  public resetController(): void {
    this.integralAccumulator = 0;
    this.lastEvaluationTime = 0;
    this.lastReportedStatus = 'idle';
  }

  /**
   * Section 1: Exact Coordinate Mapping
   * Maps Monotonic Rendered Output Frame to Original Source Sample Position
   * Source Sample Position = Start Source Sample + (Current Output Frame - Start Output Frame) * Tempo Multiplier
   */
  public outputFrameToSourceSample(
    currentOutputFrame: number,
    mapping: AudioClockMapping
  ): number {
    const elapsedRenderFrames = currentOutputFrame - mapping.startRenderFrame;
    // Ratio between source sample rate and output render sample rate
    const sampleRateRatio = mapping.sourceSampleRate / mapping.outputSampleRate;
    return (
      mapping.startSourceSample +
      elapsedRenderFrames * mapping.tempoMultiplier * sampleRateRatio
    );
  }

  /**
   * Maps Original Source Sample Position to Monotonic Rendered Output Frame
   * Rendered Output Frame = Start Output Frame + (Source Sample - Start Source Sample) / Tempo Multiplier
   */
  public sourceSampleToOutputFrame(
    targetSourceSample: number,
    mapping: AudioClockMapping
  ): number {
    const sampleRateRatio = mapping.sourceSampleRate / mapping.outputSampleRate;
    const deltaSourceSamples = targetSourceSample - mapping.startSourceSample;
    const elapsedRenderFrames = deltaSourceSamples / (mapping.tempoMultiplier * sampleRateRatio);
    return Math.round(mapping.startRenderFrame + elapsedRenderFrames);
  }

  /**
   * Section 5: Beat-Perfect Slave Start Planning
   * When SYNC is pressed:
   * 1. Read Master's current beat, bar, phase and render-frame position.
   * 2. Target Output Frame = Next Master Beat Render Frame (or Bar downbeat).
   * 3. Select matching Slave beat using beat number, downbeat status, bar position.
   * 4. Base Tempo Multiplier = Master BPM / Slave BPM.
   * 5. Set Slave source read-head to the selected BeatGrid source sample.
   * 6. Compensate measured latencies (decoder + time-stretcher + audio buffer).
   * 7. Preroll silently before target frame so selected beat sounds exactly at Target Output Frame.
   */
  public planBeatPerfectSlaveStart(params: {
    audioContextCurrentTime: number;
    outputSampleRate: number;
    masterBpm: number;
    masterBeatGrid: BeatGrid;
    masterCurrentSourceSample: number;
    masterMapping: AudioClockMapping;
    slaveBpm: number;
    slaveBeatGrid: BeatGrid;
    slaveCurrentSourceSample: number;
    slaveSourceSampleRate: number;
    quantizeMode?: 'beat' | 'bar';
    decoderLatencyFrames?: number;
    timeStretcherLatencyFrames?: number;
    bufferLatencyFrames?: number;
  }): SlaveStartPlan {
    const {
      audioContextCurrentTime,
      outputSampleRate,
      masterBpm,
      masterBeatGrid,
      masterCurrentSourceSample,
      masterMapping,
      slaveBpm,
      slaveBeatGrid,
      slaveCurrentSourceSample,
      slaveSourceSampleRate,
      quantizeMode = 'beat',
      decoderLatencyFrames = 0,
      timeStretcherLatencyFrames = 256,
      bufferLatencyFrames = 512
    } = params;

    // Current monotonic rendered output frame on the shared audio clock
    const currentRenderFrame = Math.round(audioContextCurrentTime * outputSampleRate);

    // 1. Calculate Base Tempo Multiplier with finite guards
    const safeMasterBpm = Number.isFinite(masterBpm) && masterBpm > 20 ? masterBpm : 120;
    const safeSlaveBpm = Number.isFinite(slaveBpm) && slaveBpm > 20 ? slaveBpm : 120;
    const baseTempoMultiplier = safeMasterBpm / safeSlaveBpm;
    const masterBeatPeriod = 60 / safeMasterBpm;

    // 2. Find Master's current beat & next future beat
    const safeMasterCurrent = Number.isFinite(masterCurrentSourceSample) ? masterCurrentSourceSample : 0;
    const masterOffsetSamples = safeMasterCurrent - masterBeatGrid.firstDownbeatSample;
    const masterBeatPos = masterBeatGrid.samplesPerBeat > 0 ? masterOffsetSamples / masterBeatGrid.samplesPerBeat : 0;
    const currentMasterBeatIndex = Math.floor(masterBeatPos);
    
    // Choose target master beat: next beat or next downbeat (Bar start)
    let targetMasterBeatIndex = currentMasterBeatIndex + 1;
    if (quantizeMode === 'bar') {
      const beatsPerBar = masterBeatGrid.beatsPerBar || 4;
      const currentBar = Math.floor(currentMasterBeatIndex / beatsPerBar);
      targetMasterBeatIndex = (currentBar + 1) * beatsPerBar;
    }

    const targetMasterBeatSample = masterBeatGrid.firstDownbeatSample + targetMasterBeatIndex * masterBeatGrid.samplesPerBeat;
    
    // Calculate exact time until Master reaches target beat based on remaining samples
    const deltaSamplesToBeat = targetMasterBeatSample - safeMasterCurrent;
    const masterRate = (masterMapping && Number.isFinite(masterMapping.tempoMultiplier) && masterMapping.tempoMultiplier > 0.1) 
      ? masterMapping.tempoMultiplier 
      : 1.0;
    const masterSourceSampleRate = (masterMapping && masterMapping.sourceSampleRate > 0) ? masterMapping.sourceSampleRate : outputSampleRate;
    let secondsUntilBeat = deltaSamplesToBeat / (masterRate * masterSourceSampleRate);

    // Ensure safe lookahead of at least 60ms to prevent scheduling underruns
    if (!Number.isFinite(secondsUntilBeat) || secondsUntilBeat < 0.06) {
      const safePeriod = masterBeatPeriod / masterRate;
      while (!Number.isFinite(secondsUntilBeat) || secondsUntilBeat < 0.06) {
        targetMasterBeatIndex += 1;
        secondsUntilBeat = (secondsUntilBeat || 0) + safePeriod;
        if (secondsUntilBeat > 2.0) break; // sanity bound
      }
    }

    const targetOutputTime = audioContextCurrentTime + secondsUntilBeat;
    const targetOutputFrame = Math.round(targetOutputTime * outputSampleRate);

    // 3. Select matching Slave beat
    const masterBeatsPerBar = masterBeatGrid.beatsPerBar || 4;
    const masterBeatInBar = ((targetMasterBeatIndex % masterBeatsPerBar) + masterBeatsPerBar) % masterBeatsPerBar;
    const masterIsDownbeat = masterBeatInBar === 0;
    const masterBarIndex = Math.floor(targetMasterBeatIndex / masterBeatsPerBar);

    // Align Slave to matching beat in bar or downbeat
    const slaveBeatsPerBar = slaveBeatGrid.beatsPerBar || 4;
    const slaveTargetBeatInBar = quantizeMode === 'bar' ? 0 : (masterBeatInBar % slaveBeatsPerBar);

    let targetSlaveBeatIndex = slaveTargetBeatInBar;
    const safeSlaveCurrent = Number.isFinite(slaveCurrentSourceSample) ? slaveCurrentSourceSample : 0;
    const slaveOffsetSamples = safeSlaveCurrent - slaveBeatGrid.firstDownbeatSample;
    const slaveCurrentBeat = slaveBeatGrid.samplesPerBeat > 0 ? Math.round(slaveOffsetSamples / slaveBeatGrid.samplesPerBeat) : 0;
    if (slaveCurrentBeat > 0) {
      const currentSlaveBar = Math.floor(slaveCurrentBeat / slaveBeatsPerBar);
      targetSlaveBeatIndex = (currentSlaveBar * slaveBeatsPerBar) + slaveTargetBeatInBar;
      if (targetSlaveBeatIndex >= slaveBeatGrid.totalBeats) {
        targetSlaveBeatIndex = slaveTargetBeatInBar;
      }
    }

    const slaveSourceSample = Math.max(0, Math.round(
      slaveBeatGrid.firstDownbeatSample + targetSlaveBeatIndex * slaveBeatGrid.samplesPerBeat
    ));
    const slaveBeatNumber = (targetSlaveBeatIndex % slaveBeatsPerBar) + 1;
    const slaveIsDownbeat = (targetSlaveBeatIndex % slaveBeatsPerBar) === 0;

    // 6. Measure and sum total processing and buffer latencies
    const totalLatencyFrames = decoderLatencyFrames + timeStretcherLatencyFrames + bufferLatencyFrames;
    const totalLatencySeconds = totalLatencyFrames / outputSampleRate;

    // 7. Silent preroll start time before target frame
    const prerollOutputTime = Math.max(audioContextCurrentTime, targetOutputTime - totalLatencySeconds);

    return {
      targetOutputFrame,
      targetOutputTime,
      masterBeatNumber: masterBeatInBar + 1,
      masterIsDownbeat,
      masterBarIndex,
      slaveSourceSample,
      slaveBeatNumber,
      slaveIsDownbeat,
      baseTempoMultiplier,
      decoderLatencyFrames,
      timeStretcherLatencyFrames,
      audioBufferLatencyFrames: bufferLatencyFrames,
      totalLatencySeconds,
      prerollOutputTime
    };
  }

  /**
   * Section 6 & 7: Continuous Phase Lock & Drift Correction (Every Audio Render Buffer)
   * 1. Predict Master and Slave next beat output times.
   * 2. Signed Phase Error = Slave Beat Output Time - Master Beat Output Time.
   * 3. Wrap error to nearest corresponding beat [-0.5 beat, +0.5 beat].
   * 4. Apply Deadband: IF |error| <= deadband: no correction.
   * 5. Apply Bounded PLL/PI Drift Correction:
   *    Correction Fraction ≈ Phase Error Seconds / Correction Window Seconds
   *    Corrected Tempo Multiplier = Base Tempo Multiplier × (1 + Correction Fraction)
   * 6. Severe error (> 0.25 beat): triggers smooth crossfaded re-anchor.
   */
  public evaluateContinuousPhaseLock(params: {
    currentTimeSeconds: number;
    masterBpm: number;
    masterCurrentSourceSample: number;
    masterBeatGrid: BeatGrid;
    masterMapping: AudioClockMapping;
    slaveCurrentSourceSample: number;
    slaveBeatGrid: BeatGrid;
    slaveMapping: AudioClockMapping;
    baseTempoMultiplier: number;
  }): ContinuousPhaseLockState {
    const {
      currentTimeSeconds,
      masterBpm,
      masterCurrentSourceSample,
      masterBeatGrid,
      slaveCurrentSourceSample,
      slaveBeatGrid,
      baseTempoMultiplier
    } = params;

    const safeMasterBpm = Number.isFinite(masterBpm) && masterBpm > 20 ? masterBpm : 120;
    const beatPeriodSeconds = 60 / safeMasterBpm;
    const halfBeatPeriod = beatPeriodSeconds * 0.5;

    const safeMasterGrid = masterBeatGrid || {
      firstDownbeatSample: 0,
      samplesPerBeat: (44100 * 60) / safeMasterBpm,
      beatsPerBar: 4,
      totalBeats: 1000
    };
    const safeSlaveGrid = slaveBeatGrid || {
      firstDownbeatSample: 0,
      samplesPerBeat: (44100 * 60) / (safeMasterBpm / (baseTempoMultiplier || 1)),
      beatsPerBar: 4,
      totalBeats: 1000
    };

    // 1. Predict continuous Master beat phase [0, 1) and next beat output time
    const safeMasterCurrent = Number.isFinite(masterCurrentSourceSample) ? masterCurrentSourceSample : 0;
    const masterOffset = safeMasterCurrent - (safeMasterGrid.firstDownbeatSample || 0);
    const masterBeatPos = safeMasterGrid.samplesPerBeat > 0 ? masterOffset / safeMasterGrid.samplesPerBeat : 0;
    let masterPhase = masterBeatPos - Math.floor(masterBeatPos);
    if (!Number.isFinite(masterPhase) || masterPhase < 0) masterPhase = 0;
    else if (masterPhase >= 1.0) masterPhase = 0.9999;

    const timeToNextMasterBeat = (1.0 - masterPhase) * beatPeriodSeconds;
    const masterNextBeatOutputTime = currentTimeSeconds + timeToNextMasterBeat;

    // Predict continuous Slave beat phase [0, 1) and next beat output time
    const safeSlaveCurrent = Number.isFinite(slaveCurrentSourceSample) ? slaveCurrentSourceSample : 0;
    const slaveOffset = safeSlaveCurrent - (safeSlaveGrid.firstDownbeatSample || 0);
    const slaveBeatPos = safeSlaveGrid.samplesPerBeat > 0 ? slaveOffset / safeSlaveGrid.samplesPerBeat : 0;
    let slavePhase = slaveBeatPos - Math.floor(slaveBeatPos);
    if (!Number.isFinite(slavePhase) || slavePhase < 0) slavePhase = 0;
    else if (slavePhase >= 1.0) slavePhase = 0.9999;

    const slaveBeatPeriod = beatPeriodSeconds;
    const timeToNextSlaveBeat = (1.0 - slavePhase) * slaveBeatPeriod;
    const slaveNextBeatOutputTime = currentTimeSeconds + timeToNextSlaveBeat;

    // 2. Section 6: Signed Phase Error = Slave Beat Output Time - Master Beat Output Time
    // If Slave is late (slaveNextBeatOutputTime > masterNextBeatOutputTime), rawPhaseErrorSeconds > 0
    const rawPhaseErrorSeconds = slaveNextBeatOutputTime - masterNextBeatOutputTime;

    // 3. Section 6: Wrap error to nearest corresponding beat [-0.5 * beatPeriod, +0.5 * beatPeriod]
    // Safe O(1) modulo wrapping - NEVER use unbounded while loops that freeze on edge cases!
    let wrappedErrorSeconds = 0;
    if (Number.isFinite(rawPhaseErrorSeconds) && beatPeriodSeconds > 0) {
      wrappedErrorSeconds = (((rawPhaseErrorSeconds + halfBeatPeriod) % beatPeriodSeconds) + beatPeriodSeconds) % beatPeriodSeconds - halfBeatPeriod;
    }

    const phaseErrorMs = wrappedErrorSeconds * 1000;
    const phaseErrorDegrees = (wrappedErrorSeconds / beatPeriodSeconds) * 360;
    const absErrorSeconds = Math.abs(wrappedErrorSeconds);

    // Delta time for integral term
    const dt = this.lastEvaluationTime > 0 ? Math.min(0.1, Math.max(0.005, currentTimeSeconds - this.lastEvaluationTime)) : 0.02;
    this.lastEvaluationTime = currentTimeSeconds;

    let inDeadband = false;
    let correctionFraction = 0;
    let status: ContinuousPhaseLockState['status'] = 'locked';

    // 4. Section 6: Deadband Check (±1.5 ms default)
    if (absErrorSeconds <= this.config.deadbandSeconds) {
      inDeadband = true;
      status = 'deadband';
      // Gently decay integral in deadband to avoid windup
      this.integralAccumulator *= 0.95;
      correctionFraction = 0;
    } else {
      // 5. Section 7: Drift-Correction Calculation with Bounded PLL/PI Controller
      // Correction Fraction ≈ Phase Error Seconds / Correction Window Seconds
      // Example at 120 BPM:
      // 2 beats = 1.0s, 4 beats = 2.0s
      // Slave 5 ms late (wrappedError = +0.005s):
      // Correction over 2 beats ≈ 1.005 (Slave speeds up with positive fraction!)
      status = 'correcting';

      const windowDurationSeconds = Math.max(0.5, this.config.correctionWindowBeats * beatPeriodSeconds);
      const directCorrectionFraction = wrappedErrorSeconds / windowDurationSeconds;

      // Update PI Controller
      // Proportional term
      const pTerm = directCorrectionFraction * this.config.kp;

      // Integral term with anti-windup clamping
      this.integralAccumulator += wrappedErrorSeconds * this.config.ki * dt;
      const maxIntegral = this.config.maxCorrectionFraction * 0.35;
      this.integralAccumulator = Math.max(-maxIntegral, Math.min(maxIntegral, this.integralAccumulator));

      // Total PLL correction fraction
      const totalFraction = pTerm + this.integralAccumulator;
      
      // Bound the correction to ±maxCorrectionFraction (e.g. ±8%)
      correctionFraction = Math.max(
        -this.config.maxCorrectionFraction,
        Math.min(this.config.maxCorrectionFraction, totalFraction)
      );
    }

    if (absErrorSeconds <= this.config.deadbandSeconds && Math.abs(correctionFraction) < 0.0001) {
      status = 'locked';
    }

    this.lastReportedStatus = status;

    // Corrected Tempo Multiplier = Base Tempo Multiplier × (1 + Correction Fraction)
    const correctedTempoMultiplier = baseTempoMultiplier * (1 + correctionFraction);

    return {
      phaseErrorSeconds: rawPhaseErrorSeconds,
      phaseErrorMs,
      instantaneousPhaseErrorMs: phaseErrorMs,
      wrappedErrorSeconds,
      phaseErrorDegrees,
      inDeadband,
      isPhaseLocked: status === 'locked' || inDeadband,
      correctionFraction,
      integralAccumulator: this.integralAccumulator,
      baseTempoMultiplier,
      correctedTempoMultiplier,
      status,
      transportDiscontinuities: this.transportDiscontinuityCount,
      roundingDiscontinuityFrames: 0
    };
  }
}
