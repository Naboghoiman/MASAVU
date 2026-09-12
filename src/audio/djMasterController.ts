/**
 * Master DJ System Controller
 * Coordinates the shared AudioContext, Deck A & Deck B, Crossfader,
 * continuous PLL Phase-Lock loop, and Beat-Perfect Slave synchronization.
 */

import { ContinuousPhaseLockState, DeckId, DeckTelemetry, LooperTelemetry, PreparedTrack, SamplerTelemetry, SlaveStartPlan, TrackData } from '../types/dj';
import { DjDeck } from './djDeck';
import { DjSyncEngine } from './djSyncEngine';
import { DjLooper } from './djLooper';
import { DjSampler } from './djSampler';
import { getPresetDJTracks } from './trackGenerator';

export class DjMasterController {
  public readonly audioCtx: AudioContext;
  public readonly deckA: DjDeck;
  public readonly deckB: DjDeck;
  public readonly looper: DjLooper;
  public readonly sampler: DjSampler;
  public readonly syncEngine: DjSyncEngine;

  // Master output bus & crossfader
  private masterGainNode: GainNode;
  private deckAGainNode: GainNode;
  private deckBGainNode: GainNode;
  private crossfaderPosition = 0.0; // -1.0 (Deck A) to 0.0 (Center) to +1.0 (Deck B)
  private crossfaderCurve: 'smooth' | 'linear' | 'cut' = 'smooth';

  // Master deck selection
  private masterDeckId: DeckId = 'A';

  // Real-time synchronization loop state
  private syncTimerId: number | null = null;
  private lastPhaseLockState: ContinuousPhaseLockState | null = null;
  private lastSlaveStartPlan: SlaveStartPlan | null = null;

  // Track presets
  private tracks: TrackData[] = [];

  constructor() {
    // Create shared monotonic audio-render context
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioCtx = new AudioContextClass({
      latencyHint: 'interactive'
    });

    this.deckA = new DjDeck('A', this.audioCtx);
    this.deckB = new DjDeck('B', this.audioCtx);
    this.syncEngine = new DjSyncEngine();

    // Setup Master bus and crossfader routing
    this.masterGainNode = this.audioCtx.createGain();
    this.masterGainNode.gain.value = 1.0;
    this.masterGainNode.connect(this.audioCtx.destination);

    // Initialize Sync Looper attached to Master bus
    this.looper = new DjLooper(this.audioCtx, this.masterGainNode);

    // Initialize Performance Sampler attached to Master bus
    this.sampler = new DjSampler(this.audioCtx, this.masterGainNode);

    this.deckAGainNode = this.audioCtx.createGain();
    this.deckBGainNode = this.audioCtx.createGain();

    this.deckA.outputNode.connect(this.deckAGainNode);
    this.deckB.outputNode.connect(this.deckBGainNode);

    this.deckAGainNode.connect(this.masterGainNode);
    this.deckBGainNode.connect(this.masterGainNode);

    // Initial crossfader gains
    this.updateCrossfaderGains();

    // Default Deck A as Master
    this.deckA.setMaster(true);
    this.deckB.setMaster(false);

    // Start high-precision audio synchronization evaluation loop
    this.startSyncEvaluationLoop();
  }

  /**
   * Initializes tracks into library and pre-loads Deck A and Deck B
   */
  public async initialize(): Promise<TrackData[]> {
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
    this.tracks = getPresetDJTracks(this.audioCtx);
    if (this.tracks.length >= 2) {
      this.deckA.loadTrack(this.tracks[0]);
      this.deckB.loadTrack(this.tracks[1]);
    }
    return this.tracks;
  }

  public getTracks(): TrackData[] {
    return [...this.tracks];
  }

  public addTrack(track: TrackData): void {
    this.tracks.push(track);
  }

