/**
 * DJ Sync Looper Engine
 * Provides pro-grade, sample-locked multi-slot audio looping synchronized
 * in real-time with the Master Deck, Deck A, or Deck B.
 */

import { LoopSlotData, LooperQuantize, LooperSyncTarget, LooperTelemetry, DeckTelemetry, TrackData } from '../types/dj';
import {
  GeneratedLoop,
  synthesizeUploadedDrumGroove,
  synthesizePercussionLoop,
  synthesizeBassLoop,
  synthesizeSynthLoop,
  extractLoopWaveform,
  captureLoopFromDeckBuffer
} from './loopGenerator';

class LoopSlotInstance {
  public id: string;
  public name: string;
  public category: LoopSlotData['category'];
  public bpm: number;
  public totalBeats: number;
  public audioBuffer: AudioBuffer;
  public waveform: Float32Array;

  public isPlaying = false;
  public isMuted = false;
  public isSoloed = false;
  public volume = 0.85;
  public filter = 0.0;
  public activeLoopBeats: number;
  public isPendingQuantize = false;
  public pendingStartTime = 0;
  public isRollActive = false;
  public rollBeats = 1;
  public normalLoopBeats: number;
  public isUserUploaded = false;
  public fileName?: string;

  // Web Audio Nodes
  public sourceNode: AudioBufferSourceNode | null = null;
  public filterNode: BiquadFilterNode;
  public volumeNode: GainNode;
  public muteNode: GainNode;
  public analyserNode: AnalyserNode;
  private vuData: Uint8Array;

  // Hardware timing anchors
  public anchorAudioTime = 0;
  public anchorSample = 0;
  public currentSourceSample = 0;
  public currentRate = 1.0;

  constructor(
    private audioCtx: AudioContext,
    outputNode: GainNode,
    loopData: GeneratedLoop
  ) {
    this.id = loopData.id;
    this.name = loopData.name;
    this.category = loopData.category;
    this.bpm = loopData.bpm;
    this.totalBeats = loopData.totalBeats;
    this.audioBuffer = loopData.audioBuffer;
    this.waveform = loopData.waveform;
    this.activeLoopBeats = loopData.totalBeats;
    this.normalLoopBeats = loopData.totalBeats;

    // Filter Node (DJ combo filter: LowPass <-> Neutral <-> HighPass)
    this.filterNode = audioCtx.createBiquadFilter();
    this.filterNode.type = 'allpass';
    this.filterNode.frequency.value = 1000;
    this.filterNode.Q.value = 1.2;

    // Volume Node
    this.volumeNode = audioCtx.createGain();
    this.volumeNode.gain.value = this.volume;

    // Mute Node
    this.muteNode = audioCtx.createGain();
    this.muteNode.gain.value = 1.0;

    // Analyser Node for level meter
    this.analyserNode = audioCtx.createAnalyser();
    this.analyserNode.fftSize = 64;
    this.analyserNode.smoothingTimeConstant = 0.8;
    this.vuData = new Uint8Array(this.analyserNode.frequencyBinCount);

    // Audio routing
    this.filterNode.connect(this.volumeNode);
    this.volumeNode.connect(this.muteNode);
    this.muteNode.connect(this.analyserNode);
    this.analyserNode.connect(outputNode);
  }

