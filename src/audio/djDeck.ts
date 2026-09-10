/**
 * High-Precision DJ Deck Audio Channel
 * Manages Web Audio processing chain, exact source sample read-heads,
 * EQ/Filter, Hot Cues, Beat Loops, Jog Scratching, and Level Analyser.
 */

import {
  AudioClockMapping,
  BeatGrid,
  DeckId,
  DeckTelemetry,
  HotCue,
  LoopState,
  PreparedTrack,
  TrackData
} from '../types/dj';
import { prepareStraightBpmTrack } from './audioWarpEngine';

export class DjDeck {
  public readonly deckId: DeckId;
  private audioCtx: AudioContext;

  // Track data & coordinates
  private track: PreparedTrack | TrackData | null = null;
  private currentSourceSample = 0;
  private isPlaying = false;
  private isMaster = false;
  private isSyncEnabled = false;

  // Tempo & Pitch
  private pitchPercentage = 0.0; // Slider offset (-16% to +16%)
  private baseTempoMultiplier = 1.0;
  private pllTempoMultiplier = 1.0;
  private keyLock = true;
  private pitchRange = 0.16; // ±16% default range

  // Mapping anchor
  private mapping: AudioClockMapping = {
    startSourceSample: 0,
    startRenderFrame: 0,
    tempoMultiplier: 1.0,
    sourceSampleRate: 44100,
    outputSampleRate: 44100
  };

  // Hot cues & Loops
  private hotCues: HotCue[] = [];
  private loop: LoopState = {
    isActive: false,
    startSourceSample: 0,
    endSourceSample: 0,
    lengthBeats: 4
  };

  // Web Audio Graph
  private sourceNode: AudioBufferSourceNode | null = null;
  private crossfadeGainNode: GainNode;
  private lowEqNode: BiquadFilterNode;
  private midEqNode: BiquadFilterNode;
  private highEqNode: BiquadFilterNode;
  private filterNode: BiquadFilterNode; // Bipolar DJ filter
  private volumeNode: GainNode;
  private channelGainNode: GainNode;
  private analyserNode: AnalyserNode;
  public readonly outputNode: GainNode;

  // High precision time-anchor coordinates
  private anchorTime = 0;
  private anchorSourceSample = 0;
  private scheduledStartTime = 0;
  private appliedPlaybackRate = 1.0;

  // Jog wheel & scratch states
  private isJogTouching = false;
  private jogPitchNudge = 0; // temporary pitch nudge while spinning/nudging rim

  // Level metering
  private vuDataArray: Uint8Array;
  private currentVuLevels: [number, number] = [0, 0];

  constructor(deckId: DeckId, audioCtx: AudioContext) {
    this.deckId = deckId;
    this.audioCtx = audioCtx;

    // 1. 3-Band Isolator EQ (Clean 24dB/oct or 12dB/oct curves)
    this.lowEqNode = audioCtx.createBiquadFilter();
    this.lowEqNode.type = 'lowshelf';
    this.lowEqNode.frequency.value = 250;
    this.lowEqNode.gain.value = 0;

    this.midEqNode = audioCtx.createBiquadFilter();
    this.midEqNode.type = 'peaking';
    this.midEqNode.frequency.value = 1200;
    this.midEqNode.Q.value = 0.9;
    this.midEqNode.gain.value = 0;

    this.highEqNode = audioCtx.createBiquadFilter();
    this.highEqNode.type = 'highshelf';
    this.highEqNode.frequency.value = 4000;
    this.highEqNode.gain.value = 0;

    // 2. Bipolar DJ Color Filter (LowPass <-> Neutral <-> HighPass)
    this.filterNode = audioCtx.createBiquadFilter();
    this.filterNode.type = 'allpass';
    this.filterNode.frequency.value = 1000;
    this.filterNode.Q.value = 1.0;

    // 3. Trim Gain & Volume Fader
    this.channelGainNode = audioCtx.createGain();
    this.channelGainNode.gain.value = 1.0;

    this.volumeNode = audioCtx.createGain();
    this.volumeNode.gain.value = 1.0;

    // 4. VU Analyser
    this.analyserNode = audioCtx.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.75;
    this.vuDataArray = new Uint8Array(this.analyserNode.frequencyBinCount);

    // 5. Output bus node to Master/Crossfader
    this.outputNode = audioCtx.createGain();
    this.outputNode.gain.value = 1.0;

    // 6. Micro-crossfade gain node for click-free seeks & starts
    this.crossfadeGainNode = audioCtx.createGain();
    this.crossfadeGainNode.gain.value = 1.0;
    this.crossfadeGainNode.connect(this.lowEqNode);

    // Connect audio processing chain
    this.lowEqNode.connect(this.midEqNode);
    this.midEqNode.connect(this.highEqNode);
    this.highEqNode.connect(this.filterNode);
    this.filterNode.connect(this.channelGainNode);
    this.channelGainNode.connect(this.volumeNode);
    this.volumeNode.connect(this.analyserNode);
    this.volumeNode.connect(this.outputNode);

    // Initialize default hot cues (1 to 8)
    this.initHotCues();
  }