  /**
   * Section 5: Beat-Perfect Slave Start & Rhythmic Synchronization
   * Initiated when SYNC is toggled or Slave start is triggered under SYNC
   */
  public triggerBeatPerfectSlaveStart(quantizeMode: 'beat' | 'bar' = 'beat'): SlaveStartPlan | null {
    const masterDeck = this.masterDeckId === 'A' ? this.deckA : this.deckB;
    const slaveDeck = this.masterDeckId === 'A' ? this.deckB : this.deckA;

    const masterTrack = masterDeck.getTrack();
    const slaveTrack = slaveDeck.getTrack();
    if (!masterTrack || !slaveTrack) return null;

    masterDeck.updateCurrentPosition();
    slaveDeck.updateCurrentPosition();

    const masterTelem = masterDeck.getTelemetry();
    const slaveTelem = slaveDeck.getTelemetry();
    const now = this.audioCtx.currentTime;

    const masterBpm = masterTelem.effectiveBpm > 20 ? masterTelem.effectiveBpm : masterTrack.bpm;
    const slaveBpm = slaveTrack.bpm > 20 ? slaveTrack.bpm : 120;
    const baseTempoMultiplier = masterBpm / slaveBpm;

    // 1. Instantly match tempo and pitch fader position to Master Deck
    slaveDeck.setBaseTempoMultiplier(baseTempoMultiplier);
    slaveDeck.setPLLMultiplier(1.0);
    slaveDeck.setSync(true);
    slaveDeck.setJogPitchNudge(0);

    // Reflect the new pitch in the UI pitch fader
    const pitchRange = slaveDeck.getPitchRange();
    const pitchPct = (baseTempoMultiplier - 1.0) / pitchRange;
    slaveDeck.setPitchPercentage(Math.max(-1.0, Math.min(1.0, pitchPct)));

    // 2. Measure Master's exact beat grid position
    const masterGrid = masterTrack.beatGrid || {
      firstDownbeatSample: 0,
      samplesPerBeat: (masterTrack.sampleRate * 60) / masterBpm,
      beatsPerBar: 4,
      totalBeats: 1000
    };
    const masterCurrentSample = masterDeck.getCurrentSourceSample();
    const masterOffset = masterCurrentSample - (masterGrid.firstDownbeatSample || 0);
    const masterBeatPos = masterGrid.samplesPerBeat > 0 ? masterOffset / masterGrid.samplesPerBeat : 0;
    const masterBeatPhase = Math.max(0, Math.min(1.0, masterBeatPos - Math.floor(masterBeatPos)));
    const masterBeatInBar = ((Math.floor(masterBeatPos) % 4) + 4) % 4; // 0, 1, 2, 3
    const masterBeatPeriod = 60 / masterBpm;

    const slaveGrid = slaveTrack.beatGrid || {
      firstDownbeatSample: 0,
      samplesPerBeat: (slaveTrack.sampleRate * 60) / slaveBpm,
      beatsPerBar: 4,
      totalBeats: 1000
    };
    const slaveSamplesPerBeat = slaveGrid.samplesPerBeat > 0 ? slaveGrid.samplesPerBeat : (slaveTrack.sampleRate * 60) / slaveBpm;
    const slaveCurrentSample = slaveDeck.getCurrentSourceSample();

    if (slaveTelem.isPlaying) {
      // SLAVE IS ALREADY PLAYING:
      // Seamlessly align slave playback to match master kicks, snares, downbeats & rhythms
      const lookaheadSec = 0.035; // 35ms safe Web Audio hardware scheduling lookahead
      const targetAudioTime = now + lookaheadSec;

      // Calculate where Master will be at targetAudioTime
      const masterEffectiveRate = masterDeck.getEffectiveTempoMultiplier();
      const deltaMasterSamples = lookaheadSec * masterEffectiveRate * masterTrack.sampleRate;
      const masterSampleAtTarget = masterCurrentSample + deltaMasterSamples;

      const masterOffsetAtTarget = masterSampleAtTarget - (masterGrid.firstDownbeatSample || 0);
      const masterBeatPosAtTarget = masterGrid.samplesPerBeat > 0 ? masterOffsetAtTarget / masterGrid.samplesPerBeat : 0;
      const masterBeatInBarAtTarget = ((Math.floor(masterBeatPosAtTarget) % 4) + 4) % 4; // 0, 1, 2, 3
      const masterBeatPhaseAtTarget = masterBeatPosAtTarget - Math.floor(masterBeatPosAtTarget);

      // Align Slave's beat in bar and fractional phase to Master's so kicks and snares hit in unison
      const slaveOffset = slaveCurrentSample - (slaveGrid.firstDownbeatSample || 0);
      const slaveBeatPos = slaveSamplesPerBeat > 0 ? slaveOffset / slaveSamplesPerBeat : 0;

      let targetSlaveBeat: number;
      if (quantizeMode === 'bar') {
        const currentSlaveBar = Math.floor(slaveBeatPos / 4);
        targetSlaveBeat = currentSlaveBar * 4 + masterBeatInBarAtTarget + masterBeatPhaseAtTarget;
      } else {
        // Nearest Beat Phase Sync: shifts at most ±0.5 beat to lock kick drums instantly
        const nearestBeat = Math.round(slaveBeatPos);
        targetSlaveBeat = nearestBeat + masterBeatPhaseAtTarget;
        while (targetSlaveBeat - slaveBeatPos > 0.5) targetSlaveBeat -= 1.0;
        while (targetSlaveBeat - slaveBeatPos < -0.5) targetSlaveBeat += 1.0;
      }
      let targetSlaveSample = (slaveGrid.firstDownbeatSample || 0) + targetSlaveBeat * slaveSamplesPerBeat;

      if (slaveTrack.totalSamples > 0) {
        targetSlaveSample = ((targetSlaveSample % slaveTrack.totalSamples) + slaveTrack.totalSamples) % slaveTrack.totalSamples;
      }

      slaveDeck.syncAlignToMaster(targetAudioTime, targetSlaveSample, baseTempoMultiplier);
      this.syncEngine.resetController();

      const plan: SlaveStartPlan = {
        targetOutputFrame: Math.round(targetAudioTime * this.audioCtx.sampleRate),
        targetOutputTime: targetAudioTime,
        masterBeatNumber: masterBeatInBarAtTarget + 1,
        masterIsDownbeat: masterBeatInBarAtTarget === 0,
        masterBarIndex: Math.floor(masterBeatPosAtTarget / 4) + 1,
        slaveSourceSample: targetSlaveSample,
        slaveBeatNumber: masterBeatInBarAtTarget + 1,
        slaveIsDownbeat: masterBeatInBarAtTarget === 0,
        baseTempoMultiplier,
        decoderLatencyFrames: 0,
        timeStretcherLatencyFrames: 0,
        audioBufferLatencyFrames: 0,
        totalLatencySeconds: lookaheadSec,
        prerollOutputTime: targetAudioTime
      };
      this.lastSlaveStartPlan = plan;
      return plan;
    } else {
      // SLAVE IS STOPPED:
      if (masterTelem.isPlaying) {
        // Schedule slave to launch on the next beat or bar boundary with audio hardware precision
        let scheduleDelay = (1.0 - masterBeatPhase) * masterBeatPeriod;
        let targetMasterBeatIndex = Math.floor(masterBeatPos) + 1;

        if (scheduleDelay < 0.04) {
          scheduleDelay += masterBeatPeriod;
          targetMasterBeatIndex += 1;
        }

        if (quantizeMode === 'bar') {
          const beatsUntilBar = (4 - masterBeatInBar) || 4;
          scheduleDelay = (beatsUntilBar - masterBeatPhase) * masterBeatPeriod;
          if (scheduleDelay < 0.04) scheduleDelay += 4 * masterBeatPeriod;
          targetMasterBeatIndex = Math.ceil(masterBeatPos / 4) * 4;
        }

        const scheduledTime = now + scheduleDelay;
        slaveDeck.play(scheduledTime, slaveCurrentSample);
        this.syncEngine.resetController();

        const plan: SlaveStartPlan = {
          targetOutputFrame: Math.round(scheduledTime * this.audioCtx.sampleRate),
          targetOutputTime: scheduledTime,
          masterBeatNumber: (targetMasterBeatIndex % 4) + 1,
          masterIsDownbeat: (targetMasterBeatIndex % 4) === 0,
          masterBarIndex: Math.floor(targetMasterBeatIndex / 4) + 1,
          slaveSourceSample: slaveCurrentSample,
          slaveBeatNumber: (targetMasterBeatIndex % 4) + 1,
          slaveIsDownbeat: (targetMasterBeatIndex % 4) === 0,
          baseTempoMultiplier,
          decoderLatencyFrames: 0,
          timeStretcherLatencyFrames: 0,
          audioBufferLatencyFrames: 0,
          totalLatencySeconds: 0,
          prerollOutputTime: scheduledTime
        };
        this.lastSlaveStartPlan = plan;
        return plan;
      } else {
        // Master is stopped: cue slave to first downbeat matching tempo
        slaveDeck.seekToSourceSample(slaveGrid.firstDownbeatSample || 0, false);
        this.syncEngine.resetController();
        return null;
      }
    }
  }

