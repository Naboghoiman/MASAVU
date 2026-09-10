/**
 * DJ Performance Sampler Engine
 * Sample-accurate 8-pad velocity-sensitive trigger board with tempo sync,
 * quantize launch matching active decks, pitch shifting, and local storage audio upload.
 */

import { DeckTelemetry, SamplerPadData, SamplerPlayMode, SamplerQuantize, SamplerTelemetry, TrackData } from '../types/dj';
import { getDefaultSamplerPresets, GeneratedSample } from './sampleGenerator';
import { extractLoopWaveform } from './loopGenerator';

class SamplerPadInstance {
  public id: string;
  public name: string;
  public color: string;
  public category: SamplerPadData['category'];
  public audioBuffer: AudioBuffer;
  public waveform: Float32Array;
  public originalBpm: number;

  public isPlaying = false;
  public playMode: SamplerPlayMode = 'oneshot';
  public volume = 0.9;
  public pitchSemitones = 0; // -12 to +12
  public tempoSync = false;
  public quantize: SamplerQuantize = 'INSTANT';
  public isUserUploaded = false;
  public fileName?: string;

  // Web Audio Nodes
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode;
  private analyserNode: AnalyserNode;
  private vuData: Uint8Array;

  constructor(
    private audioCtx: AudioContext,
    outputNode: GainNode,
    sample: GeneratedSample
  ) {
    this.id = sample.id;
    this.name = sample.name;
    this.color = sample.color;
    this.category = sample.category;
    this.audioBuffer = sample.audioBuffer;
    this.waveform = sample.waveform;
    this.originalBpm = sample.bpm;

    this.gainNode = audioCtx.createGain();
    this.gainNode.gain.value = this.volume;

    this.analyserNode = audioCtx.createAnalyser();
    this.analyserNode.fftSize = 64;
    this.analyserNode.smoothingTimeConstant = 0.7;
    this.vuData = new Uint8Array(this.analyserNode.frequencyBinCount);

    this.gainNode.connect(this.analyserNode);
    this.analyserNode.connect(outputNode);
  }

  public trigger(
    startTime: number,
    targetBpm: number,
    velocity = 1.0
  ) {
    // If oneshot or gate, stop previous instance
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {
        // Safe ignore
      }
      this.sourceNode = null;
    }

    const source = this.audioCtx.createBufferSource();
    source.buffer = this.audioBuffer;

    // Pitch & playback rate calculation:
    // Rate = 2^(semitones / 12) * (tempoSync ? targetBpm / originalBpm : 1.0)
    const pitchMultiplier = Math.pow(2, this.pitchSemitones / 12);
    const tempoMultiplier = this.tempoSync && this.originalBpm > 0 ? targetBpm / this.originalBpm : 1.0;
    const finalRate = Math.max(0.1, Math.min(4.0, pitchMultiplier * tempoMultiplier));

    source.playbackRate.value = finalRate;

    if (this.playMode === 'loop') {
      source.loop = true;
      source.loopStart = 0;
      source.loopEnd = this.audioBuffer.duration;
    } else {
      source.loop = false;
    }

    // Velocity scaling
    const hitVolume = Math.max(0, Math.min(1.5, this.volume * velocity));
    this.gainNode.gain.cancelScheduledValues(this.audioCtx.currentTime);
    this.gainNode.gain.setValueAtTime(hitVolume, Math.max(this.audioCtx.currentTime, startTime));

    source.connect(this.gainNode);

    const safeStart = Math.max(this.audioCtx.currentTime, startTime);
    source.start(safeStart);
    this.sourceNode = source;
    this.isPlaying = true;