  private initHotCues(): void {
    const defaultColors = [
      '#EF4444', '#F97316', '#F59E0B', '#10B981',
      '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899'
    ];
    this.hotCues = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      sourceSample: 0,
      beatNumber: 1,
      label: `CUE ${i + 1}`,
      color: defaultColors[i],
      isActive: false
    }));
  }

  /**
   * Loads a track into the deck, ensures it is a fully prepared straight-BPM track,
   * resets playhead to first beat, and initializes mapping.
   */
  public loadTrack(track: TrackData, targetBpm?: number): PreparedTrack {
    this.stopPlayback();
    const chosenBpm = targetBpm && Number.isFinite(targetBpm) && targetBpm > 20 ? targetBpm : track.bpm;
    // Silently ensure track PCM is straight-BPM PreparedTrack with protected transients
    const effectiveTrack: PreparedTrack = (track.isPreparedTrack && track.bpm === chosenBpm)
      ? (track as PreparedTrack)
      : prepareStraightBpmTrack(track, chosenBpm, this.audioCtx);

    this.track = effectiveTrack;
    this.currentSourceSample = effectiveTrack.beatGrid.firstDownbeatSample || 0;
    this.anchorSourceSample = this.currentSourceSample;
    this.anchorTime = this.audioCtx.currentTime;
    this.scheduledStartTime = 0;
    this.baseTempoMultiplier = 1.0;
    this.pllTempoMultiplier = 1.0;
    this.pitchPercentage = 0.0;
    this.jogPitchNudge = 0;
    this.loop.isActive = false;

    // Reset hot cue 1 to the first downbeat
    this.hotCues[0].sourceSample = this.currentSourceSample;
    this.hotCues[0].isActive = true;

    this.updateMappingAnchor(this.currentSourceSample);
    return effectiveTrack;
  }

  /**
   * Pre-Sync BPM Normalization:
   * Re-masters the track to a new uniform target BPM using WSOLA.
   * Produces a new PreparedTrack with corrected PCM audio, corrected BPM value,
   * corrected BeatGrid, and corrected duration.
   */
  public prepareToBpm(targetBpm: number): PreparedTrack | null {
    if (!this.track || !this.track.audioBuffer) return null;
    const safeBpm = Math.round(targetBpm * 10) / 10;
    const prevBpm = this.track.bpm;
    const wasPlaying = this.isPlaying;
    const currentSample = this.currentSourceSample;

    const ratio = prevBpm > 0 ? safeBpm / prevBpm : 1.0;

    if (wasPlaying) {
      this.pause();
    }

    const prepared = prepareStraightBpmTrack(this.track, safeBpm, this.audioCtx);
    this.track = prepared;

    const mappedSample = Math.round(currentSample / ratio);
    this.currentSourceSample = Math.max(0, Math.min(prepared.totalSamples - 1, mappedSample));
    this.anchorSourceSample = this.currentSourceSample;
    this.anchorTime = this.audioCtx.currentTime;
    this.baseTempoMultiplier = 1.0;
    this.pllTempoMultiplier = 1.0;
    this.updateMappingAnchor(this.currentSourceSample);

    if (wasPlaying) {
      this.play(this.audioCtx.currentTime + 0.02, this.currentSourceSample);
    }

    return prepared;
  }

  public getTrack(): PreparedTrack | TrackData | null {
    return this.track;
  }

  /**
   * Synchronizes the mapping anchor for exact source-sample to render-frame conversion
   */
  public updateMappingAnchor(currentSourceSample: number): void {
    const currentRenderFrame = Math.round(this.audioCtx.currentTime * this.audioCtx.sampleRate);
    this.mapping = {
      startSourceSample: currentSourceSample,
      startRenderFrame: currentRenderFrame,
      tempoMultiplier: this.getEffectiveTempoMultiplier(),
      sourceSampleRate: this.track ? this.track.sampleRate : this.audioCtx.sampleRate,
      outputSampleRate: this.audioCtx.sampleRate
    };
  }

  /**
   * Computes overall tempo multiplier including pitch fader, PLL drift correction, and jog nudge
   */
  public getEffectiveTempoMultiplier(): number {
    const base = Number.isFinite(this.baseTempoMultiplier) && this.baseTempoMultiplier > 0.05 ? this.baseTempoMultiplier : 1.0;
    const pll = Number.isFinite(this.pllTempoMultiplier) && this.pllTempoMultiplier > 0.05 ? this.pllTempoMultiplier : 1.0;
    const pitch = Number.isFinite(this.pitchPercentage) ? this.pitchPercentage : 0;
    const range = Number.isFinite(this.pitchRange) ? this.pitchRange : 0.16;
    const manualPitchMultiplier = 1.0 + (pitch * range);
    const nudge = Number.isFinite(this.jogPitchNudge) ? this.jogPitchNudge : 0;
    const effective = base * pll * manualPitchMultiplier * (1.0 + nudge);
    return Math.max(0.1, Math.min(4.0, Number.isFinite(effective) ? effective : 1.0));
  }

  public getMapping(): AudioClockMapping {
    return { ...this.mapping, tempoMultiplier: this.getEffectiveTempoMultiplier() };
  }

  /**
   * Starts playback at exact AudioContext output time, latency compensated.
   * Can schedule in the future with exact start sample without audible clicks.
   */
  public play(startTime?: number, startSample?: number): void {
    if (!this.track || !this.track.audioBuffer) return;

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    // Stop any currently running buffer source cleanly
    this.stopPlayback();

    const now = this.audioCtx.currentTime;
    const scheduledTime = startTime !== undefined ? Math.max(now, startTime) : now;
    const initialSample = startSample !== undefined ? startSample : this.currentSourceSample;
    const clampedSample = Math.max(0, Math.min(this.track.totalSamples - 100, Math.round(initialSample)));

    this.currentSourceSample = clampedSample;
    this.anchorSourceSample = clampedSample;
    this.anchorTime = scheduledTime;
    this.scheduledStartTime = scheduledTime;

    const effectiveRate = this.getEffectiveTempoMultiplier();

    this.mapping = {
      startSourceSample: clampedSample,
      startRenderFrame: Math.round(scheduledTime * this.audioCtx.sampleRate),
      tempoMultiplier: effectiveRate,
      sourceSampleRate: this.track.sampleRate,
      outputSampleRate: this.audioCtx.sampleRate
    };

    // Create and configure AudioBufferSourceNode
    this.sourceNode = this.audioCtx.createBufferSource();
    this.sourceNode.buffer = this.track.audioBuffer;
    this.sourceNode.playbackRate.value = effectiveRate;

    // Enable seamless native hardware looping on the Web Audio buffer
    this.sourceNode.loop = true;
    if (this.loop.isActive && this.loop.endSourceSample > this.loop.startSourceSample) {
      this.sourceNode.loopStart = this.loop.startSourceSample / this.track.sampleRate;
      this.sourceNode.loopEnd = this.loop.endSourceSample / this.track.sampleRate;
    } else {
      this.sourceNode.loopStart = 0;
      this.sourceNode.loopEnd = this.track.totalSamples / this.track.sampleRate;
    }

    // Connect to crossfade gain node for smooth entry
    this.sourceNode.connect(this.crossfadeGainNode);

    // Fade in 4ms at scheduled start to ensure no DC pop
    this.crossfadeGainNode.gain.cancelScheduledValues(now);
    if (scheduledTime > now) {
      this.crossfadeGainNode.gain.setValueAtTime(0, now);
      this.crossfadeGainNode.gain.setValueAtTime(0, scheduledTime);
      this.crossfadeGainNode.gain.linearRampToValueAtTime(1.0, scheduledTime + 0.004);
    } else {
      this.crossfadeGainNode.gain.setValueAtTime(1.0, now);
    }

    // Source offset in seconds within the audio buffer
    const offsetSeconds = clampedSample / this.track.sampleRate;
    this.sourceNode.start(scheduledTime, offsetSeconds);

    this.isPlaying = true;
  }

  /**
   * Stops playback and freezes read-head at exact source sample
   */
  public pause(): void {
    if (!this.isPlaying) return;
    this.updateCurrentPosition();
    this.stopPlayback();
  }

  private stopPlayback(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {
        // Source might already be stopped
      }
      this.sourceNode = null;
    }
    this.isPlaying = false;
    this.scheduledStartTime = 0;
  }

  /**
   * Updates read-head based on monotonic audio-render clock
   */
  public updateCurrentPosition(): number {
    if (!this.track) return 0;

    if (this.isPlaying) {
      const now = this.audioCtx.currentTime;

      // If scheduled in future and hasn't reached start time yet, stay at anchor sample
      if (this.scheduledStartTime > 0 && now < this.scheduledStartTime) {
        this.currentSourceSample = this.anchorSourceSample;
        return this.currentSourceSample;
      }

      const activeStartTime = this.scheduledStartTime > 0 ? Math.max(this.scheduledStartTime, this.anchorTime) : this.anchorTime;
      const elapsedSeconds = Math.max(0, now - activeStartTime);
      const effectiveTempo = this.getEffectiveTempoMultiplier();
      const elapsedSourceSamples = elapsedSeconds * effectiveTempo * this.track.sampleRate;

      let computedSample = this.anchorSourceSample + (Number.isFinite(elapsedSourceSamples) ? elapsedSourceSamples : 0);
      if (!Number.isFinite(computedSample)) {
        computedSample = this.anchorSourceSample || 0;
      }

      // Handle active beat loop range or total track loop wrap
      if (this.loop.isActive && this.loop.endSourceSample > this.loop.startSourceSample) {
        const loopLength = this.loop.endSourceSample - this.loop.startSourceSample;
        if (computedSample >= this.loop.endSourceSample) {
          const over = (computedSample - this.loop.startSourceSample) % loopLength;
          computedSample = this.loop.startSourceSample + over;
        }
      } else if (this.track.totalSamples > 0) {
        // Continuous, mathematical loop wrap (never freezes, wavebar never vanishes)
        computedSample = ((computedSample % this.track.totalSamples) + this.track.totalSamples) % this.track.totalSamples;
      }

      this.currentSourceSample = Math.max(0, Math.min(this.track.totalSamples, computedSample));
    }

    return this.currentSourceSample;
  }

  /**
   * Seeks to exact source sample position smoothly with micro-crossfade
   */
  public seekToSourceSample(sourceSample: number, smooth: boolean = true): void {
    if (!this.track) return;
    const clampedSample = Math.max(0, Math.min(this.track.totalSamples - 100, Math.round(sourceSample)));
    this.currentSourceSample = clampedSample;

    if (this.isPlaying) {
      if (smooth) {
        // Quick 6ms micro-fade out before re-starting source
        const now = this.audioCtx.currentTime;
        this.crossfadeGainNode.gain.cancelScheduledValues(now);
        this.crossfadeGainNode.gain.setValueAtTime(this.crossfadeGainNode.gain.value, now);
        this.crossfadeGainNode.gain.linearRampToValueAtTime(0.001, now + 0.006);
        setTimeout(() => {
          if (this.isPlaying) {
            this.play(undefined, clampedSample);
          }
        }, 6);
      } else {
        this.play(undefined, clampedSample);
      }
    } else {
      this.anchorSourceSample = clampedSample;
      this.anchorTime = this.audioCtx.currentTime;
      this.scheduledStartTime = 0;
      this.updateMappingAnchor(clampedSample);
    }
  }

  /**
   * CUE button behavior:
   * If playing -> pause and return to primary cue (Hot Cue 1)
   * If paused -> set primary cue to current position and play while held
   */
  public handleCuePress(): void {
    if (this.isPlaying) {
      this.pause();
      const cue1 = this.hotCues[0];
      this.seekToSourceSample(cue1.isActive ? cue1.sourceSample : 0);
    } else {
      // Set cue point at current playhead
      this.hotCues[0].sourceSample = this.currentSourceSample;
      this.hotCues[0].isActive = true;
      this.play();
    }
  }

  public handleCueRelease(): void {
    if (this.isPlaying) {
      this.pause();
      const cue1 = this.hotCues[0];
      this.seekToSourceSample(cue1.isActive ? cue1.sourceSample : 0);
    }
  }

  /**
   * Sets or triggers Hot Cue 1-8
   */
  public triggerHotCue(id: number): void {
    if (!this.track) return;
    const cueIndex = id - 1;
    if (cueIndex < 0 || cueIndex >= this.hotCues.length) return;

    const cue = this.hotCues[cueIndex];
    if (cue.isActive) {
      // Jump to cue point
      this.seekToSourceSample(cue.sourceSample);
      if (!this.isPlaying) {
        this.play();
      }
    } else {
      // Set cue point at current position
      cue.sourceSample = Math.round(this.currentSourceSample);
      cue.isActive = true;
    }
  }

  public clearHotCue(id: number): void {
    const cueIndex = id - 1;
    if (cueIndex >= 0 && cueIndex < this.hotCues.length) {
      this.hotCues[cueIndex].isActive = false;
    }
  }

  public getHotCues(): HotCue[] {
    return [...this.hotCues];
  }

  /**
   * Seamless Beat Loop Controls
   */
  public setLoop(lengthBeats: number): void {
    if (!this.track) return;
    const samplesPerBeat = this.track.beatGrid.samplesPerBeat;
    const loopLengthSamples = Math.round(lengthBeats * samplesPerBeat);

    this.loop = {
      isActive: true,
      startSourceSample: Math.round(this.currentSourceSample),
      endSourceSample: Math.round(this.currentSourceSample + loopLengthSamples),
      lengthBeats
    };
  }

  public toggleLoop(): void {
    this.loop.isActive = !this.loop.isActive;
    if (this.loop.isActive && this.track) {
      this.setLoop(this.loop.lengthBeats || 4);
    }
  }

  public getLoop(): LoopState {
    return { ...this.loop };
  }

  /**
   * Beat Jump (move playhead forward or backward by exact beat count)
   */
  public beatJump(beats: number): void {
    if (!this.track) return;
    const deltaSamples = beats * this.track.beatGrid.samplesPerBeat;
    this.seekToSourceSample(this.currentSourceSample + deltaSamples);
  }

  /**
   * Pitch Fader (percentage -1.0 to +1.0 within range)
   */
  public setPitchPercentage(percentage: number): void {
    this.pitchPercentage = Math.max(-1.0, Math.min(1.0, percentage));
    this.updateLivePlaybackRate();
  }

  public getPitchPercentage(): number {
    return this.pitchPercentage;
  }

  public setPitchRange(range: number): void {
    this.pitchRange = range;
    this.updateLivePlaybackRate();
  }

  /**
   * Continuous PLL phase lock update from DjSyncEngine
   */
  public setPLLMultiplier(multiplier: number): void {
    const safeMultiplier = Number.isFinite(multiplier) && multiplier > 0.5 && multiplier < 2.0 ? multiplier : 1.0;
    if (Math.abs(safeMultiplier - this.pllTempoMultiplier) > 0.00005) {
      this.pllTempoMultiplier = safeMultiplier;
      this.updateLivePlaybackRate();
    }
  }

  public setBaseTempoMultiplier(multiplier: number): void {
    const safeMultiplier = Number.isFinite(multiplier) && multiplier > 0.1 && multiplier < 4.0 ? multiplier : 1.0;
    if (Math.abs(safeMultiplier - this.baseTempoMultiplier) > 0.00005) {
      this.baseTempoMultiplier = safeMultiplier;
      this.updateLivePlaybackRate();
    }
  }

  private updateLivePlaybackRate(): void {
    const rate = this.getEffectiveTempoMultiplier();
    const now = this.audioCtx.currentTime;

    if (this.isPlaying && this.sourceNode) {
      if (this.scheduledStartTime > 0 && now < this.scheduledStartTime) {
        // Playback is scheduled in future; update rate for scheduled start
        try {
          this.sourceNode.playbackRate.setValueAtTime(rate, this.scheduledStartTime);
        } catch {
          this.sourceNode.playbackRate.value = rate;
        }
      } else {
        // Only re-anchor and set rate if rate has changed by a perceptible delta
        if (Math.abs(rate - this.appliedPlaybackRate) < 0.00005) {
          return;
        }
        this.appliedPlaybackRate = rate;

        // Calculate exact current source sample up to now before rate update
        const currentSample = this.updateCurrentPosition();
        this.anchorTime = now;
        this.anchorSourceSample = currentSample;
        this.scheduledStartTime = 0;

        try {
          this.sourceNode.playbackRate.cancelScheduledValues(now);
          this.sourceNode.playbackRate.setTargetAtTime(rate, now, 0.025);
        } catch {
          this.sourceNode.playbackRate.value = rate;
        }

        if (this.track) {
          this.mapping = {
            startSourceSample: currentSample,
            startRenderFrame: Math.round(now * this.audioCtx.sampleRate),
            tempoMultiplier: rate,
            sourceSampleRate: this.track.sampleRate,
            outputSampleRate: this.audioCtx.sampleRate
          };
        }
      }
    }
  }

  /**
   * Jog Wheel Touch & Scratch
   */
  public onJogTouchDown(): void {
    this.isJogTouching = true;
  }

  public onJogTouchUp(): void {
    this.isJogTouching = false;
    this.jogPitchNudge = 0;
    this.updateLivePlaybackRate();
  }

  public onJogScratchMove(deltaAngle: number): void {
    if (!this.track) return;
    // Scratch moves the source read-head proportional to angle
    const sensitivity = 2800; // source samples per radian
    const deltaSamples = deltaAngle * sensitivity;
    this.seekToSourceSample(this.currentSourceSample + deltaSamples);
  }

  public onJogNudge(direction: number): void {
    // Nudge rim: temporary pitch bump ±4%
    this.jogPitchNudge = direction * 0.04;
    this.updateLivePlaybackRate();
    setTimeout(() => {
      this.jogPitchNudge = 0;
      this.updateLivePlaybackRate();
    }, 180);
  }

  /**
   * DJ 3-Band Isolator EQ (-26dB kill to +6dB boost)
   */
  public setLowEq(gainDb: number): void {
    this.lowEqNode.gain.setValueAtTime(gainDb, this.audioCtx.currentTime);
  }

  public setMidEq(gainDb: number): void {
    this.midEqNode.gain.setValueAtTime(gainDb, this.audioCtx.currentTime);
  }

  public setHighEq(gainDb: number): void {
    this.highEqNode.gain.setValueAtTime(gainDb, this.audioCtx.currentTime);
  }

  /**
   * Bipolar Color Filter (-1.0 LowPass to +1.0 HighPass)
   */
  public setFilter(amount: number): void {
    const clamped = Math.max(-1.0, Math.min(1.0, amount));
    if (Math.abs(clamped) < 0.04) {
      this.filterNode.type = 'allpass';
      this.filterNode.frequency.setValueAtTime(1000, this.audioCtx.currentTime);
    } else if (clamped < 0) {
      // Low-pass filter (sweeping from 20kHz down to 80Hz)
      this.filterNode.type = 'lowpass';
      const minFreq = 80;
      const maxFreq = 18000;
      const freq = minFreq * Math.pow(maxFreq / minFreq, 1.0 + clamped);
      this.filterNode.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      this.filterNode.Q.setValueAtTime(1.0 + Math.abs(clamped) * 3.5, this.audioCtx.currentTime);
    } else {
      // High-pass filter (sweeping from 20Hz up to 7500Hz)
      this.filterNode.type = 'highpass';
      const minFreq = 30;
      const maxFreq = 7500;
      const freq = minFreq * Math.pow(maxFreq / minFreq, clamped);
      this.filterNode.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      this.filterNode.Q.setValueAtTime(1.0 + clamped * 3.5, this.audioCtx.currentTime);
    }
  }

  /**
   * Channel Fader Volume (0.0 to 1.0)
   */
  public setVolume(val: number): void {
    const gain = Math.max(0, Math.min(1, val));
    this.volumeNode.gain.setValueAtTime(gain, this.audioCtx.currentTime);
  }

  public setTrimGain(val: number): void {
    const gain = Math.max(0, Math.min(2.0, val));
    this.channelGainNode.gain.setValueAtTime(gain, this.audioCtx.currentTime);
  }

  public setMaster(isMaster: boolean): void {
    this.isMaster = isMaster;
  }

  public setSync(isSync: boolean): void {
    this.isSyncEnabled = isSync;
    if (!isSync) {
      this.pllTempoMultiplier = 1.0;
      this.baseTempoMultiplier = 1.0;
      this.updateLivePlaybackRate();
    }
  }

  public toggleKeyLock(): void {
    this.keyLock = !this.keyLock;
  }

  /**
   * Calculates Level VU Meter RMS power
   */
  public updateVuMeter(): [number, number] {
    if (!this.isPlaying) {
      this.currentVuLevels = [0, 0];
      return [0, 0];
    }
    this.analyserNode.getByteFrequencyData(this.vuDataArray);
    let sum = 0;
    for (let i = 0; i < this.vuDataArray.length; i++) {
      const v = this.vuDataArray[i] / 255.0;
      sum += v * v;
    }
    const rms = Math.min(1.0, Math.sqrt(sum / this.vuDataArray.length) * 1.8);
    this.currentVuLevels = [rms, rms * (0.95 + Math.random() * 0.1)];
    return this.currentVuLevels;
  }

  /**
   * Extracts detailed real-time telemetry for rendering & synchronization monitoring
   */
  public getTelemetry(): DeckTelemetry {
    this.updateCurrentPosition();
    this.updateVuMeter();

    const bpm = this.track ? this.track.bpm : 120;
    const effectiveBpm = bpm * this.getEffectiveTempoMultiplier();

    let currentBeatIndex = 0;
    let beatInBar = 1;
    let barIndex = 1;
    let beatPhase = 0;

    if (this.track && this.track.beatGrid) {
      const grid = this.track.beatGrid;
      const offset = this.currentSourceSample - grid.firstDownbeatSample;
      const beatPos = offset / grid.samplesPerBeat;
      currentBeatIndex = Math.max(0, Math.floor(beatPos));
      beatPhase = Math.max(0, Math.min(1.0, beatPos - currentBeatIndex));
      const beatsPerBar = grid.beatsPerBar || 4;
      beatInBar = (currentBeatIndex % beatsPerBar) + 1;
      barIndex = Math.floor(currentBeatIndex / beatsPerBar) + 1;
    }

    const currentOutputFrame = Math.round(this.audioCtx.currentTime * this.audioCtx.sampleRate);
    const currentTimeSeconds = this.track ? this.currentSourceSample / this.track.sampleRate : 0;

    const warp = this.track?.warpMap;
    const kickTransientsProtected = warp ? warp.markers.filter((m) => m.isKick).length : 0;
    const snareTransientsProtected = warp ? warp.markers.filter((m) => m.isSnare).length : 0;

    return {
      deckId: this.deckId,
      trackId: this.track ? this.track.id : null,
      trackTitle: this.track ? this.track.title : 'NO TRACK LOADED',
      bpm,
      effectiveBpm,
      pitchPercentage: this.pitchPercentage,
      keyLock: this.keyLock,
      isPlaying: this.isPlaying,
      isMaster: this.isMaster,
      isSyncEnabled: this.isSyncEnabled,
      currentSourceSample: Math.round(this.currentSourceSample),
      currentOutputFrame,
      currentTimeSeconds,
      currentBeatIndex,
      beatInBar,
      barIndex,
      beatPhase,
      vuLevel: this.currentVuLevels,
      isStraightened: !!this.track?.isStraightened,
      warpStatus: warp ? {
        hasWarpMap: true,
        kickTransientsProtected,
        snareTransientsProtected,
        maxBpmDeviation: warp.maxBpmDeviation,
        sourceBpm: warp.sourceBpm
      } : undefined
    };
  }
}