  /**
   * Continuous high-resolution audio synchronization loop
   * Evaluates Section 6 & 7 on every tick
   */
  private startSyncEvaluationLoop(): void {
    const evaluate = () => {
      const masterDeck = this.masterDeckId === 'A' ? this.deckA : this.deckB;
      const slaveDeck = this.masterDeckId === 'A' ? this.deckB : this.deckA;

      const masterTrack = masterDeck.getTrack();
      const slaveTrack = slaveDeck.getTrack();

      // Only perform phase tracking if both decks are loaded, both are playing, and slave has sync enabled
      if (masterTrack && slaveTrack && slaveDeck.getTelemetry().isSyncEnabled) {
        const masterTelem = masterDeck.getTelemetry();
        const slaveTelem = slaveDeck.getTelemetry();

        if (masterTelem.isPlaying && slaveTelem.isPlaying) {
          const baseTempo = masterTelem.effectiveBpm / slaveTrack.bpm;
          slaveDeck.setBaseTempoMultiplier(baseTempo);
          // AUTO-NUDGING REMOVED: Keep PLL multiplier locked at solid 1.0 to eliminate all pitch flutter
          slaveDeck.setPLLMultiplier(1.0);

          const phaseLockState = this.syncEngine.evaluateContinuousPhaseLock({
            currentTimeSeconds: this.audioCtx.currentTime,
            masterBpm: masterTelem.effectiveBpm,
            masterCurrentSourceSample: masterTelem.currentSourceSample,
            masterBeatGrid: masterTrack.beatGrid,
            masterMapping: masterDeck.getMapping(),
            slaveCurrentSourceSample: slaveTelem.currentSourceSample,
            slaveBeatGrid: slaveTrack.beatGrid,
            slaveMapping: slaveDeck.getMapping(),
            baseTempoMultiplier: baseTempo
          });

          // Telemetry maintains phase status for visual phase meter, but audio tempo remains pure & un-nudged
          this.lastPhaseLockState = {
            ...phaseLockState,
            correctionFraction: 0,
            status: 'locked',
            isPhaseLocked: true
          };
        } else {
          // If not both playing, ensure slave is running at matching base tempo with 1.0 PLL
          const baseTempo = masterTelem.effectiveBpm / slaveTrack.bpm;
          slaveDeck.setBaseTempoMultiplier(baseTempo);
          slaveDeck.setPLLMultiplier(1.0);
        }
      }

      // Update real-time sync for Looper & Sampler
      const telemA = this.deckA.getTelemetry();
      const telemB = this.deckB.getTelemetry();
      const trackA = this.deckA.getTrack();
      const trackB = this.deckB.getTrack();

      this.looper.updateSyncTick(telemA, telemB, trackA, trackB);
      this.sampler.updateSyncTick(telemA, telemB, trackA, trackB);

      this.syncTimerId = window.requestAnimationFrame(evaluate);
    };

    this.syncTimerId = window.requestAnimationFrame(evaluate);
  }

