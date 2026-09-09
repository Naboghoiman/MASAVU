/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { DjMasterController } from './audio/djMasterController';
import { WaveformDisplay } from './components/WaveformDisplay';
import { JogWheel } from './components/JogWheel';
import { MixerSection } from './components/MixerSection';
import { DeckControls } from './components/DeckControls';
import { LooperSection } from './components/LooperSection';
import { SyncTelemetryPanel } from './components/SyncTelemetryPanel';
import { TrackLibraryModal } from './components/TrackLibraryModal';
import { SpecsModal } from './components/SpecsModal';
import { ContinuousPhaseLockState, DeckId, DeckTelemetry, LooperTelemetry, SlaveStartPlan, TrackData } from './types/dj';
import { Disc3, BookOpen, Volume2, Sparkles, Activity, ShieldCheck, Layers } from 'lucide-react';

export default function App() {
  const controllerRef = useRef<DjMasterController | null>(null);

  // Tracks & active deck tracks
  const [tracks, setTracks] = useState<TrackData[]>([]);
  const [trackA, setTrackA] = useState<TrackData | null>(null);
  const [trackB, setTrackB] = useState<TrackData | null>(null);

  // Telemetry states
  const [telemetryA, setTelemetryA] = useState<DeckTelemetry | null>(null);
  const [telemetryB, setTelemetryB] = useState<DeckTelemetry | null>(null);
  const [phaseLockState, setPhaseLockState] = useState<ContinuousPhaseLockState | null>(null);
  const [slaveStartPlan, setSlaveStartPlan] = useState<SlaveStartPlan | null>(null);
  const [looperTelemetry, setLooperTelemetry] = useState<LooperTelemetry | null>(null);

  // Mixer states
  const [crossfaderPos, setCrossfaderPos] = useState(0);
  const [crossfaderCurve, setCrossfaderCurve] = useState<'smooth' | 'linear' | 'cut'>('smooth');

  // Modals
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryTargetDeck, setLibraryTargetDeck] = useState<DeckId>('A');
  const [isSpecsModalOpen, setIsSpecsModalOpen] = useState(false);

  // Audio Context startup state
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);

  // Initialize Audio System once
  useEffect(() => {
    const controller = new DjMasterController();
    controllerRef.current = controller;

    controller.initialize().then((loadedTracks) => {
      setTracks(loadedTracks);
      setTrackA(controller.deckA.getTrack());
      setTrackB(controller.deckB.getTrack());
      setIsAudioInitialized(true);
    });

    // Auto-resume audio context on first user interaction anywhere
    const unlockAudio = () => {
      if (controller.audioCtx.state === 'suspended') {
        controller.audioCtx.resume();
      }
    };
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });

    // High frequency telemetry ticker (60 FPS) to update UI states
    let animId: number;
    const updateTick = () => {
      if (controllerRef.current) {
        const c = controllerRef.current;
        setTelemetryA(c.deckA.getTelemetry());
        setTelemetryB(c.deckB.getTelemetry());
        setPhaseLockState(c.getPhaseLockState());
        setSlaveStartPlan(c.getLastSlaveStartPlan());
        setLooperTelemetry(c.getLooperTelemetry());
      }
      animId = requestAnimationFrame(updateTick);
    };
    animId = requestAnimationFrame(updateTick);

    return () => {
      cancelAnimationFrame(animId);
      controller.destroy();
    };
  }, []);

  // Keyboard DJ Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const c = controllerRef.current;
      if (!c) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          // Toggle play on Deck A
          if (c.deckA.getTelemetry().isPlaying) c.deckA.pause();
          else c.deckA.play();
          break;
        case 'KeyC':
          c.deckA.handleCuePress();
          break;
        case 'KeyS':
          // Toggle sync on slave deck
          handleSyncToggle('B');
          break;
        case 'Enter':
          // Toggle play on Deck B
          if (c.deckB.getTelemetry().isPlaying) c.deckB.pause();
          else c.deckB.play();
          break;
        case 'Digit1':
          c.deckA.triggerHotCue(1);
          break;
        case 'Digit2':
          c.deckA.triggerHotCue(2);
          break;
        case 'Digit3':
          c.deckA.triggerHotCue(3);
          break;
        case 'Digit4':
          c.deckA.triggerHotCue(4);
          break;
        case 'KeyL':
          // Toggle Slot 1 (Uploaded Groove Break Loop) with beat sync
          c.looper.togglePlaySlot(
            'loop-groove-break-128',
            c.deckA.getTelemetry(),
            c.deckB.getTelemetry(),
            c.deckA.getTrack(),
            c.deckB.getTrack()
          );
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyC') {
        controllerRef.current?.deckA.handleCueRelease();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleOpenLibrary = (deckId: DeckId) => {
    setLibraryTargetDeck(deckId);
    setIsLibraryOpen(true);
  };

  const handleLoadTrack = (deckId: DeckId, track: TrackData) => {
    const c = controllerRef.current;
    if (!c) return;
    if (deckId === 'A') {
      c.deckA.loadTrack(track);
      setTrackA(track);
    } else {
      c.deckB.loadTrack(track);
      setTrackB(track);
    }
  };

  const handleAddTrack = (track: TrackData) => {
    controllerRef.current?.addTrack(track);
    setTracks((prev) => [...prev, track]);
  };

  const handleSyncToggle = (deckId: DeckId) => {
    const c = controllerRef.current;
    if (!c) return;

    const masterId = c.getMasterDeckId();
    if (deckId === masterId) {
      // If clicking sync on master, assign master to the other deck
      const otherDeck: DeckId = deckId === 'A' ? 'B' : 'A';
      c.setMasterDeck(otherDeck);
      c.triggerBeatPerfectSlaveStart('beat');
    } else {
      const slaveDeck = deckId === 'A' ? c.deckA : c.deckB;
      if (slaveDeck.getTelemetry().isSyncEnabled) {
        // Toggle sync off
        slaveDeck.setSync(false);
        slaveDeck.setPLLMultiplier(1.0);
      } else {
        // Trigger Section 5 Beat-Perfect Slave Start
        c.triggerBeatPerfectSlaveStart('beat');
      }
    }
  };

  const handleMasterToggle = (deckId: DeckId) => {
    controllerRef.current?.setMasterDeck(deckId);
  };

  const handleQuickDemoSync = async () => {
    const c = controllerRef.current;
    if (!c) return;
    if (c.audioCtx.state === 'suspended') {
      await c.audioCtx.resume();
    }
    // Set crossfader to center
    c.setCrossfaderPosition(0);
    setCrossfaderPos(0);
    // Assign Deck A as Master
    c.setMasterDeck('A');

    const trackA = c.deckA.getTrack();
    const trackB = c.deckB.getTrack();
    if (!trackA || !trackB) return;

    if (c.deckA.getTelemetry().isPlaying) {
      // If Deck A is already running, lock Deck B into beat-sync with Deck A
      c.triggerBeatPerfectSlaveStart('beat');
    } else {
      // If both decks are stopped, align both to downbeat 0 and start in 100% sample-lock
      c.deckA.seekToSourceSample(0, false);
      c.deckB.seekToSourceSample(0, false);

      const baseTempo = trackA.bpm / trackB.bpm;
      c.deckB.setBaseTempoMultiplier(baseTempo);
      c.deckB.setPLLMultiplier(1.0);
      c.deckB.setSync(true);
      c.deckA.setSync(false);

      const startTime = c.audioCtx.currentTime + 0.08;
      c.deckA.play(startTime, 0);
      c.deckB.play(startTime, 0);
    }
  };

  // Fallback default telemetry while loading
  const defaultTelemetryA: DeckTelemetry = {
    deckId: 'A',
    trackId: null,
    trackTitle: 'LOADING...',
    bpm: 124,
    effectiveBpm: 124,
    pitchPercentage: 0,
    keyLock: true,
    isPlaying: false,
    isMaster: true,
    isSyncEnabled: false,
    currentSourceSample: 0,
    currentOutputFrame: 0,
    currentTimeSeconds: 0,
    currentBeatIndex: 0,
    beatInBar: 1,
    barIndex: 1,
    beatPhase: 0,
    vuLevel: [0, 0]
  };

  const defaultTelemetryB: DeckTelemetry = {
    deckId: 'B',
    trackId: null,
    trackTitle: 'LOADING...',
    bpm: 128,
    effectiveBpm: 128,
    pitchPercentage: 0,
    keyLock: true,
    isPlaying: false,
    isMaster: false,
    isSyncEnabled: false,
    currentSourceSample: 0,
    currentOutputFrame: 0,
    currentTimeSeconds: 0,
    currentBeatIndex: 0,
    beatInBar: 1,
    barIndex: 1,
    beatPhase: 0,
    vuLevel: [0, 0]
  };

  const telemA = telemetryA || defaultTelemetryA;
  const telemB = telemetryB || defaultTelemetryB;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-amber-500 selection:text-slate-950 font-sans">
      {/* Top Professional DJ Header */}
      <header className="bg-slate-900/90 border-b border-slate-800/80 px-4 py-3 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
            <Disc3 className="w-5 h-5 text-white animate-spin" style={{ animationDuration: '8s' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-tight text-white font-mono">
                djay Pro <span className="text-amber-400 font-extrabold">SYNC ENGINE</span>
              </h1>
              <span className="bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                V2.2 COMPLIANT
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Monotonic Audio-Render Clock • Exact Source-Sample BeatGrid • Continuous Bounded PLL Phase Lock
            </p>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-2.5">
          <button
            id="quick-demo-sync-btn"
            onClick={handleQuickDemoSync}
            className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 font-mono font-black rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AUTO-SYNC DEMO</span>
          </button>

          <button
            id="toggle-groove-looper-btn"
            onClick={() => {
              const c = controllerRef.current;
              if (c) {
                c.looper.togglePlaySlot(
                  'loop-groove-break-128',
                  c.deckA.getTelemetry(),
                  c.deckB.getTelemetry(),
                  c.deckA.getTrack(),
                  c.deckB.getTrack()
                );
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-black flex items-center gap-1.5 transition-all shadow-sm active:scale-95 ${
              looperTelemetry?.slots[0]?.isPlaying
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40'
            }`}
            title="Toggle Uploaded Groove Break (Slot 1) in perfect sync"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{looperTelemetry?.slots[0]?.isPlaying ? 'GROOVE RUNNING' : 'SYNC LOOPER'}</span>
          </button>

          <button
            id="open-specs-modal-btn"
            onClick={() => setIsSpecsModalOpen(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span>VIEW V2.2 SPEC</span>
          </button>

          <div className="hidden lg:flex items-center gap-2 text-xs font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>CLOCK: {controllerRef.current ? `${(controllerRef.current.audioCtx.sampleRate / 1000).toFixed(1)}kHz` : '44.1kHz'}</span>
          </div>
        </div>
      </header>

      {/* Main DJ Console Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 space-y-4">
        {/* Section 8: Dual 3-Band Stacked Waveform with Common Visual Reference Line */}
        <section aria-label="Dual Waveform Stage">
          <WaveformDisplay
            trackA={trackA}
            trackB={trackB}
            telemetryA={telemA}
            telemetryB={telemB}
            phaseLockState={phaseLockState}
            onSeekDeckA={(s) => controllerRef.current?.deckA.seekToSourceSample(s)}
            onSeekDeckB={(s) => controllerRef.current?.deckB.seekToSourceSample(s)}
          />
        </section>

        {/* Main Deck Decks & Central Mixer Stage */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start" aria-label="Deck & Mixer Console">
          {/* DECK A (Left Side) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <DeckControls
              telemetry={telemA}
              track={trackA}
              hotCues={controllerRef.current ? controllerRef.current.deckA.getHotCues() : []}
              loop={controllerRef.current ? controllerRef.current.deckA.getLoop() : { isActive: false, startSourceSample: 0, endSourceSample: 0, lengthBeats: 4 }}
              accent="blue"
              onPlay={() => controllerRef.current?.deckA.play()}
              onPause={() => controllerRef.current?.deckA.pause()}
              onCueDown={() => controllerRef.current?.deckA.handleCuePress()}
              onCueUp={() => controllerRef.current?.deckA.handleCueRelease()}
              onSyncToggle={() => handleSyncToggle('A')}
              onMasterToggle={() => handleMasterToggle('A')}
              onPitchChange={(v) => controllerRef.current?.deckA.setPitchPercentage(v)}
              onKeyLockToggle={() => controllerRef.current?.deckA.toggleKeyLock()}
              onTriggerHotCue={(id) => controllerRef.current?.deckA.triggerHotCue(id)}
              onClearHotCue={(id) => controllerRef.current?.deckA.clearHotCue(id)}
              onSetLoop={(beats) => controllerRef.current?.deckA.setLoop(beats)}
              onToggleLoop={() => controllerRef.current?.deckA.toggleLoop()}
              onBeatJump={(beats) => controllerRef.current?.deckA.beatJump(beats)}
              onOpenLibrary={() => handleOpenLibrary('A')}
            />

            {/* Deck A Jog Wheel Platter */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center shadow-lg">
              <JogWheel
                telemetry={telemA}
                accentColor="blue"
                onTouchDown={() => controllerRef.current?.deckA.onJogTouchDown()}
                onTouchUp={() => controllerRef.current?.deckA.onJogTouchUp()}
                onScratchMove={(da) => controllerRef.current?.deckA.onJogScratchMove(da)}
                onNudge={(dir) => controllerRef.current?.deckA.onJogNudge(dir)}
              />
            </div>
          </div>

          {/* CENTER PRO MIXER (Middle) */}
          <div className="lg:col-span-4">
            <MixerSection
              telemetryA={telemA}
              telemetryB={telemB}
              crossfaderPos={crossfaderPos}
              onCrossfaderChange={(pos) => {
                setCrossfaderPos(pos);
                controllerRef.current?.setCrossfaderPosition(pos);
              }}
              crossfaderCurve={crossfaderCurve}
              onCrossfaderCurveChange={(curve) => {
                setCrossfaderCurve(curve);
                controllerRef.current?.setCrossfaderCurve(curve);
              }}
              onSetLowEqA={(v) => controllerRef.current?.deckA.setLowEq(v)}
              onSetMidEqA={(v) => controllerRef.current?.deckA.setMidEq(v)}
              onSetHighEqA={(v) => controllerRef.current?.deckA.setHighEq(v)}
              onSetFilterA={(v) => controllerRef.current?.deckA.setFilter(v)}
              onSetVolumeA={(v) => controllerRef.current?.deckA.setVolume(v)}
              onSetLowEqB={(v) => controllerRef.current?.deckB.setLowEq(v)}
              onSetMidEqB={(v) => controllerRef.current?.deckB.setMidEq(v)}
              onSetHighEqB={(v) => controllerRef.current?.deckB.setHighEq(v)}
              onSetFilterB={(v) => controllerRef.current?.deckB.setFilter(v)}
              onSetVolumeB={(v) => controllerRef.current?.deckB.setVolume(v)}
              onMasterVolumeChange={(v) => controllerRef.current?.setMasterVolume(v)}
              onPlaySampler={(fx) => controllerRef.current?.playSamplerFx(fx)}
            />
          </div>

          {/* DECK B (Right Side) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <DeckControls
              telemetry={telemB}
              track={trackB}
              hotCues={controllerRef.current ? controllerRef.current.deckB.getHotCues() : []}
              loop={controllerRef.current ? controllerRef.current.deckB.getLoop() : { isActive: false, startSourceSample: 0, endSourceSample: 0, lengthBeats: 4 }}
              accent="emerald"
              onPlay={() => controllerRef.current?.deckB.play()}
              onPause={() => controllerRef.current?.deckB.pause()}
              onCueDown={() => controllerRef.current?.deckB.handleCuePress()}
              onCueUp={() => controllerRef.current?.deckB.handleCueRelease()}
              onSyncToggle={() => handleSyncToggle('B')}
              onMasterToggle={() => handleMasterToggle('B')}
              onPitchChange={(v) => controllerRef.current?.deckB.setPitchPercentage(v)}
              onKeyLockToggle={() => controllerRef.current?.deckB.toggleKeyLock()}
              onTriggerHotCue={(id) => controllerRef.current?.deckB.triggerHotCue(id)}
              onClearHotCue={(id) => controllerRef.current?.deckB.clearHotCue(id)}
              onSetLoop={(beats) => controllerRef.current?.deckB.setLoop(beats)}
              onToggleLoop={() => controllerRef.current?.deckB.toggleLoop()}
              onBeatJump={(beats) => controllerRef.current?.deckB.beatJump(beats)}
              onOpenLibrary={() => handleOpenLibrary('B')}
            />

            {/* Deck B Jog Wheel Platter */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col items-center justify-center shadow-lg">
              <JogWheel
                telemetry={telemB}
                accentColor="emerald"
                onTouchDown={() => controllerRef.current?.deckB.onJogTouchDown()}
                onTouchUp={() => controllerRef.current?.deckB.onJogTouchUp()}
                onScratchMove={(da) => controllerRef.current?.deckB.onJogScratchMove(da)}
                onNudge={(dir) => controllerRef.current?.deckB.onJogNudge(dir)}
              />
            </div>
          </div>
        </section>

        {/* Section 9: Dedicated Pro Hardware Sync Looper (With Uploaded Groove & Slicing) */}
        <section aria-label="Hardware Sync Looper">
          <LooperSection
            telemetry={looperTelemetry}
            telemetryA={telemA}
            telemetryB={telemB}
            trackA={trackA}
            trackB={trackB}
            onTogglePlaySlot={(slotId) => {
              const c = controllerRef.current;
              if (c) {
                c.looper.togglePlaySlot(
                  slotId,
                  c.deckA.getTelemetry(),
                  c.deckB.getTelemetry(),
                  c.deckA.getTrack(),
                  c.deckB.getTrack()
                );
              }
            }}
            onSetLoopBeats={(slotId, beats) => controllerRef.current?.looper.setSlotLoopBeats(slotId, beats)}
            onHalveLoop={(slotId) => controllerRef.current?.looper.halveSlotLoop(slotId)}
            onDoubleLoop={(slotId) => controllerRef.current?.looper.doubleSlotLoop(slotId)}
            onTriggerRoll={(slotId, beats) => controllerRef.current?.looper.triggerSlotRoll(slotId, beats)}
            onReleaseRoll={(slotId) => controllerRef.current?.looper.releaseSlotRoll(slotId)}
            onSetSlotVolume={(slotId, val) => controllerRef.current?.looper.setSlotVolume(slotId, val)}
            onSetSlotFilter={(slotId, val) => controllerRef.current?.looper.setSlotFilter(slotId, val)}
            onToggleSlotMute={(slotId) => controllerRef.current?.looper.toggleSlotMute(slotId)}
            onToggleSlotSolo={(slotId) => controllerRef.current?.looper.toggleSlotSolo(slotId)}
            onSetSyncTarget={(target) => controllerRef.current?.looper.setSyncTarget(target)}
            onSetQuantize={(q) => controllerRef.current?.looper.setQuantize(q)}
            onSetMasterVolume={(v) => controllerRef.current?.looper.setMasterVolume(v)}
            onStopAll={() => controllerRef.current?.looper.stopAll()}
            onPlayAll={() => {
              const c = controllerRef.current;
              if (c) {
                c.looper.playAll(
                  c.deckA.getTelemetry(),
                  c.deckB.getTelemetry(),
                  c.deckA.getTrack(),
                  c.deckB.getTrack()
                );
              }
            }}
            onUploadCustomLoop={(slotIndex, file) => {
              controllerRef.current?.looper.loadCustomAudioIntoSlot(slotIndex, file);
            }}
            onCaptureFromDeck={(slotIndex, deckId) => {
              const c = controllerRef.current;
              if (!c) return;
              if (deckId === 'A' && trackA) {
                c.looper.captureFromDeck(slotIndex, c.deckA.getTelemetry(), trackA);
              } else if (deckId === 'B' && trackB) {
                c.looper.captureFromDeck(slotIndex, c.deckB.getTelemetry(), trackB);
              }
            }}
          />
        </section>

        {/* Section 6 & 7 Live Verification & Telemetry Suite */}
        <section aria-label="Technical Verification Suite">
          <SyncTelemetryPanel
            telemetryA={telemA}
            telemetryB={telemB}
            phaseLockState={phaseLockState}
            slaveStartPlan={slaveStartPlan}
            pllConfig={controllerRef.current ? controllerRef.current.syncEngine.getConfig() : { kp: 0.65, ki: 0.12, deadbandSeconds: 0.0015, correctionWindowBeats: 3.0, maxCorrectionFraction: 0.08, severeErrorThresholdSeconds: 0.14 }}
            onUpdatePllConfig={(cfg) => controllerRef.current?.syncEngine.updateConfig(cfg)}
            onInjectDisturbance={(ms) => controllerRef.current?.injectPhaseDisturbance(ms)}
            onRetriggerSlaveSync={(mode) => controllerRef.current?.triggerBeatPerfectSlaveStart(mode)}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/60 p-3 text-center text-xs text-slate-500 font-mono">
        djay Pro Synchronization Engine v2.2 • Latency-Compensated Monotonic Output Clock • Space: Play/Pause Deck A • Enter: Play/Pause Deck B • C: Cue • S: Sync
      </footer>

      {/* Modals */}
      {controllerRef.current && (
        <TrackLibraryModal
          isOpen={isLibraryOpen}
          onClose={() => setIsLibraryOpen(false)}
          tracks={tracks}
          targetDeck={libraryTargetDeck}
          onLoadTrack={handleLoadTrack}
          onAddTrack={handleAddTrack}
          audioCtx={controllerRef.current.audioCtx}
        />
      )}

      <SpecsModal isOpen={isSpecsModalOpen} onClose={() => setIsSpecsModalOpen(false)} />
    </div>
  );
}