    source.onended = () => {
      if (this.sourceNode === source) {
        this.isPlaying = false;
        this.sourceNode = null;
      }
    };
  }

  public release() {
    if (this.playMode === 'gate' && this.sourceNode) {
      const now = this.audioCtx.currentTime;
      // Quick release ramp
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setTargetAtTime(0.0001, now, 0.02);
      setTimeout(() => {
        if (this.sourceNode) {
          try {
            this.sourceNode.stop();
            this.sourceNode.disconnect();
          } catch {
            // ignore
          }
          this.sourceNode = null;
          this.isPlaying = false;
        }
      }, 50);
    }
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
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1.5, val));
    this.gainNode.gain.setTargetAtTime(this.volume, this.audioCtx.currentTime, 0.01);
  }

  public setPitch(semitones: number) {
    this.pitchSemitones = Math.max(-12, Math.min(12, semitones));
    if (this.sourceNode && this.isPlaying) {
      const pitchMultiplier = Math.pow(2, this.pitchSemitones / 12);
      this.sourceNode.playbackRate.setTargetAtTime(pitchMultiplier, this.audioCtx.currentTime, 0.02);
    }
  }

  public getVuLevel(): number {
    if (!this.isPlaying) return 0;
    this.analyserNode.getByteTimeDomainData(this.vuData);
    let sum = 0;
    for (let i = 0; i < this.vuData.length; i++) {
      const v = (this.vuData[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.vuData.length);
    return Math.min(1.0, rms * 2.8);
  }

  public toData(): SamplerPadData {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      category: this.category,
      audioBuffer: this.audioBuffer,
      waveform: this.waveform,
      isPlaying: this.isPlaying,
      playMode: this.playMode,
      volume: this.volume,
      pitchSemitones: this.pitchSemitones,
      tempoSync: this.tempoSync,
      originalBpm: this.originalBpm,
      quantize: this.quantize,
      vuLevel: this.getVuLevel(),
      isUserUploaded: this.isUserUploaded,
      fileName: this.fileName
    };
  }
}

export class DjSampler {
  private masterSamplerGain: GainNode;
  private pads: SamplerPadInstance[] = [];
  private masterVolume = 1.0;
  private globalQuantize: SamplerQuantize = 'INSTANT';
  private tempoSyncAll = true;

  constructor(
    public readonly audioCtx: AudioContext,
    destinationGain: GainNode
  ) {
    this.masterSamplerGain = audioCtx.createGain();
    this.masterSamplerGain.gain.value = this.masterVolume;
    this.masterSamplerGain.connect(destinationGain);

    this.initDefaultPads();
  }

  private initDefaultPads() {
    const presets = getDefaultSamplerPresets(this.audioCtx);
    this.pads = presets.map((preset) => new SamplerPadInstance(this.audioCtx, this.masterSamplerGain, preset));
  }

  public updateSyncTick(
    telemetryA: DeckTelemetry | null,
    telemetryB: DeckTelemetry | null,
    trackA: TrackData | null,
    trackB: TrackData | null
  ) {
    // Keep internal audio time synchronized
  }

  /**
   * Triggers a sampler pad with optional quantize matching active deck downbeat
   */
  public triggerPad(
    padIndex: number,
    velocity = 1.0,
    targetTelem?: DeckTelemetry | null,
    targetTrack?: TrackData | null
  ) {
    if (padIndex < 0 || padIndex >= this.pads.length) return;
    const pad = this.pads[padIndex];

    const targetBpm = targetTelem ? targetTelem.effectiveBpm : 128.0;
    const isTargetPlaying = Boolean(targetTelem?.isPlaying);
    const now = this.audioCtx.currentTime;

    const padQuantize = pad.quantize !== 'INSTANT' ? pad.quantize : this.globalQuantize;

    if (!isTargetPlaying || padQuantize === 'INSTANT' || !targetTrack || !targetTelem) {
      pad.trigger(now, targetBpm, velocity);
      return;
    }

    // Calculate exact AudioContext time of the next quantized beat boundary
    const samplesPerBeat = (targetTrack.sampleRate * 60) / targetBpm;
    const firstDownbeat = targetTrack.beatGrid.firstDownbeatSample || 0;
    const currentSample = targetTelem.currentSourceSample;
    const beatsFromDownbeat = (currentSample - firstDownbeat) / samplesPerBeat;

    let targetBeatBoundary: number;
    if (padQuantize === '1_BEAT') {
      targetBeatBoundary = Math.floor(beatsFromDownbeat) + 1;
    } else if (padQuantize === 'HALF_BEAT') {
      targetBeatBoundary = Math.ceil(beatsFromDownbeat * 2) / 2;
    } else {
      // QUARTER_BEAT
      targetBeatBoundary = Math.ceil(beatsFromDownbeat * 4) / 4;
    }

    const samplesToWait = (firstDownbeat + targetBeatBoundary * samplesPerBeat) - currentSample;
    const secondsToWait = samplesToWait / (targetTrack.sampleRate * (targetBpm / targetTrack.bpm));
    const scheduledAudioTime = now + Math.max(0.005, secondsToWait);

    pad.trigger(scheduledAudioTime, targetBpm, velocity);
  }