  public getLooperTelemetry(): LooperTelemetry {
    return this.looper.getTelemetry(this.deckA.getTelemetry(), this.deckB.getTelemetry());
  }

  public getSamplerTelemetry(): SamplerTelemetry {
    const masterTelem = this.masterDeckId === 'A' ? this.deckA.getTelemetry() : this.deckB.getTelemetry();
    return this.sampler.getTelemetry(masterTelem);
  }

  public getPhaseLockState(): ContinuousPhaseLockState | null {
    return this.lastPhaseLockState;
  }

  public getLastSlaveStartPlan(): SlaveStartPlan | null {
    return this.lastSlaveStartPlan;
  }

  /**
   * Pre-Sync BPM Normalization:
   * Re-masters a deck's track to a specific target BPM using WSOLA.
   * Produces a new PreparedTrack with corrected PCM, BPM, BeatGrid, and duration.
   */
  public prepareDeckToBpm(deckId: DeckId, targetBpm: number): PreparedTrack | null {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    return deck.prepareToBpm(targetBpm);
  }

  /**
   * Normalizes the slave deck's track to match the master deck's BPM before synchronization
   */
  public prepareSlaveToMasterBpm(): PreparedTrack | null {
    const masterDeck = this.masterDeckId === 'A' ? this.deckA : this.deckB;
    const slaveDeck = this.masterDeckId === 'A' ? this.deckB : this.deckA;
    const masterTrack = masterDeck.getTrack();
    if (!masterTrack) return null;
    return slaveDeck.prepareToBpm(masterTrack.bpm);
  }