  public setFilter(val: number) {
    this.filter = Math.max(-1, Math.min(1, val));
    const now = this.audioCtx.currentTime;
    if (this.filter < -0.02) {
      // Low pass filter: 20kHz down to 250Hz
      this.filterNode.type = 'lowpass';
      const norm = (this.filter + 1); // 0 to 1
      const cutoff = 250 * Math.pow(20000 / 250, norm);
      this.filterNode.frequency.setTargetAtTime(cutoff, now, 0.015);
    } else if (this.filter > 0.02) {
      // High pass filter: 20Hz up to 6000Hz
      this.filterNode.type = 'highpass';
      const norm = this.filter; // 0 to 1
      const cutoff = 20 * Math.pow(6000 / 20, norm);
      this.filterNode.frequency.setTargetAtTime(cutoff, now, 0.015);
    } else {
      this.filterNode.type = 'allpass';
    }
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1.2, val));
    this.volumeNode.gain.setTargetAtTime(this.volume, this.audioCtx.currentTime, 0.01);
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    this.muteNode.gain.setTargetAtTime(this.isMuted ? 0 : 1, this.audioCtx.currentTime, 0.01);
  }

  public play(startTime: number, targetBpm: number, startSampleOffset = 0) {
    this.stop();

    const rate = targetBpm / this.bpm;
    this.currentRate = rate;

    const source = this.audioCtx.createBufferSource();
    source.buffer = this.audioBuffer;
    source.playbackRate.value = rate;
    source.loop = true;

    // Loop bounds based on activeLoopBeats
    const secondsPerBeat = 60 / this.bpm;
    const loopDuration = this.activeLoopBeats * secondsPerBeat;
    source.loopStart = 0;
    source.loopEnd = loopDuration;

    source.connect(this.filterNode);

    const safeStart = Math.max(this.audioCtx.currentTime, startTime);
    source.start(safeStart, startSampleOffset / this.audioBuffer.sampleRate);

    this.sourceNode = source;
    this.isPlaying = true;
    this.anchorAudioTime = safeStart;
    this.anchorSample = startSampleOffset;
  }

  public stop() {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {
        // Safe ignore
      }
      this.sourceNode = null;
    }
    this.isPlaying = false;
    this.isPendingQuantize = false;
    this.currentSourceSample = 0;
  }

  public setLoopBeats(beats: number) {
    this.activeLoopBeats = Math.max(0.25, Math.min(this.totalBeats, beats));
    this.normalLoopBeats = this.activeLoopBeats;
    if (this.sourceNode) {
      const secondsPerBeat = 60 / this.bpm;
      this.sourceNode.loopStart = 0;
      this.sourceNode.loopEnd = this.activeLoopBeats * secondsPerBeat;
    }
  }

  public triggerRoll(rollBeats: number) {
    this.isRollActive = true;
    this.rollBeats = rollBeats;
    if (this.sourceNode) {
      const secondsPerBeat = 60 / this.bpm;
      const currentPosSeconds = (this.currentSourceSample / this.audioBuffer.sampleRate);
      const beatNow = Math.floor(currentPosSeconds / secondsPerBeat);
      const rollStart = beatNow * secondsPerBeat;
      const rollEnd = rollStart + rollBeats * secondsPerBeat;
      this.sourceNode.loopStart = rollStart;
      this.sourceNode.loopEnd = rollEnd;
    }
  }

  public releaseRoll() {
    this.isRollActive = false;
    this.setLoopBeats(this.normalLoopBeats);
  }

  public getVuLevel(): number {
    if (!this.isPlaying || this.isMuted) return 0;
    this.analyserNode.getByteTimeDomainData(this.vuData);
    let sum = 0;
    for (let i = 0; i < this.vuData.length; i++) {
      const v = (this.vuData[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.vuData.length);
    return Math.min(1.0, rms * 2.8);
  }

  public toData(): LoopSlotData {
    const samplesPerBeat = (this.audioBuffer.sampleRate * 60) / this.bpm;
    const totalSampleLength = this.activeLoopBeats * samplesPerBeat;
    const normalizedSample = totalSampleLength > 0 ? (this.currentSourceSample % totalSampleLength) : 0;
    const beatInLoopFloat = totalSampleLength > 0 ? (normalizedSample / samplesPerBeat) : 0;
    const beatIndex = Math.floor(beatInLoopFloat);
    const phase = beatInLoopFloat - beatIndex;

    return {
      id: this.id,
      name: this.name,
      category: this.category,
      bpm: this.bpm,
      totalBeats: this.totalBeats,
      audioBuffer: this.audioBuffer,
      waveform: this.waveform,
      isPlaying: this.isPlaying,
      isMuted: this.isMuted,
      isSoloed: this.isSoloed,
      volume: this.volume,
      filter: this.filter,
      activeLoopBeats: this.activeLoopBeats,
      currentBeatIndex: beatIndex,
      beatInLoop: beatIndex + 1,
      beatPhase: phase,
      isPendingQuantize: this.isPendingQuantize,
      isRollActive: this.isRollActive,
      rollBeats: this.rollBeats,
      vuLevel: this.getVuLevel(),
      isUserUploaded: this.isUserUploaded,
      fileName: this.fileName
    };
  }
}

export class DjLooper {
  private masterLooperGain: GainNode;
  private slots: LoopSlotInstance[] = [];
  private syncTarget: LooperSyncTarget = 'AUTO';
  private quantize: LooperQuantize = '1_BEAT';
  private masterVolume = 1.0;

  constructor(
    public readonly audioCtx: AudioContext,
    destinationGain: GainNode
  ) {
    this.masterLooperGain = audioCtx.createGain();
    this.masterLooperGain.gain.value = this.masterVolume;
    this.masterLooperGain.connect(destinationGain);

    this.initDefaultSlots();
  }

  private initDefaultSlots() {
    // 1. Uploaded drum loop (128 BPM)
    const uploadedGroove = synthesizeUploadedDrumGroove(this.audioCtx, 128, 4);
    // 2. Tribal percussion & shaker (128 BPM)
    const percussion = synthesizePercussionLoop(this.audioCtx, 128, 4);
    // 3. Sub bassline (128 BPM)
    const subBass = synthesizeBassLoop(this.audioCtx, 128, 4);
    // 4. Vocal & synth chord stabs (128 BPM)
    const synthStabs = synthesizeSynthLoop(this.audioCtx, 128, 4);

    this.slots = [
      new LoopSlotInstance(this.audioCtx, this.masterLooperGain, uploadedGroove),
      new LoopSlotInstance(this.audioCtx, this.masterLooperGain, percussion),
      new LoopSlotInstance(this.audioCtx, this.masterLooperGain, subBass),
      new LoopSlotInstance(this.audioCtx, this.masterLooperGain, synthStabs),
    ];
  }

  /**
   * Evaluates real-time synchronization against master and active decks.
   * Keeps pitch, tempo, and downbeat phase perfectly aligned.
   */
  public updateSyncTick(
    telemetryA: DeckTelemetry | null,
    telemetryB: DeckTelemetry | null,
    trackA: TrackData | null,
    trackB: TrackData | null
  ) {
    const now = this.audioCtx.currentTime;

    // Determine target deck based on sync mode
    let targetTelem: DeckTelemetry | null = null;
    let targetTrack: TrackData | null = null;

    if (this.syncTarget === 'DECK_A') {
      targetTelem = telemetryA;
      targetTrack = trackA;
    } else if (this.syncTarget === 'DECK_B') {
      targetTelem = telemetryB;
      targetTrack = trackB;
    } else {
      // AUTO mode: Prioritize master, then playing deck
      if (telemetryA?.isMaster && telemetryA.isPlaying) {
        targetTelem = telemetryA;
        targetTrack = trackA;
      } else if (telemetryB?.isMaster && telemetryB.isPlaying) {
        targetTelem = telemetryB;
        targetTrack = trackB;
      } else if (telemetryA?.isPlaying) {
        targetTelem = telemetryA;
        targetTrack = trackA;
      } else if (telemetryB?.isPlaying) {
        targetTelem = telemetryB;
        targetTrack = trackB;
      } else {
        // Fallback: master even if stopped
        targetTelem = telemetryA?.isMaster ? telemetryA : telemetryB;
        targetTrack = telemetryA?.isMaster ? trackA : trackB;
      }
    }

    const effectiveBpm = targetTelem ? targetTelem.effectiveBpm : 128.0;
    const isTargetPlaying = Boolean(targetTelem?.isPlaying);

    // Update each playing slot
    for (const slot of this.slots) {
      if (slot.isPendingQuantize) {
        if (now >= slot.pendingStartTime) {
          slot.isPendingQuantize = false;
        }
      }

      if (slot.isPlaying && slot.sourceNode) {
        // Continuous source sample position tracking
        const elapsed = Math.max(0, now - slot.anchorAudioTime);
        const advanceSamples = elapsed * slot.currentRate * slot.audioBuffer.sampleRate;
        const totalSampleLen = slot.activeLoopBeats * ((slot.audioBuffer.sampleRate * 60) / slot.bpm);
        
        let samplePos = slot.anchorSample + advanceSamples;
        if (totalSampleLen > 0) {
          samplePos = ((samplePos % totalSampleLen) + totalSampleLen) % totalSampleLen;
        }
        slot.currentSourceSample = samplePos;

        // Base rate needed to match target BPM
        const baseRate = effectiveBpm / slot.bpm;

        // If target deck is playing, perform micro phase alignment
        if (isTargetPlaying && targetTelem && targetTrack) {
          const masterBeatFloat = targetTelem.currentBeatIndex + targetTelem.beatPhase;
          const slotSamplesPerBeat = (slot.audioBuffer.sampleRate * 60) / slot.bpm;
          const slotBeatFloat = slot.currentSourceSample / slotSamplesPerBeat;

          // Phase error relative to current loop length
          const masterMod = ((masterBeatFloat % slot.activeLoopBeats) + slot.activeLoopBeats) % slot.activeLoopBeats;
          const slotMod = ((slotBeatFloat % slot.activeLoopBeats) + slot.activeLoopBeats) % slot.activeLoopBeats;

          let phaseDiff = slotMod - masterMod;
          if (phaseDiff > slot.activeLoopBeats * 0.5) phaseDiff -= slot.activeLoopBeats;
          if (phaseDiff < -slot.activeLoopBeats * 0.5) phaseDiff += slot.activeLoopBeats;

          // If phase drift exceeds 1.5% of a beat, gently nudge
          let rateNudge = 0;
          if (Math.abs(phaseDiff) > 0.015) {
            rateNudge = -Math.sign(phaseDiff) * Math.min(0.04, Math.abs(phaseDiff) * 0.35);
          }

          const targetRate = baseRate * (1.0 + rateNudge);
          if (Math.abs(targetRate - slot.currentRate) > 0.0005) {
            slot.currentRate = targetRate;
            try {
              slot.sourceNode.playbackRate.setTargetAtTime(targetRate, now, 0.025);
            } catch {
              slot.sourceNode.playbackRate.value = targetRate;
            }
          }
        } else {
          // Free running or target stopped: hold exact base rate
          if (Math.abs(baseRate - slot.currentRate) > 0.0005) {
            slot.currentRate = baseRate;
            try {
              slot.sourceNode.playbackRate.setTargetAtTime(baseRate, now, 0.025);
            } catch {
              slot.sourceNode.playbackRate.value = baseRate;
            }
          }
        }
      }
    }
  }

  /**
   * Triggers a loop slot with beat-perfect or bar-perfect quantized launch
   */
  public togglePlaySlot(
    slotId: string,
    telemetryA: DeckTelemetry | null,
    telemetryB: DeckTelemetry | null,
    trackA: TrackData | null,
    trackB: TrackData | null
  ) {
    const slot = this.slots.find((s) => s.id === slotId);
    if (!slot) return;

    if (slot.isPlaying) {
      slot.stop();
      return;
    }

    // Determine target deck
    const isA = this.syncTarget === 'DECK_A' || (this.syncTarget === 'AUTO' && telemetryA?.isMaster);
    const targetTelem = isA ? telemetryA : telemetryB;
    const targetTrack = isA ? trackA : trackB;

    const targetBpm = targetTelem ? targetTelem.effectiveBpm : 128.0;
    const isTargetPlaying = Boolean(targetTelem?.isPlaying);
    const now = this.audioCtx.currentTime;

    if (!isTargetPlaying || this.quantize === 'INSTANT' || !targetTrack || !targetTelem) {
      // Start immediately
      slot.play(now, targetBpm, 0);
      return;
    }

    // Calculate exact AudioContext time of the next quantized beat or bar boundary
    const samplesPerBeat = (targetTrack.sampleRate * 60) / targetBpm;
    const firstDownbeat = targetTrack.beatGrid.firstDownbeatSample || 0;
    const currentSample = targetTelem.currentSourceSample;
    const beatsFromDownbeat = (currentSample - firstDownbeat) / samplesPerBeat;

    let targetBeatBoundary: number;
    let startSampleInLoop = 0;

    if (this.quantize === '1_BAR') {
      // Launch exactly on the next Bar 1 (Beat 1)
      const currentBar = Math.floor(beatsFromDownbeat / 4);
      targetBeatBoundary = (currentBar + 1) * 4;
      startSampleInLoop = 0; // Starts at downbeat of loop
    } else if (this.quantize === 'HALF_BEAT') {
      // Launch on next half beat
      targetBeatBoundary = Math.ceil(beatsFromDownbeat * 2) / 2;
      const beatInSlot = targetBeatBoundary % slot.activeLoopBeats;
      startSampleInLoop = beatInSlot * ((slot.audioBuffer.sampleRate * 60) / slot.bpm);
    } else {
      // 1_BEAT: Launch on next integer beat
      targetBeatBoundary = Math.floor(beatsFromDownbeat) + 1;
      const beatInSlot = targetBeatBoundary % slot.activeLoopBeats;
      startSampleInLoop = beatInSlot * ((slot.audioBuffer.sampleRate * 60) / slot.bpm);
    }

    const samplesToWait = (firstDownbeat + targetBeatBoundary * samplesPerBeat) - currentSample;
    const secondsToWait = samplesToWait / (targetTrack.sampleRate * (targetBpm / targetTrack.bpm));
    const scheduledAudioTime = now + Math.max(0.01, secondsToWait);

    slot.isPendingQuantize = true;
    slot.pendingStartTime = scheduledAudioTime;
    slot.play(scheduledAudioTime, targetBpm, startSampleInLoop);
  }

  public stopAll() {
    this.slots.forEach((s) => s.stop());
  }

  public playAll(
    telemetryA: DeckTelemetry | null,
    telemetryB: DeckTelemetry | null,
    trackA: TrackData | null,
    trackB: TrackData | null
  ) {
    this.slots.forEach((s) => {
      if (!s.isPlaying) {
        this.togglePlaySlot(s.id, telemetryA, telemetryB, trackA, trackB);
      }
    });
  }

  public setSlotLoopBeats(slotId: string, beats: number) {
    const slot = this.slots.find((s) => s.id === slotId);
    if (slot) {
      slot.setLoopBeats(beats);
    }
  }

  public halveSlotLoop(slotId: string) {
    const slot = this.slots.find((s) => s.id === slotId);
    if (slot) {
      slot.setLoopBeats(Math.max(0.25, slot.activeLoopBeats / 2));
    }
  }

  public doubleSlotLoop(slotId: string) {
    const slot = this.slots.find((s) => s.id === slotId);
    if (slot) {
      slot.setLoopBeats(Math.min(slot.totalBeats, slot.activeLoopBeats * 2));
    }
  }

  public triggerSlotRoll(slotId: string, beats: number) {
    const slot = this.slots.find((s) => s.id === slotId);
    if (slot) {
      slot.triggerRoll(beats);
    }
  }

  public releaseSlotRoll(slotId: string) {
    const slot = this.slots.find((s) => s.id === slotId);
    if (slot) {
      slot.releaseRoll();
    }
  }

  public setSlotVolume(slotId: string, val: number) {
    const slot = this.slots.find((s) => s.id === slotId);
    if (slot) {
      slot.setVolume(val);
    }
  }

  public setSlotFilter(slotId: string, val: number) {
    const slot = this.slots.find((s) => s.id === slotId);
    if (slot) {
      slot.setFilter(val);
    }
  }

  public toggleSlotMute(slotId: string) {
    const slot = this.slots.find((s) => s.id === slotId);
    if (slot) {
      slot.setMute(!slot.isMuted);
    }
  }

  public toggleSlotSolo(slotId: string) {
    const target = this.slots.find((s) => s.id === slotId);
    if (!target) return;

    const newSolo = !target.isSoloed;
    target.isSoloed = newSolo;

    if (newSolo) {
      // Mute all other slots
      this.slots.forEach((s) => {
        if (s.id !== slotId) {
          s.setMute(true);
          s.isSoloed = false;
        } else {
          s.setMute(false);
        }
      });
    } else {
      // Unmute all
      this.slots.forEach((s) => {
        s.setMute(false);
        s.isSoloed = false;
      });
    }
  }

  public setSyncTarget(target: LooperSyncTarget) {
    this.syncTarget = target;
  }

  public setQuantize(q: LooperQuantize) {
    this.quantize = q;
  }

  public setMasterVolume(v: number) {
    this.masterVolume = Math.max(0, Math.min(1.5, v));
    this.masterLooperGain.gain.setTargetAtTime(this.masterVolume, this.audioCtx.currentTime, 0.01);
  }

  /**
   * Loads a custom audio file into a specific slot
   */
  public async loadCustomAudioIntoSlot(slotIndex: number, file: File, forcedBars?: number): Promise<void> {
    if (slotIndex < 0 || slotIndex >= this.slots.length) return;
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);

    const waveform = extractLoopWaveform(audioBuffer, 64);
    const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');

    // Check if BPM is in name, e.g. "Percussion_124bpm.wav"
    const bpmMatch = file.name.match(/(?:^|[_\s-])(\d{2,3})(?:\s*bpm|[_\s-]|$)/i);
    const filenameBpm = bpmMatch ? parseInt(bpmMatch[1], 10) : null;

    const duration = audioBuffer.duration;
    let beats: number;
    let estimatedBpm: number;

    if (forcedBars) {
      beats = Math.max(1, forcedBars * 4);
      estimatedBpm = Math.round((beats / duration) * 60);
    } else if (filenameBpm && filenameBpm >= 60 && filenameBpm <= 200) {
      estimatedBpm = filenameBpm;
      const calculatedBeats = Math.round(duration * (filenameBpm / 60));
      // Round to nearest musical power of 2 or multiple of 4
      beats = Math.max(1, Math.min(64, calculatedBeats));
    } else {
      // Guess bars (1 bar = 4 beats, 2 bars = 8 beats, 4 bars = 16 beats, 8 bars = 32 beats)
      const approxBeats = Math.round(duration * (128 / 60));
      // Snap to nearest 2, 4, 8, 16, 32
      const candidateBeats = [2, 4, 8, 16, 32];
      let bestBeats = 16;
      let minDiff = Infinity;
      for (const b of candidateBeats) {
        const diff = Math.abs(approxBeats - b);
        if (diff < minDiff) {
          minDiff = diff;
          bestBeats = b;
        }
      }
      beats = bestBeats;
      estimatedBpm = Math.round((beats / duration) * 60);
      if (estimatedBpm < 60 || estimatedBpm > 200) {
        estimatedBpm = 128;
      }
    }

    const newSlot = new LoopSlotInstance(this.audioCtx, this.masterLooperGain, {
      id: `custom-slot-${slotIndex}-${Date.now()}`,
      name: cleanName,
      category: 'custom',
      bpm: estimatedBpm,
      totalBeats: beats,
      audioBuffer,
      waveform
    });

    newSlot.isUserUploaded = true;
    newSlot.fileName = file.name;

    this.slots[slotIndex].stop();
    this.slots[slotIndex] = newSlot;
  }

  /**
   * Updates the musical bar count of a slot, recalculating exact loop BPM
   * to guarantee zero drift synchronization with master track
   */
  public setSlotBars(slotIndex: number, bars: number): void {
    if (slotIndex < 0 || slotIndex >= this.slots.length) return;
    const slot = this.slots[slotIndex];
    if (!slot.audioBuffer) return;

    const duration = slot.audioBuffer.duration;
    const beats = Math.max(1, Math.round(bars * 4));
    const newBpm = (beats / duration) * 60;

    slot.totalBeats = beats;
    slot.activeLoopBeats = beats;
    slot.normalLoopBeats = beats;
    slot.bpm = Math.round(newBpm * 100) / 100;
  }

  /**
   * Adds a new custom loop slot if room allows
   */
  public async addCustomLoopSlot(file: File): Promise<number> {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
    const waveform = extractLoopWaveform(audioBuffer, 64);
    const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');

    const duration = audioBuffer.duration;
    const approxBeats = Math.round(duration * (128 / 60));
    const beats = Math.max(4, Math.min(32, approxBeats));
    const estimatedBpm = Math.round((beats / duration) * 60);

    const newSlot = new LoopSlotInstance(this.audioCtx, this.masterLooperGain, {
      id: `custom-slot-${this.slots.length}-${Date.now()}`,
      name: cleanName,
      category: 'custom',
      bpm: estimatedBpm || 128,
      totalBeats: beats,
      audioBuffer,
      waveform
    });

    newSlot.isUserUploaded = true;
    newSlot.fileName = file.name;

    this.slots.push(newSlot);
    return this.slots.length - 1;
  }

  /**
   * Captures 4 bars directly from a playing deck's buffer into a slot
   */
  public captureFromDeck(
    slotIndex: number,
    deckTelem: DeckTelemetry,
    deckTrack: TrackData
  ): boolean {
    if (slotIndex < 0 || slotIndex >= this.slots.length || !deckTrack.audioBuffer) return false;

    const sampleRate = deckTrack.sampleRate;
    const bpm = deckTelem.effectiveBpm || deckTrack.bpm;
    const samplesPerBeat = (sampleRate * 60) / bpm;
    const beatsToCapture = 16; // 4 bars
    const lengthSamples = Math.round(beatsToCapture * samplesPerBeat);

    // Align start to the nearest downbeat
    const firstDownbeat = deckTrack.beatGrid.firstDownbeatSample || 0;
    const currentSample = deckTelem.currentSourceSample;
    const beatsFromStart = Math.floor((currentSample - firstDownbeat) / samplesPerBeat);
    const nearestBarBeat = Math.floor(beatsFromStart / 4) * 4;
    const startSample = Math.max(0, firstDownbeat + nearestBarBeat * samplesPerBeat);

    const captured = captureLoopFromDeckBuffer(
      this.audioCtx,
      deckTrack.audioBuffer,
      startSample,
      lengthSamples,
      bpm,
      `Deck ${deckTelem.deckId} 4-Bar Capture`
    );

    this.slots[slotIndex].stop();
    this.slots[slotIndex] = new LoopSlotInstance(this.audioCtx, this.masterLooperGain, captured);
    return true;
  }

  public getTelemetry(telemetryA: DeckTelemetry | null, telemetryB: DeckTelemetry | null): LooperTelemetry {
    const isA = this.syncTarget === 'DECK_A' || (this.syncTarget === 'AUTO' && telemetryA?.isMaster);
    const activeTelem = isA ? telemetryA : telemetryB;

    const activeBpm = activeTelem ? activeTelem.effectiveBpm : 128.0;
    const barIndex = activeTelem ? activeTelem.barIndex : 1;
    const beatInBar = activeTelem ? activeTelem.beatInBar : 1;
    const beatPhase = activeTelem ? activeTelem.beatPhase : 0;
    const isAnyPlaying = this.slots.some((s) => s.isPlaying);

    return {
      syncTarget: this.syncTarget,
      quantize: this.quantize,
      isMasterSynced: Boolean(activeTelem?.isPlaying),
      activeTargetBpm: activeBpm,
      masterBarIndex: barIndex,
      masterBeatInBar: beatInBar,
      masterBeatPhase: beatPhase,
      isAnyPlaying,
      masterVolume: this.masterVolume,
      slots: this.slots.map((s) => s.toData())
    };
  }

  public destroy() {
    this.stopAll();
    this.masterLooperGain.disconnect();
  }
}
