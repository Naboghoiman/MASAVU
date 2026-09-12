/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { DjMasterController } from './audio/djMasterController';
import { DjTopNav } from './components/DjTopNav';
import { WaveformDisplay } from './components/WaveformDisplay';
import { DjHardwareController } from './components/DjHardwareController';
import { TrackLibraryModal } from './components/TrackLibraryModal';
import { SpecsModal } from './components/SpecsModal';
import { SyncTelemetryPanel } from './components/SyncTelemetryPanel';
import { LooperBoard } from './components/LooperBoard';
import {
  ContinuousPhaseLockState,
  DeckId,
  DeckTelemetry,
  LooperQuantize,
  LooperSyncTarget,
  LooperTelemetry,
  SamplerPlayMode,
  SamplerQuantize,
  SamplerTelemetry,
  SlaveStartPlan,
  TrackData
} from './types/dj';
import { Activity, Sparkles, BookOpen } from 'lucide-react';

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
  const [samplerTelemetry, setSamplerTelemetry] = useState<SamplerTelemetry | null>(null);

  // Looper & Sampler Board states
  const [isLooperBoardOpen, setIsLooperBoardOpen] = useState(true);
  const [activeBoardMode, setActiveBoardMode] = useState<'looper' | 'sampler'>('looper');

  // Mixer states
  const [crossfaderPos, setCrossfaderPos] = useState(0);
  const [masterVolume, setMasterVolume] = useState(0.9);

  // Deck A EQ & Levels
  const [lowEqA, setLowEqA] = useState(0);
  const [midEqA, setMidEqA] = useState(0);
  const [highEqA, setHighEqA] = useState(0);
  const [filterA, setFilterA] = useState(0);
  const [volumeA, setVolumeA] = useState(0.85);

  // Deck B EQ & Levels
  const [lowEqB, setLowEqB] = useState(0);
  const [midEqB, setMidEqB] = useState(0);
  const [highEqB, setHighEqB] = useState(0);
  const [filterB, setFilterB] = useState(0);
  const [volumeB, setVolumeB] = useState(0.85);

  // Navigation & Modals
  const [activeNavTab, setActiveNavTab] = useState<'songlist' | 'browse' | 'library' | 'performance' | 'settings'>('songlist');
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryTargetDeck, setLibraryTargetDeck] = useState<DeckId>('A');
  const [isSpecsModalOpen, setIsSpecsModalOpen] = useState(false);
  const [showTelemetryDrawer, setShowTelemetryDrawer] = useState(false);

  // Initialize Audio System
  useEffect(() => {
    const controller = new DjMasterController();
    controllerRef.current = controller;

    controller.initialize().then((loadedTracks) => {
      setTracks(loadedTracks);
      setTrackA(controller.deckA.getTrack());
      setTrackB(controller.deckB.getTrack());
    });

    // Auto-resume audio context on user interaction
    const unlockAudio = () => {
      if (controller.audioCtx.state === 'suspended') {
        controller.audioCtx.resume();
      }
    };
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });

    // High frequency telemetry ticker (60 FPS)
    let animId: number;
    const updateTick = () => {
      if (controllerRef.current) {
        const c = controllerRef.current;
        setTelemetryA(c.deckA.getTelemetry());
        setTelemetryB(c.deckB.getTelemetry());
        setPhaseLockState(c.getPhaseLockState());
        setSlaveStartPlan(c.getLastSlaveStartPlan());
        setLooperTelemetry(c.getLooperTelemetry());
        setSamplerTelemetry(c.getSamplerTelemetry());
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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const c = controllerRef.current;
      if (!c) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (c.deckA.getTelemetry().isPlaying) {
            c.deckA.pause();
          } else {
            if (c.deckA.getTelemetry().isSyncEnabled && c.deckB.getTelemetry().isPlaying) {
              c.triggerBeatPerfectSlaveStart('beat');
            } else {
              c.deckA.play();
            }
          }
          break;
        case 'KeyC':
          c.deckA.handleCuePress();
          break;
        case 'KeyS':
          handleSyncToggle('B');
          break;
        case 'Enter':
          if (c.deckB.getTelemetry().isPlaying) {
            c.deckB.pause();
          } else {
            if (c.deckB.getTelemetry().isSyncEnabled && c.deckA.getTelemetry().isPlaying) {
              c.triggerBeatPerfectSlaveStart('beat');
            } else {
              c.deckB.play();
            }
          }
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

  const handleLoadTrack = (deckId: DeckId, track: TrackData, targetBpm?: number) => {
    const c = controllerRef.current;
    if (!c) return;
    if (deckId === 'A') {
      const prepared = c.deckA.loadTrack(track, targetBpm);
      setTrackA(prepared);
    } else {
      const prepared = c.deckB.loadTrack(track, targetBpm);
      setTrackB(prepared);
    }
  };

  const handleAddTrack = (track: TrackData) => {
    controllerRef.current?.addTrack(track);
    setTracks((prev) => [...prev, track]);
  };

  const handleSyncToggle = (deckId: DeckId) => {
    const c = controllerRef.current;
    if (!c) return;

    if (c.audioCtx.state === 'suspended') {
      c.audioCtx.resume();
    }

    const thisDeck = deckId === 'A' ? c.deckA : c.deckB;
    const otherDeckId: DeckId = deckId === 'A' ? 'B' : 'A';
    const otherDeck = deckId === 'A' ? c.deckB : c.deckA;

    const thisTelem = thisDeck.getTelemetry();
    const otherTelem = otherDeck.getTelemetry();

    // If this deck already has sync enabled, disable it
    if (thisTelem.isSyncEnabled) {
      thisDeck.setSync(false);
      thisDeck.setPLLMultiplier(1.0);
      return;
    }

    // Ensure the other deck is designated as Master if not already
    if (!otherTelem.isMaster) {
      c.setMasterDeck(otherDeckId);
    }

    try {
      // Trigger instant beat-perfect rhythmic phase alignment & tempo lock
      c.triggerBeatPerfectSlaveStart('beat');
      const tA = c.deckA.getTrack();
      const tB = c.deckB.getTrack();
      if (tA) setTrackA(tA);
      if (tB) setTrackB(tB);
    } catch (err) {
      console.error('Handled sync alignment error gracefully:', err);
    }
  };

  const handlePlayA = () => {
    const c = controllerRef.current;
    if (!c) return;
    if (c.audioCtx.state === 'suspended') {
      c.audioCtx.resume();
    }
    const tA = c.deckA.getTelemetry();
    const tB = c.deckB.getTelemetry();
    if (tA.isSyncEnabled && tB.isPlaying) {
      c.triggerBeatPerfectSlaveStart('beat');
    } else {
      c.deckA.play();
    }
  };

  const handlePlayB = () => {
    const c = controllerRef.current;
    if (!c) return;
    if (c.audioCtx.state === 'suspended') {
      c.audioCtx.resume();
    }
    const tA = c.deckA.getTelemetry();
    const tB = c.deckB.getTelemetry();
    if (tB.isSyncEnabled && tA.isPlaying) {
      c.triggerBeatPerfectSlaveStart('beat');
    } else {
      c.deckB.play();
    }
  };

  const handleLoadTestPair = () => {
    const c = controllerRef.current;
    if (!c || tracks.length < 2) return;
    const track1 = tracks.find(t => t.id === 'track-high-school-plumber-103') || tracks[0];
    const track2 = tracks.find(t => t.id === 'track-yatapita-diamond-platnumz-91') || tracks[1];

    c.deckA.loadTrack(track1);
    c.deckB.loadTrack(track2);
    setTrackA(c.deckA.getTrack());
    setTrackB(c.deckB.getTrack());
  };

  const handleSetFirstDownbeat = (deckId: DeckId) => {
    const c = controllerRef.current;
    if (!c) return;
    c.setFirstDownbeat(deckId);
    if (deckId === 'A') setTrackA(c.deckA.getTrack());
    else setTrackB(c.deckB.getTrack());
  };

  const handleNudgeBeatGrid = (deckId: DeckId, deltaMs: number) => {
    const c = controllerRef.current;
    if (!c) return;
    c.nudgeBeatGrid(deckId, deltaMs);
    if (deckId === 'A') setTrackA(c.deckA.getTrack());
    else setTrackB(c.deckB.getTrack());
  };

  const handleSetTrackBpm = (deckId: DeckId, bpm: number) => {
    const c = controllerRef.current;
    if (!c) return;
    c.setTrackBpm(deckId, bpm);
    if (deckId === 'A') setTrackA(c.deckA.getTrack());
    else setTrackB(c.deckB.getTrack());
  };

  const handleDoubleBpm = (deckId: DeckId) => {
    const c = controllerRef.current;
    if (!c) return;
    c.doubleTrackBpm(deckId);
    if (deckId === 'A') setTrackA(c.deckA.getTrack());
    else setTrackB(c.deckB.getTrack());
  };

  const handleHalveBpm = (deckId: DeckId) => {
    const c = controllerRef.current;
    if (!c) return;
    c.halveTrackBpm(deckId);
    if (deckId === 'A') setTrackA(c.deckA.getTrack());
    else setTrackB(c.deckB.getTrack());
  };

  const handleQuickAutoSync = async () => {
    const c = controllerRef.current;
    if (!c) return;
    if (c.audioCtx.state === 'suspended') {
      await c.audioCtx.resume();
    }
    c.setCrossfaderPosition(0);
    setCrossfaderPos(0);
    c.setMasterDeck('A');

    const tA = c.deckA.getTrack();
    const tB = c.deckB.getTrack();
    if (!tA || !tB) return;

    const telemA = c.deckA.getTelemetry();
    if (telemA.isPlaying) {
      c.triggerBeatPerfectSlaveStart('beat');
    } else {
      const startA = tA.beatGrid?.firstDownbeatSample ?? 0;
      const startB = tB.beatGrid?.firstDownbeatSample ?? 0;
      c.deckA.seekToSourceSample(startA, false);
      c.deckB.seekToSourceSample(startB, false);
      const baseTempo = tA.bpm / tB.bpm;
      c.deckB.setBaseTempoMultiplier(baseTempo);
      c.deckB.setPLLMultiplier(1.0);
      c.deckB.setSync(true);
      c.deckA.setSync(false);
      const pitchPct = (baseTempo - 1.0) / c.deckB.getPitchRange();
      c.deckB.setPitchPercentage(Math.max(-1.0, Math.min(1.0, pitchPct)));
      const startTime = c.audioCtx.currentTime + 0.05;
      c.deckA.play(startTime, startA);
      c.deckB.play(startTime, startB);
    }
    setTrackA(c.deckA.getTrack());
    setTrackB(c.deckB.getTrack());
  };

  // Fallback default telemetry while loading
  const defaultTelemetryA: DeckTelemetry = {
    deckId: 'A',
    trackId: null,
    trackTitle: 'Midnight Drive',
    bpm: 124,
    effectiveBpm: 124,
    pitchPercentage: 0,
    keyLock: true,
    isPlaying: false,
    isMaster: true,
    isSyncEnabled: false,
    isSlipMode: false,
    isSlipping: false,
    slipSourceSample: 0,
    slipTimeSeconds: 0,
    currentSourceSample: 0,
    currentOutputFrame: 0,
    currentTimeSeconds: 206,
    currentBeatIndex: 0,
    beatInBar: 1,
    barIndex: 1,
    beatPhase: 0,
    vuLevel: [0, 0]
  };

  const defaultTelemetryB: DeckTelemetry = {
    deckId: 'B',
    trackId: null,
    trackTitle: 'Higher Tonight',
    bpm: 126,
    effectiveBpm: 126,
    pitchPercentage: 0,
    keyLock: true,
    isPlaying: false,
    isMaster: false,
    isSyncEnabled: false,
    isSlipMode: false,
    isSlipping: false,
    slipSourceSample: 0,
    slipTimeSeconds: 0,
    currentSourceSample: 0,
    currentOutputFrame: 0,
    currentTimeSeconds: 108,
    currentBeatIndex: 0,
    beatInBar: 1,
    barIndex: 1,
    beatPhase: 0,
    vuLevel: [0, 0]
  };

  // =========================================================================
  // LOOPER & SAMPLER ACTIONS (TEMPO-SYNCED AUDIO LOOPS & PERFORMANCE PADS)
  // =========================================================================
  const handleTogglePlaySlot = (slotId: string) => {
    const c = controllerRef.current;
    if (!c) return;
    if (c.audioCtx.state === 'suspended') {
      c.audioCtx.resume();
    }
    c.looper.togglePlaySlot(
      slotId,
      c.deckA.getTelemetry(),
      c.deckB.getTelemetry(),
      c.deckA.getTrack(),
      c.deckB.getTrack()
    );
    setLooperTelemetry(c.getLooperTelemetry());
  };

  const handleUploadLoopFile = async (file: File, slotIndex = 0, forcedBars?: number) => {
    const c = controllerRef.current;
    if (!c) return;
    if (c.audioCtx.state === 'suspended') {
      await c.audioCtx.resume();
    }
    await c.looper.loadCustomAudioIntoSlot(slotIndex, file, forcedBars);
    setLooperTelemetry(c.getLooperTelemetry());
    setIsLooperBoardOpen(true);
    setActiveBoardMode('looper');
  };

  const handleAddCustomLoopSlot = async (file: File) => {
    const c = controllerRef.current;
    if (!c) return;
    if (c.audioCtx.state === 'suspended') {
      await c.audioCtx.resume();
    }
    await c.looper.addCustomLoopSlot(file);
    setLooperTelemetry(c.getLooperTelemetry());
    setIsLooperBoardOpen(true);
    setActiveBoardMode('looper');
  };

  const handleSetSlotBars = (slotIndex: number, bars: number) => {
    const c = controllerRef.current;
    if (!c) return;
    c.looper.setSlotBars(slotIndex, bars);
    setLooperTelemetry(c.getLooperTelemetry());
  };

  const handleCaptureFromDeck = (slotIndex: number, deckId: 'A' | 'B') => {
    const c = controllerRef.current;
    if (!c) return;
    const deck = deckId === 'A' ? c.deckA : c.deckB;
    const track = deck.getTrack();
    if (!track) return;
    c.looper.captureFromDeck(slotIndex, deck.getTelemetry(), track);
    setLooperTelemetry(c.getLooperTelemetry());
  };

  const handleUploadSampleFile = async (file: File, padIndex = 0) => {
    const c = controllerRef.current;
    if (!c) return;
    if (c.audioCtx.state === 'suspended') {
      await c.audioCtx.resume();
    }
    await c.sampler.loadCustomSampleIntoPad(padIndex, file);
    setSamplerTelemetry(c.getSamplerTelemetry());
    setIsLooperBoardOpen(true);
    setActiveBoardMode('sampler');
  };

  const handleTriggerPad = (padIndex: number, velocity = 1.0) => {
    const c = controllerRef.current;
    if (!c) return;
    if (c.audioCtx.state === 'suspended') {
      c.audioCtx.resume();
    }
    const masterDeck = c.deckA.getTelemetry().isMaster ? c.deckA : c.deckB;
    c.sampler.triggerPad(padIndex, velocity, masterDeck.getTelemetry(), masterDeck.getTrack());
    setSamplerTelemetry(c.getSamplerTelemetry());
  };

  const handleReleasePad = (padIndex: number) => {
    const c = controllerRef.current;
    if (!c) return;
    c.sampler.releasePad(padIndex);
    setSamplerTelemetry(c.getSamplerTelemetry());
  };

  const telemA = telemetryA || defaultTelemetryA;
  const telemB = telemetryB || defaultTelemetryB;

  return (
    <div className="min-h-screen bg-[#06070A] text-slate-100 flex flex-col items-center justify-start antialiased selection:bg-sky-500 selection:text-slate-950 font-sans p-0 sm:p-2">
      {/* Container simulating the complete setup from the reference image */}
      <div className="w-full max-w-5xl bg-[#090C12] rounded-none sm:rounded-2xl border-0 sm:border border-[#1E2330] shadow-2xl overflow-hidden flex flex-col">
        {/* ========================================================================= */}
        {/* 1. TOP SOFTWARE SCREEN (Laptop Display Section)                            */}
        {/* ========================================================================= */}
        <div className="w-full bg-[#07090E] border-b border-[#141824] flex flex-col">
          {/* Top Bar: Brand, Navigation & Real-time Clock */}
          <DjTopNav
            activeTab={activeNavTab}
            setActiveTab={setActiveNavTab}
            onOpenSongList={() => {
              setLibraryTargetDeck('A');
              setIsLibraryOpen(true);
            }}
            onOpenSettings={() => setIsSpecsModalOpen(true)}
            isLooperBoardOpen={isLooperBoardOpen}
            onToggleLooperBoard={(mode) => {
              if (mode) {
                setActiveBoardMode(mode);
                setIsLooperBoardOpen(true);
              } else {
                setIsLooperBoardOpen((prev) => !prev);
              }
            }}
            onUploadLoopFile={(file) => handleUploadLoopFile(file, 0)}
            onUploadSampleFile={(file) => handleUploadSampleFile(file, 0)}
            isLooperPlaying={looperTelemetry?.isAnyPlaying}
            isSamplerPlaying={samplerTelemetry?.pads.some((p) => p.isPlaying)}
          />

          {/* Software Dual Stacked Waveforms: Deck A & Deck B */}
          <div className="p-2 sm:p-3">
            <WaveformDisplay
              trackA={trackA}
              trackB={trackB}
              telemetryA={telemA}
              telemetryB={telemB}
              phaseLockState={phaseLockState}
              onSeekDeckA={(s) => controllerRef.current?.deckA.seekToSourceSample(s)}
              onSeekDeckB={(s) => controllerRef.current?.deckB.seekToSourceSample(s)}
              onPlayDeckA={handlePlayA}
              onPauseDeckA={() => controllerRef.current?.deckA.pause()}
              onCueDeckA={() => controllerRef.current?.deckA.handleCuePress()}
              onPlayDeckB={handlePlayB}
              onPauseDeckB={() => controllerRef.current?.deckB.pause()}
              onCueDeckB={() => controllerRef.current?.deckB.handleCuePress()}
              onToggleLooper={(deck) => {
                const targetDeck = deck === 'A' ? telemA : telemB;
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
              onToggleHotCue={(deck) => {
                const c = controllerRef.current;
                if (deck === 'A') c?.deckA.triggerHotCue(1);
                else c?.deckB.triggerHotCue(1);
              }}
              onSetFirstDownbeatA={() => handleSetFirstDownbeat('A')}
              onNudgeBeatGridA={(ms) => handleNudgeBeatGrid('A', ms)}
              onSetFirstDownbeatB={() => handleSetFirstDownbeat('B')}
              onNudgeBeatGridB={(ms) => handleNudgeBeatGrid('B', ms)}
              onLoadTestPair={handleLoadTestPair}
              onToggleSlipDeckA={() => controllerRef.current?.deckA.toggleSlipMode()}
              onToggleSlipDeckB={() => controllerRef.current?.deckB.toggleSlipMode()}
              onSlipTouchStartA={(sample) => controllerRef.current?.deckA.startSlipTouch(sample)}
              onSlipTouchMoveA={(sample) => controllerRef.current?.deckA.updateSlipTouch(sample)}
              onSlipTouchEndA={() => controllerRef.current?.deckA.endSlipTouch()}
              onSlipTouchStartB={(sample) => controllerRef.current?.deckB.startSlipTouch(sample)}
              onSlipTouchMoveB={(sample) => controllerRef.current?.deckB.updateSlipTouch(sample)}
              onSlipTouchEndB={() => controllerRef.current?.deckB.endSlipTouch()}
            />
          </div>

          {/* Dedicated Looper & Sampler Board with Local File Upload Sockets */}
          <LooperBoard
            looperTelem={looperTelemetry}
            samplerTelem={samplerTelemetry}
            telemetryA={telemA}
            telemetryB={telemB}
            trackA={trackA}
            trackB={trackB}
            activeBoardMode={activeBoardMode}
            setActiveBoardMode={setActiveBoardMode}
            isOpen={isLooperBoardOpen}
            onClose={() => setIsLooperBoardOpen(false)}
            // Looper Actions
            onTogglePlaySlot={handleTogglePlaySlot}
            onSetLoopBeats={(slotId, beats) => {
              controllerRef.current?.looper.setSlotLoopBeats(slotId, beats);
              setLooperTelemetry(controllerRef.current?.getLooperTelemetry() || null);
            }}
            onHalveLoop={(slotId) => {
              controllerRef.current?.looper.halveSlotLoop(slotId);
              setLooperTelemetry(controllerRef.current?.getLooperTelemetry() || null);
            }}
            onDoubleLoop={(slotId) => {
              controllerRef.current?.looper.doubleSlotLoop(slotId);
              setLooperTelemetry(controllerRef.current?.getLooperTelemetry() || null);
            }}
            onTriggerRoll={(slotId, beats) => {
              controllerRef.current?.looper.triggerSlotRoll(slotId, beats);
              setLooperTelemetry(controllerRef.current?.getLooperTelemetry() || null);
            }}
            onReleaseRoll={(slotId) => {
              controllerRef.current?.looper.releaseSlotRoll(slotId);
              setLooperTelemetry(controllerRef.current?.getLooperTelemetry() || null);
            }}
            onSetSlotVolume={(slotId, val) => {
              controllerRef.current?.looper.setSlotVolume(slotId, val);
              setLooperTelemetry(controllerRef.current?.getLooperTelemetry() || null);
            }}
            onSetSlotFilter={(slotId, val) => {
              controllerRef.current?.looper.setSlotFilter(slotId, val);
              setLooperTelemetry(controllerRef.current?.getLooperTelemetry() || null);
            }}
            onToggleSlotMute={(slotId) => {
              controllerRef.current?.looper.toggleSlotMute(slotId);
              setLooperTelemetry(controllerRef.current?.getLooperTelemetry() || null);
            }}
            onToggleSlotSolo={(slotId) => {
              controllerRef.current?.looper.toggleSlotSolo(slotId);
              setLooperTelemetry(controllerRef.current?.getLooperTelemetry() || null);
            }}
            onSetSyncTarget={(target) => {
              controllerRef.current?.looper.setSyncTarget(target);
              setLooperTelemetry(controllerRef.current?.getLooperTelemetry() || null);
            }}
            onSetQuantize={(q) => {
              controllerRef.current?.looper.setQuantize(q);
              setLooperTelemetry(controllerRef.current?.getLooperTelemetry() || null);
            }}
            onSetMasterVolume={(val) => {
              controllerRef.current?.looper.setMasterVolume(val);
              setLooperTelemetry(controllerRef.current?.getLooperTelemetry() || null);
            }}
            onStopAllLoops={() => {
              controllerRef.current?.looper.stopAll();
              setLooperTelemetry(controllerRef.current?.getLooperTelemetry() || null);
            }}
            onPlayAllLoops={() => {
              const c = controllerRef.current;
              if (c) {
                c.looper.playAll(telemA, telemB, trackA, trackB);
                setLooperTelemetry(c.getLooperTelemetry());
              }
            }}
            onUploadCustomLoop={(slotIndex, file, forcedBars) => {
              handleUploadLoopFile(file, slotIndex, forcedBars);
            }}
            onSetSlotBars={handleSetSlotBars}
            onCaptureFromDeck={handleCaptureFromDeck}
            onAddCustomLoopSlot={handleAddCustomLoopSlot}
            // Sampler Actions
            onTriggerPad={handleTriggerPad}
            onReleasePad={handleReleasePad}
            onStopPad={(padIndex) => {
              controllerRef.current?.sampler.stopPad(padIndex);
              setSamplerTelemetry(controllerRef.current?.getSamplerTelemetry() || null);
            }}
            onStopAllSamples={() => {
              controllerRef.current?.sampler.stopAll();
              setSamplerTelemetry(controllerRef.current?.getSamplerTelemetry() || null);
            }}
            onSetPadVolume={(padIndex, val) => {
              controllerRef.current?.sampler.setPadVolume(padIndex, val);
              setSamplerTelemetry(controllerRef.current?.getSamplerTelemetry() || null);
            }}
            onSetPadPitch={(padIndex, semitones) => {
              controllerRef.current?.sampler.setPadPitch(padIndex, semitones);
              setSamplerTelemetry(controllerRef.current?.getSamplerTelemetry() || null);
            }}
            onSetPadPlayMode={(padIndex, mode) => {
              controllerRef.current?.sampler.setPadPlayMode(padIndex, mode);
              setSamplerTelemetry(controllerRef.current?.getSamplerTelemetry() || null);
            }}
            onSetPadTempoSync={(padIndex, enabled) => {
              controllerRef.current?.sampler.setPadTempoSync(padIndex, enabled);
              setSamplerTelemetry(controllerRef.current?.getSamplerTelemetry() || null);
            }}
            onSetPadQuantize={(padIndex, quantize) => {
              controllerRef.current?.sampler.setPadQuantize(padIndex, quantize);
              setSamplerTelemetry(controllerRef.current?.getSamplerTelemetry() || null);
            }}
            onSetSamplerMasterVolume={(val) => {
              controllerRef.current?.sampler.setMasterVolume(val);
              setSamplerTelemetry(controllerRef.current?.getSamplerTelemetry() || null);
            }}
            onSetSamplerGlobalQuantize={(q) => {
              controllerRef.current?.sampler.setGlobalQuantize(q);
              setSamplerTelemetry(controllerRef.current?.getSamplerTelemetry() || null);
            }}
            onUploadCustomSample={(padIndex, file) => {
              handleUploadSampleFile(file, padIndex);
            }}
          />
        </div>

        {/* ========================================================================= */}
        {/* 2. PHYSICAL HARDWARE CONTROLLER SURFACE (Mixer & Decks)                   */}
        {/* ========================================================================= */}
        <DjHardwareController
          telemetryA={telemA}
          telemetryB={telemB}
          // Transports
          onPlayA={handlePlayA}
          onPauseA={() => controllerRef.current?.deckA.pause()}
          onCueDownA={() => controllerRef.current?.deckA.handleCuePress()}
          onCueUpA={() => controllerRef.current?.deckA.handleCueRelease()}
          onSyncA={() => handleSyncToggle('A')}
          onToggleSlipA={() => controllerRef.current?.deckA.toggleSlipMode()}
          onPlayB={handlePlayB}
          onPauseB={() => controllerRef.current?.deckB.pause()}
          onCueDownB={() => controllerRef.current?.deckB.handleCuePress()}
          onCueUpB={() => controllerRef.current?.deckB.handleCueRelease()}
          onSyncB={() => handleSyncToggle('B')}
          onToggleSlipB={() => controllerRef.current?.deckB.toggleSlipMode()}
          // Deck A EQs & Volume
          lowEqA={lowEqA}
          midEqA={midEqA}
          highEqA={highEqA}
          filterA={filterA}
          volumeA={volumeA}
          onSetLowEqA={(v) => {
            setLowEqA(v);
            controllerRef.current?.deckA.setLowEq(v);
          }}
          onSetMidEqA={(v) => {
            setMidEqA(v);
            controllerRef.current?.deckA.setMidEq(v);
          }}
          onSetHighEqA={(v) => {
            setHighEqA(v);
            controllerRef.current?.deckA.setHighEq(v);
          }}
          onSetFilterA={(v) => {
            setFilterA(v);
            controllerRef.current?.deckA.setFilter(v);
          }}
          onSetVolumeA={(v) => {
            setVolumeA(v);
            controllerRef.current?.deckA.setVolume(v);
          }}
          // Deck B EQs & Volume
          lowEqB={lowEqB}
          midEqB={midEqB}
          highEqB={highEqB}
          filterB={filterB}
          volumeB={volumeB}
          onSetLowEqB={(v) => {
            setLowEqB(v);
            controllerRef.current?.deckB.setLowEq(v);
          }}
          onSetMidEqB={(v) => {
            setMidEqB(v);
            controllerRef.current?.deckB.setMidEq(v);
          }}
          onSetHighEqB={(v) => {
            setHighEqB(v);
            controllerRef.current?.deckB.setHighEq(v);
          }}
          onSetFilterB={(v) => {
            setFilterB(v);
            controllerRef.current?.deckB.setFilter(v);
          }}
          onSetVolumeB={(v) => {
            setVolumeB(v);
            controllerRef.current?.deckB.setVolume(v);
          }}
          // Master & Crossfader
          masterVolume={masterVolume}
          onSetMasterVolume={(v) => {
            setMasterVolume(v);
            controllerRef.current?.setMasterVolume(v);
          }}
          crossfaderPos={crossfaderPos}
          onSetCrossfaderPos={(v) => {
            setCrossfaderPos(v);
            controllerRef.current?.setCrossfaderPosition(v);
          }}
          // Actions & Performance Pads
          onOpenLibrary={handleOpenLibrary}
          onTriggerHotCueA={(id) => controllerRef.current?.deckA.triggerHotCue(id)}
          onTriggerHotCueB={(id) => controllerRef.current?.deckB.triggerHotCue(id)}
          onSetLoopA={(beats) => controllerRef.current?.deckA.setLoop(beats)}
          onSetLoopB={(beats) => controllerRef.current?.deckB.setLoop(beats)}
          onPlaySampler={(fx) => {
            const c = controllerRef.current;
            if (!c) return;
            if (fx === 'airhorn' || fx === 'siren' || fx === 'laser' || fx === 'drop') {
              c.playSamplerFx(fx);
            } else {
              const padMap: Record<string, number> = { kick: 0, snare: 1, hihat: 2, vocal: 3 };
              const padIdx = padMap[fx] ?? 0;
              const masterDeck = c.deckA.getTelemetry().isMaster ? c.deckA : c.deckB;
              c.sampler.triggerPad(padIdx, 1.0, masterDeck.getTelemetry(), masterDeck.getTrack());
              setSamplerTelemetry(c.getSamplerTelemetry());
            }
          }}
        />
      </div>

      {/* Floating Bottom Quick Utilities Bar */}
      <div className="w-full max-w-5xl flex items-center justify-between py-2 px-3 text-[11px] font-mono text-slate-500">
        <div className="flex items-center gap-2">
          <button
            onClick={handleQuickAutoSync}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 font-bold active:scale-95 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>AUTO-SYNC MASTER DEMO</span>
          </button>
          <button
            onClick={() => setShowTelemetryDrawer(!showTelemetryDrawer)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 font-bold active:scale-95 transition-all"
          >
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span>{showTelemetryDrawer ? 'HIDE TELEMETRY' : 'SHOW TELEMETRY'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSpecsModalOpen(true)}
            className="hover:text-slate-300 flex items-center gap-1"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>SPECIFICATION</span>
          </button>
        </div>
      </div>

      {/* Optional Telemetry Drawer for diagnostics */}
      {showTelemetryDrawer && (
        <div className="w-full max-w-5xl mt-2">
          <SyncTelemetryPanel
            telemetryA={telemA}
            telemetryB={telemB}
            phaseLockState={phaseLockState}
            slaveStartPlan={slaveStartPlan}
            pllConfig={
              controllerRef.current
                ? controllerRef.current.syncEngine.getConfig()
                : {
                    kp: 0.65,
                    ki: 0.12,
                    deadbandSeconds: 0.0015,
                    correctionWindowBeats: 3.0,
                    maxCorrectionFraction: 0.08,
                    severeErrorThresholdSeconds: 0.14
                  }
            }
            onUpdatePllConfig={(cfg) => controllerRef.current?.syncEngine.updateConfig(cfg)}
            onInjectDisturbance={(ms) => controllerRef.current?.injectPhaseDisturbance(ms)}
            onRetriggerSlaveSync={(mode) => controllerRef.current?.triggerBeatPerfectSlaveStart(mode)}
          />
        </div>
      )}

      {/* Track Library Modal */}
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

      {/* Specs Modal */}
      <SpecsModal isOpen={isSpecsModalOpen} onClose={() => setIsSpecsModalOpen(false)} />
    </div>
  );
}