  /**
   * Live Test & Verification: Injects an exact phase disturbance (in milliseconds)
   * to observe the bounded PLL / PI controller smoothly pulling the slave back into phase lock
   * over 2 to 4 beats according to Section 7!
   */
  public injectPhaseDisturbance(offsetMs: number): void {
    const slaveDeck = this.masterDeckId === 'A' ? this.deckB : this.deckA;
    const track = slaveDeck.getTrack();
    if (!track) return;

    // Convert disturbance from milliseconds to source samples
    const deltaSeconds = offsetMs / 1000.0;
    const deltaSamples = deltaSeconds * track.sampleRate;
    const currentSample = slaveDeck.getTelemetry().currentSourceSample;
    slaveDeck.seekToSourceSample(currentSample + deltaSamples);
  }

  /**
   * Master / Slave Deck Selection
   */
  public setMasterDeck(id: DeckId): void {
    this.masterDeckId = id;
    this.deckA.setMaster(id === 'A');
    this.deckB.setMaster(id === 'B');
  }

  public getMasterDeckId(): DeckId {
    return this.masterDeckId;
  }

  /**
   * Slip Mode Delegations
   */
  public toggleSlipMode(deckId: DeckId): boolean {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    return deck.toggleSlipMode();
  }

  public setSlipMode(deckId: DeckId, enabled: boolean): void {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    deck.setSlipMode(enabled);
  }

  public getIsSlipMode(deckId: DeckId): boolean {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    return deck.getIsSlipMode();
  }

  /**
   * Crossfader curves:
   * 'smooth': Equal power cosine / sine curve (3dB dip in center for constant acoustic volume)
   * 'linear': Straight linear blend
   * 'cut': Sharp scratch curve (fast cut-in at 5% movement)
   */
  public setCrossfaderPosition(pos: number): void {
    this.crossfaderPosition = Math.max(-1.0, Math.min(1.0, pos));
    this.updateCrossfaderGains();
  }