  public releasePad(padIndex: number) {
    if (padIndex >= 0 && padIndex < this.pads.length) {
      this.pads[padIndex].release();
    }
  }

  public stopPad(padIndex: number) {
    if (padIndex >= 0 && padIndex < this.pads.length) {
      this.pads[padIndex].stop();
    }
  }

  public stopAll() {
    this.pads.forEach((p) => p.stop());
  }

  public setPadVolume(padIndex: number, val: number) {
    if (padIndex >= 0 && padIndex < this.pads.length) {
      this.pads[padIndex].setVolume(val);
    }
  }

  public setPadPitch(padIndex: number, semitones: number) {
    if (padIndex >= 0 && padIndex < this.pads.length) {
      this.pads[padIndex].setPitch(semitones);
    }
  }

  public setPadPlayMode(padIndex: number, mode: SamplerPlayMode) {
    if (padIndex >= 0 && padIndex < this.pads.length) {
      this.pads[padIndex].playMode = mode;
    }
  }

  public setPadTempoSync(padIndex: number, enabled: boolean) {
    if (padIndex >= 0 && padIndex < this.pads.length) {
      this.pads[padIndex].tempoSync = enabled;
    }
  }

  public setPadQuantize(padIndex: number, quantize: SamplerQuantize) {
    if (padIndex >= 0 && padIndex < this.pads.length) {
      this.pads[padIndex].quantize = quantize;
    }
  }

  public setMasterVolume(val: number) {
    this.masterVolume = Math.max(0, Math.min(1.5, val));
    this.masterSamplerGain.gain.setTargetAtTime(this.masterVolume, this.audioCtx.currentTime, 0.01);
  }

  public setGlobalQuantize(q: SamplerQuantize) {
    this.globalQuantize = q;
  }

  /**
   * Uploads custom audio file from local storage into a sampler pad socket
   */
  public async loadCustomSampleIntoPad(padIndex: number, file: File): Promise<void> {
    if (padIndex < 0 || padIndex >= this.pads.length) return;

    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
    const waveform = extractLoopWaveform(audioBuffer, 48);

    const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ').toUpperCase();

    // Check if BPM is in name, e.g. "Vocal_128bpm.wav"
    const match = file.name.match(/(?:^|[_\s-])(\d{2,3})(?:\s*bpm|[_\s-]|$)/i);
    const detectedBpm = match ? parseInt(match[1], 10) : 128;

    const colorPalette = ['#F59E0B', '#EF4444', '#06B6D4', '#A855F7', '#3B82F6', '#EC4899', '#10B981', '#F97316'];
    const color = colorPalette[padIndex % colorPalette.length];

    const newPad = new SamplerPadInstance(this.audioCtx, this.masterSamplerGain, {
      id: `custom-sample-${padIndex}-${Date.now()}`,
      name: cleanName.slice(0, 14),
      category: 'custom',
      color,
      audioBuffer,
      waveform,
      bpm: detectedBpm
    });

    newPad.isUserUploaded = true;
    newPad.fileName = file.name;
    newPad.tempoSync = true;

    this.pads[padIndex].stop();
    this.pads[padIndex] = newPad;
  }

  public getTelemetry(targetTelem?: DeckTelemetry | null): SamplerTelemetry {
    return {
      masterVolume: this.masterVolume,
      syncTargetBpm: targetTelem ? targetTelem.effectiveBpm : 128.0,
      isMasterSynced: Boolean(targetTelem?.isPlaying),
      quantize: this.globalQuantize,
      tempoSyncAll: this.tempoSyncAll,
      pads: this.pads.map((p) => p.toData())
    };
  }

  public destroy() {
    this.stopAll();
    this.masterSamplerGain.disconnect();
  }
}