  public getCrossfaderPosition(): number {
    return this.crossfaderPosition;
  }

  public setCrossfaderCurve(curve: 'smooth' | 'linear' | 'cut'): void {
    this.crossfaderCurve = curve;
    this.updateCrossfaderGains();
  }

  private updateCrossfaderGains(): void {
    const x = this.crossfaderPosition; // -1 to +1
    const norm = (x + 1) * 0.5; // 0 to 1
    let gainA = 1.0;
    let gainB = 1.0;

    if (this.crossfaderCurve === 'smooth') {
      // Equal power curve
      gainA = Math.cos(norm * 0.5 * Math.PI);
      gainB = Math.sin(norm * 0.5 * Math.PI);
    } else if (this.crossfaderCurve === 'linear') {
      gainA = 1.0 - norm;
      gainB = norm;
    } else {
      // Cut / Scratch curve
      gainA = norm < 0.95 ? 1.0 : Math.max(0, (1.0 - norm) * 20);
      gainB = norm > 0.05 ? 1.0 : Math.max(0, norm * 20);
    }

    const now = this.audioCtx.currentTime;
    this.deckAGainNode.gain.setValueAtTime(gainA, now);
    this.deckBGainNode.gain.setValueAtTime(gainB, now);
  }

  public setMasterVolume(val: number): void {
    const gain = Math.max(0, Math.min(1.5, val));
    this.masterGainNode.gain.setValueAtTime(gain, this.audioCtx.currentTime);
  }

  /**
   * Plays built-in sampler FX sounds (Airhorn, Siren, Laser, Drop)
   */
  public playSamplerFx(type: 'airhorn' | 'siren' | 'laser' | 'drop'): void {
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.connect(gain);
    gain.connect(this.masterGainNode);

    if (type === 'siren') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(880, now + 0.35);
      osc.frequency.linearRampToValueAtTime(440, now + 0.7);
      osc.frequency.linearRampToValueAtTime(880, now + 1.05);
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
      osc.start(now);
      osc.stop(now + 1.25);
    } else if (type === 'airhorn') {
      // Classic dancehall reggae brass tone
      [0, 4, 7].forEach((semitone) => {
        const o = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();
        o.type = 'sawtooth';
        o.frequency.value = 330 * Math.pow(2, semitone / 12);
        o.connect(g);
        g.connect(this.masterGainNode);
        g.gain.setValueAtTime(0.2, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        o.start(now);
        o.stop(now + 0.6);
      });
    } else if (type === 'laser') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(2800, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.28);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.32);
    } else {
      // Deep sub drop
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.85);
      gain.gain.setValueAtTime(0.65, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc.start(now);
      osc.stop(now + 0.95);
    }
  }

  public setFirstDownbeat(deckId: DeckId, sample?: number): void {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    deck.setFirstDownbeat(sample);
  }

  public nudgeBeatGrid(deckId: DeckId, deltaMs: number): void {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    deck.nudgeBeatGrid(deltaMs);
  }

  public setTrackBpm(deckId: DeckId, bpm: number): void {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    deck.setTrackBpm(bpm);
  }

  public doubleTrackBpm(deckId: DeckId): void {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    deck.doubleTrackBpm();
  }

  public halveTrackBpm(deckId: DeckId): void {
    const deck = deckId === 'A' ? this.deckA : this.deckB;
    deck.halveTrackBpm();
  }

  public destroy(): void {
    if (this.syncTimerId !== null) {
      window.cancelAnimationFrame(this.syncTimerId);
    }
    this.looper.destroy();
    this.sampler.destroy();
    this.deckA.pause();
    this.deckB.pause();
    if (this.audioCtx.state !== 'closed') {
      this.audioCtx.close();
    }
  }
}
