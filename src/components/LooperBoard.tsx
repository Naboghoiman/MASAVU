/**
 * Looper & Sampler Board Component
 * Hardware-grade workstation for audio sample loops and one-shot performance pads.
 * Features sample-accurate tempo matching with active decks, local storage file upload sockets,
 * quantized launch, bar length configuration, slip rolls, combo filters, and pad triggers.
 */

import React, { useRef, useState } from 'react';
import {
  LooperTelemetry,
  LooperQuantize,
  LooperSyncTarget,
  LoopSlotData,
  DeckTelemetry,
  TrackData,
  SamplerTelemetry,
  SamplerPadData,
  SamplerPlayMode,
  SamplerQuantize
} from '../types/dj';
import {
  Play,
  Square,
  Volume2,
  VolumeX,
  Sliders,
  Sparkles,
  Upload,
  Zap,
  Disc,
  Layers,
  Radio,
  Activity,
  CheckCircle2,
  Timer,
  FolderOpen,
  Plus,
  Flame,
  Grid,
  Music,
  X,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LooperBoardProps {
  // Telemetry & State
  looperTelem: LooperTelemetry | null;
  samplerTelem: SamplerTelemetry | null;
  telemetryA: DeckTelemetry | null;
  telemetryB: DeckTelemetry | null;
  trackA: TrackData | null;
  trackB: TrackData | null;
  activeBoardMode: 'looper' | 'sampler';
  setActiveBoardMode: (mode: 'looper' | 'sampler') => void;
  isOpen: boolean;
  onClose: () => void;

  // Looper Actions
  onTogglePlaySlot: (slotId: string) => void;
  onSetLoopBeats: (slotId: string, beats: number) => void;
  onHalveLoop: (slotId: string) => void;
  onDoubleLoop: (slotId: string) => void;
  onTriggerRoll: (slotId: string, beats: number) => void;
  onReleaseRoll: (slotId: string) => void;
  onSetSlotVolume: (slotId: string, val: number) => void;
  onSetSlotFilter: (slotId: string, val: number) => void;
  onToggleSlotMute: (slotId: string) => void;
  onToggleSlotSolo: (slotId: string) => void;
  onSetSyncTarget: (target: LooperSyncTarget) => void;
  onSetQuantize: (q: LooperQuantize) => void;
  onSetMasterVolume: (val: number) => void;
  onStopAllLoops: () => void;
  onPlayAllLoops: () => void;
  onUploadCustomLoop: (slotIndex: number, file: File, forcedBars?: number) => void;
  onSetSlotBars: (slotIndex: number, bars: number) => void;
  onCaptureFromDeck: (slotIndex: number, deckId: 'A' | 'B') => void;
  onAddCustomLoopSlot?: (file: File) => void;

  // Sampler Actions
  onTriggerPad: (padIndex: number, velocity?: number) => void;
  onReleasePad: (padIndex: number) => void;
  onStopPad: (padIndex: number) => void;
  onStopAllSamples: () => void;
  onSetPadVolume: (padIndex: number, val: number) => void;
  onSetPadPitch: (padIndex: number, semitones: number) => void;
  onSetPadPlayMode: (padIndex: number, mode: SamplerPlayMode) => void;
  onSetPadTempoSync: (padIndex: number, enabled: boolean) => void;
  onSetPadQuantize: (padIndex: number, quantize: SamplerQuantize) => void;
  onSetSamplerMasterVolume: (val: number) => void;
  onSetSamplerGlobalQuantize: (q: SamplerQuantize) => void;
  onUploadCustomSample: (padIndex: number, file: File) => void;
}

export const LooperBoard: React.FC<LooperBoardProps> = ({
  looperTelem,
  samplerTelem,
  telemetryA,
  telemetryB,
  trackA,
  trackB,
  activeBoardMode,
  setActiveBoardMode,
  isOpen,
  onClose,
  // Looper
  onTogglePlaySlot,
  onSetLoopBeats,
  onHalveLoop,
  onDoubleLoop,
  onTriggerRoll,
  onReleaseRoll,
  onSetSlotVolume,
  onSetSlotFilter,
  onToggleSlotMute,
  onToggleSlotSolo,
  onSetSyncTarget,
  onSetQuantize,
  onSetMasterVolume,
  onStopAllLoops,
  onPlayAllLoops,
  onUploadCustomLoop,
  onSetSlotBars,
  onCaptureFromDeck,
  onAddCustomLoopSlot,
  // Sampler
  onTriggerPad,
  onReleasePad,
  onStopPad,
  onStopAllSamples,
  onSetPadVolume,
  onSetPadPitch,
  onSetPadPlayMode,
  onSetPadTempoSync,
  onSetPadQuantize,
  onSetSamplerMasterVolume,
  onSetSamplerGlobalQuantize,
  onUploadCustomSample
}) => {
  const [selectedSlotForBars, setSelectedSlotForBars] = useState<number | null>(null);
  const [dragOverSlotIndex, setDragOverSlotIndex] = useState<number | null>(null);
  const [dragOverPadIndex, setDragOverPadIndex] = useState<number | null>(null);

  const loopFileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const newLoopInputRef = useRef<HTMLInputElement | null>(null);
  const sampleFileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  if (!isOpen) return null;

  const targetBpm = looperTelem?.activeTargetBpm || (telemetryA?.effectiveBpm ?? 128.0);
  const isMasterPlaying = looperTelem?.isMasterSynced ?? Boolean(telemetryA?.isPlaying || telemetryB?.isPlaying);

  // Render mini waveform preview with animated playhead
  const renderWaveform = (slot: LoopSlotData) => {
    const points = Array.from(slot.waveform);
    const progress = slot.isPlaying ? (slot.currentBeatIndex + slot.beatPhase) / slot.activeLoopBeats : 0;
    const clampedProgress = Math.max(0, Math.min(1, progress));

    return (
      <div className="relative h-9 w-full bg-slate-950 rounded-lg overflow-hidden border border-slate-800/80 flex items-center px-1">
        <div className="flex items-center justify-between w-full h-full gap-[2px]">
          {points.map((val, idx) => {
            const barProgress = idx / points.length;
            const isPlayed = slot.isPlaying && barProgress <= clampedProgress;
            const height = Math.max(10, Math.round(val * 100));

            return (
              <div
                key={idx}
                className={`w-full rounded-sm transition-colors ${
                  isPlayed
                    ? slot.category === 'drum'
                      ? 'bg-amber-400'
                      : slot.category === 'percussion'
                      ? 'bg-emerald-400'
                      : slot.category === 'bass'
                      ? 'bg-cyan-400'
                      : 'bg-purple-400'
                    : 'bg-slate-700/60'
                }`}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>

        {slot.isPlaying && (
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-white shadow-sm shadow-white pointer-events-none z-10 transition-all duration-75"
            style={{ left: `${clampedProgress * 100}%` }}
          />
        )}

        <div className="absolute top-1 right-1.5 pointer-events-none text-[9px] font-mono font-bold text-slate-300 bg-slate-900/90 px-1 py-0.5 rounded border border-slate-700/80">
          {slot.isPlaying ? `BEAT ${slot.beatInLoop}/${slot.activeLoopBeats}` : `${slot.activeLoopBeats} BEATS`}
        </div>
      </div>
    );
  };

  return (
    <div
      id="looper-sampler-board-container"
      className="w-full bg-[#0B0E14] border-y border-[#1E2538] p-3 sm:p-4 shadow-2xl relative select-none animate-fadeIn"
    >
      {/* Board Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              id="board-tab-looper-btn"
              onClick={() => setActiveBoardMode('looper')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold font-mono tracking-wider transition-all ${
                activeBoardMode === 'looper'
                  ? 'bg-amber-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>AUDIO LOOP BOARD</span>
              {looperTelem?.isAnyPlaying && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
              )}
            </button>

            <button
              id="board-tab-sampler-btn"
              onClick={() => setActiveBoardMode('sampler')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold font-mono tracking-wider transition-all ${
                activeBoardMode === 'sampler'
                  ? 'bg-purple-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>SAMPLE PAD BOARD</span>
              {samplerTelem?.pads.some((p) => p.isPlaying) && (
                <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse ml-0.5" />
              )}
            </button>
          </div>

          {/* Sync Status Badge */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono">
            <Radio
              className={`w-3.5 h-3.5 ${
                isMasterPlaying ? 'text-emerald-400 animate-pulse' : 'text-slate-500'
              }`}
            />
            <span className="text-slate-400">SONG SYNC:</span>
            <span className={`font-bold ${isMasterPlaying ? 'text-emerald-400' : 'text-slate-400'}`}>
              {targetBpm.toFixed(1)} BPM
            </span>
            {isMasterPlaying && (
              <span className="text-[10px] bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 px-1 py-0.2 rounded uppercase font-bold">
                LOCKED
              </span>
            )}
          </div>
        </div>

        {/* Global Controls & Close */}
        <div className="flex items-center gap-2 sm:gap-3">
          {activeBoardMode === 'looper' ? (
            <>
              {/* Quantize Mode */}
              <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 px-2 py-1 rounded-md text-[11px] font-mono">
                <Timer className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-400 hidden md:inline">QUANTIZE:</span>
                <select
                  value={looperTelem?.quantize || '1_BAR'}
                  onChange={(e) => onSetQuantize(e.target.value as LooperQuantize)}
                  className="bg-transparent text-amber-400 font-bold text-[11px] focus:outline-none cursor-pointer"
                >
                  <option value="1_BAR">1 BAR</option>
                  <option value="1_BEAT">1 BEAT</option>
                  <option value="HALF_BEAT">1/2 BEAT</option>
                  <option value="INSTANT">INSTANT</option>
                </select>
              </div>

              {/* Sync Target */}
              <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 px-2 py-1 rounded-md text-[11px] font-mono">
                <span className="text-slate-400 hidden md:inline">TARGET:</span>
                <select
                  value={looperTelem?.syncTarget || 'AUTO'}
                  onChange={(e) => onSetSyncTarget(e.target.value as LooperSyncTarget)}
                  className="bg-transparent text-sky-400 font-bold text-[11px] focus:outline-none cursor-pointer"
                >
                  <option value="AUTO">AUTO (MASTER)</option>
                  <option value="DECK_A">DECK A</option>
                  <option value="DECK_B">DECK B</option>
                </select>
              </div>

              {/* Play All / Stop All */}
              <div className="flex items-center gap-1">
                <button
                  onClick={onPlayAllLoops}
                  title="Play all loops synchronized"
                  className="px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-600/80 text-emerald-400 font-mono text-[10px] font-bold rounded flex items-center gap-1 transition-all active:scale-95"
                >
                  <Play className="w-2.5 h-2.5 fill-current" />
                  <span>ALL PLAY</span>
                </button>
                <button
                  onClick={onStopAllLoops}
                  title="Stop all loops"
                  className="px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900/80 border border-rose-600/80 text-rose-400 font-mono text-[10px] font-bold rounded flex items-center gap-1 transition-all active:scale-95"
                >
                  <Square className="w-2.5 h-2.5 fill-current" />
                  <span>STOP</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Sampler Controls */}
              <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 px-2 py-1 rounded-md text-[11px] font-mono">
                <Timer className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-slate-400 hidden md:inline">QUANTIZE:</span>
                <select
                  value={samplerTelem?.quantize || 'INSTANT'}
                  onChange={(e) => onSetSamplerGlobalQuantize(e.target.value as SamplerQuantize)}
                  className="bg-transparent text-purple-400 font-bold text-[11px] focus:outline-none cursor-pointer"
                >
                  <option value="INSTANT">INSTANT</option>
                  <option value="QUARTER_BEAT">1/4 BEAT</option>
                  <option value="HALF_BEAT">1/2 BEAT</option>
                  <option value="1_BEAT">1 BEAT</option>
                </select>
              </div>

              <button
                onClick={onStopAllSamples}
                title="Stop all playing samples"
                className="px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900/80 border border-rose-600/80 text-rose-400 font-mono text-[10px] font-bold rounded flex items-center gap-1 transition-all active:scale-95"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                <span>STOP ALL</span>
              </button>
            </>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            title="Minimize Board"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. AUDIO LOOP BOARD VIEW */}
      {/* ========================================================================= */}
      {activeBoardMode === 'looper' && (
        <div className="mt-3 space-y-3">
          {/* Looper Slots Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {looperTelem?.slots.map((slot, index) => {
              const isDragOver = dragOverSlotIndex === index;
              return (
                <div
                  key={slot.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverSlotIndex(index);
                  }}
                  onDragLeave={() => setDragOverSlotIndex(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverSlotIndex(null);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      onUploadCustomLoop(index, e.dataTransfer.files[0]);
                    }
                  }}
                  className={`bg-slate-900/90 rounded-xl p-3 border transition-all flex flex-col justify-between relative overflow-hidden shadow-lg ${
                    slot.isPlaying
                      ? 'border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/40'
                      : isDragOver
                      ? 'border-sky-400 ring-2 ring-sky-400 bg-sky-950/40'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Top Bar: Title & Upload Socket Button */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] font-mono font-black text-slate-400 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                        CH {index + 1}
                      </span>
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-100 uppercase truncate font-mono">
                          {slot.name}
                        </div>
                        <div className="text-[9px] font-mono text-slate-400 flex items-center gap-1">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              slot.category === 'drum'
                                ? 'bg-amber-400'
                                : slot.category === 'percussion'
                                ? 'bg-emerald-400'
                                : slot.category === 'bass'
                                ? 'bg-cyan-400'
                                : 'bg-purple-400'
                            }`}
                          />
                          <span>{slot.bpm} BPM</span>
                          {slot.isUserUploaded && (
                            <span className="text-[9px] text-amber-400 bg-amber-950/70 border border-amber-700/50 px-1 rounded">
                              LOCAL
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Upload Socket button */}
                    <div className="flex items-center gap-1">
                      <input
                        type="file"
                        accept="audio/*,.wav,.mp3,.ogg,.flac,.aiff,.m4a"
                        ref={(el) => {
                          loopFileInputRefs.current[index] = el;
                        }}
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            onUploadCustomLoop(index, e.target.files[0]);
                          }
                        }}
                      />
                      <button
                        onClick={() => loopFileInputRefs.current[index]?.click()}
                        title="Upload audio loop from local storage into this socket"
                        className="p-1 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 border border-slate-700 transition-all text-[10px] font-mono flex items-center gap-1"
                      >
                        <Upload className="w-3 h-3" />
                        <span className="hidden sm:inline text-[9px] font-bold">SOCKET</span>
                      </button>
                    </div>
                  </div>

                  {/* Waveform preview */}
                  {renderWaveform(slot)}

                  {/* Bars Sync Selector (1, 2, 4, 8 Bars) */}
                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-800/80 text-[10px] font-mono">
                    <span className="text-slate-400 text-[9px]">BARS LOCK:</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 4, 8].map((bars) => {
                        const isCurrentBars = Math.round(slot.totalBeats / 4) === bars;
                        return (
                          <button
                            key={bars}
                            onClick={() => onSetSlotBars(index, bars)}
                            title={`Set exact loop length to ${bars} Bar${bars > 1 ? 's' : ''} (${bars * 4} beats)`}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors ${
                              isCurrentBars
                                ? 'bg-amber-500 text-slate-950 shadow-sm'
                                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {bars}B
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Slicing Loop Lengths */}
                  <div className="flex items-center justify-between gap-1 mt-1.5">
                    {[0.5, 1, 2, 4, 8, 16].map((beats) => {
                      if (beats > slot.totalBeats) return null;
                      const isActive = slot.activeLoopBeats === beats;
                      return (
                        <button
                          key={beats}
                          onClick={() => onSetLoopBeats(slot.id, beats)}
                          className={`flex-1 py-0.5 rounded text-[9px] font-mono font-bold transition-colors ${
                            isActive
                              ? 'bg-sky-500 text-slate-950'
                              : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {beats >= 1 ? `${beats}` : '½'}
                        </button>
                      );
                    })}
                  </div>

                  {/* Slip Roll & Volume Controls */}
                  <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800/80">
                    {/* Volume Slider & VU */}
                    <div>
                      <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 mb-1">
                        <span>VOL</span>
                        <span>{Math.round(slot.volume * 100)}%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="range"
                          min="0"
                          max="1.2"
                          step="0.02"
                          value={slot.volume}
                          onChange={(e) => onSetSlotVolume(slot.id, parseFloat(e.target.value))}
                          className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                        />
                        {/* Mini LED Meter */}
                        <div className="w-1.5 h-6 bg-slate-950 rounded-full overflow-hidden flex flex-col-reverse p-[1px] border border-slate-800">
                          <div
                            className={`w-full rounded-full transition-all duration-75 ${
                              slot.vuLevel > 0.8
                                ? 'bg-rose-500'
                                : slot.vuLevel > 0.4
                                ? 'bg-amber-400'
                                : 'bg-emerald-400'
                            }`}
                            style={{ height: `${Math.round(slot.vuLevel * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Filter (LPF <-> Neutral <-> HPF) */}
                    <div>
                      <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 mb-1">
                        <span>FILTER</span>
                        <span>
                          {slot.filter < -0.05
                            ? `LP ${Math.round(slot.filter * -100)}%`
                            : slot.filter > 0.05
                            ? `HP ${Math.round(slot.filter * 100)}%`
                            : 'FLAT'}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-1"
                        max="1"
                        step="0.05"
                        value={slot.filter}
                        onChange={(e) => onSetSlotFilter(slot.id, parseFloat(e.target.value))}
                        onDoubleClick={() => onSetSlotFilter(slot.id, 0)}
                        title="Double-click to reset filter"
                        className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Primary Trigger Controls: MUTE, SOLO, PLAY/CUE */}
                  <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => onToggleSlotMute(slot.id)}
                      className={`px-2 py-1.5 rounded text-[10px] font-mono font-bold transition-all ${
                        slot.isMuted
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      MUTE
                    </button>

                    <button
                      onClick={() => onToggleSlotSolo(slot.id)}
                      className={`px-2 py-1.5 rounded text-[10px] font-mono font-bold transition-all ${
                        slot.isSoloed
                          ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      SOLO
                    </button>

                    {/* Launch / Cue Button */}
                    <button
                      onClick={() => onTogglePlaySlot(slot.id)}
                      className={`flex-1 py-1.5 rounded text-xs font-mono font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                        slot.isPlaying
                          ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)] border border-emerald-400'
                          : slot.isPendingQuantize
                          ? 'bg-amber-500 text-slate-950 animate-pulse border border-amber-300'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                      }`}
                    >
                      {slot.isPlaying ? (
                        <>
                          <Square className="w-3 h-3 fill-current" />
                          <span>STOP</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-current" />
                          <span>{slot.isPendingQuantize ? 'SYNCING...' : 'PLAY'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Deck Sampling & Upload New Socket Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs font-mono">
            <div className="flex items-center gap-2 text-slate-400">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>LIVE DECK SAMPLING:</span>
              <button
                onClick={() => onCaptureFromDeck(0, 'A')}
                className="px-2.5 py-1 rounded bg-sky-950/80 hover:bg-sky-900 border border-sky-600/70 text-sky-400 font-bold text-[11px] transition-all"
              >
                CAPTURE 4 BARS FROM DECK A
              </button>
              <button
                onClick={() => onCaptureFromDeck(1, 'B')}
                className="px-2.5 py-1 rounded bg-blue-950/80 hover:bg-blue-900 border border-blue-600/70 text-blue-400 font-bold text-[11px] transition-all"
              >
                CAPTURE 4 BARS FROM DECK B
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="audio/*,.wav,.mp3,.ogg,.flac,.aiff,.m4a"
                ref={newLoopInputRef}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0] && onAddCustomLoopSlot) {
                    onAddCustomLoopSlot(e.target.files[0]);
                  }
                }}
              />
              <button
                onClick={() => newLoopInputRef.current?.click()}
                className="px-3 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/60 text-amber-300 font-bold text-[11px] flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ ADD NEW LOOP SOCKET</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SAMPLE PAD BOARD VIEW */}
      {/* ========================================================================= */}
      {activeBoardMode === 'sampler' && (
        <div className="mt-3 space-y-3">
          {/* Sampler Pads Grid (2x4) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {samplerTelem?.pads.map((pad, index) => {
              const isDragOver = dragOverPadIndex === index;
              return (
                <div
                  key={pad.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverPadIndex(index);
                  }}
                  onDragLeave={() => setDragOverPadIndex(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverPadIndex(null);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      onUploadCustomSample(index, e.dataTransfer.files[0]);
                    }
                  }}
                  className={`bg-slate-900/90 rounded-xl p-3 border transition-all flex flex-col justify-between relative shadow-lg ${
                    pad.isPlaying
                      ? 'shadow-[0_0_20px_rgba(168,85,247,0.4)] ring-2'
                      : isDragOver
                      ? 'border-purple-400 ring-2 ring-purple-400 bg-purple-950/40'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                  style={{
                    borderColor: pad.isPlaying ? pad.color : undefined
                  }}
                >
                  {/* Top Bar: Pad Number, Name, Mode & Upload Socket */}
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-black text-slate-950"
                        style={{ backgroundColor: pad.color }}
                      >
                        {index + 1}
                      </span>
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-100 uppercase truncate font-mono">
                          {pad.name}
                        </div>
                        <div className="text-[9px] font-mono text-slate-400 flex items-center gap-1">
                          <span className="uppercase text-purple-400 font-bold">{pad.playMode}</span>
                          {pad.isUserUploaded && (
                            <span className="text-[8px] text-amber-400 bg-amber-950/70 border border-amber-700/50 px-1 rounded">
                              LOCAL
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Upload Socket */}
                    <input
                      type="file"
                      accept="audio/*,.wav,.mp3,.ogg,.flac,.aiff,.m4a"
                      ref={(el) => {
                        sampleFileInputRefs.current[index] = el;
                      }}
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          onUploadCustomSample(index, e.target.files[0]);
                        }
                      }}
                    />
                    <button
                      onClick={() => sampleFileInputRefs.current[index]?.click()}
                      title="Upload sample from local storage into this pad"
                      className="p-1 rounded bg-slate-800 hover:bg-purple-600 hover:text-white text-slate-300 border border-slate-700 transition-all text-[9px] font-mono flex items-center gap-1"
                    >
                      <Upload className="w-3 h-3" />
                      <span className="hidden sm:inline">SOCKET</span>
                    </button>
                  </div>

                  {/* Primary Trigger Strike Pad */}
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onMouseDown={() => onTriggerPad(index, 1.0)}
                    onMouseUp={() => {
                      if (pad.playMode === 'gate') onReleasePad(index);
                    }}
                    onTouchStart={() => onTriggerPad(index, 1.0)}
                    onTouchEnd={() => {
                      if (pad.playMode === 'gate') onReleasePad(index);
                    }}
                    className={`w-full h-20 rounded-xl flex flex-col items-center justify-center gap-1 border font-mono transition-all relative overflow-hidden ${
                      pad.isPlaying
                        ? 'text-slate-950 shadow-inner'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-200 border-slate-800'
                    }`}
                    style={{
                      backgroundColor: pad.isPlaying ? pad.color : undefined,
                      borderColor: pad.isPlaying ? pad.color : undefined
                    }}
                  >
                    <Flame
                      className={`w-5 h-5 ${
                        pad.isPlaying ? 'text-slate-950 fill-current animate-bounce' : 'text-slate-400'
                      }`}
                    />
                    <span className="text-xs font-black tracking-wider uppercase">
                      {pad.isPlaying ? 'TRIGGERED' : 'STRIKE'}
                    </span>
                    <span className="text-[9px] opacity-70 font-bold">KEY [{index + 1}]</span>

                    {/* VU Level glow */}
                    {pad.vuLevel > 0 && (
                      <div
                        className="absolute bottom-0 left-0 right-0 h-1 bg-white/60 transition-all"
                        style={{ opacity: pad.vuLevel }}
                      />
                    )}
                  </motion.button>

                  {/* Mode & Pitch Controls */}
                  <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800/80 text-[10px] font-mono">
                    {/* Play Mode selector */}
                    <div>
                      <span className="text-slate-400 text-[9px] block mb-0.5">MODE:</span>
                      <select
                        value={pad.playMode}
                        onChange={(e) => onSetPadPlayMode(index, e.target.value as SamplerPlayMode)}
                        className="w-full bg-slate-800 text-slate-200 text-[10px] rounded px-1 py-0.5 border border-slate-700 focus:outline-none"
                      >
                        <option value="oneshot">ONE-SHOT</option>
                        <option value="gate">GATE</option>
                        <option value="loop">LOOP</option>
                      </select>
                    </div>

                    {/* Pitch Semitones */}
                    <div>
                      <div className="flex items-center justify-between text-slate-400 text-[9px] mb-0.5">
                        <span>PITCH:</span>
                        <span className="text-purple-400 font-bold">
                          {pad.pitchSemitones > 0 ? `+${pad.pitchSemitones}` : pad.pitchSemitones}st
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="1"
                        value={pad.pitchSemitones}
                        onChange={(e) => onSetPadPitch(index, parseInt(e.target.value, 10))}
                        className="w-full accent-purple-400 h-1 bg-slate-800 rounded cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Volume Slider & Tempo Sync toggle */}
                  <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-slate-800/80 text-[10px] font-mono">
                    <div className="flex items-center gap-1.5 flex-1">
                      <Volume2 className="w-3 h-3 text-slate-400" />
                      <input
                        type="range"
                        min="0"
                        max="1.5"
                        step="0.05"
                        value={pad.volume}
                        onChange={(e) => onSetPadVolume(index, parseFloat(e.target.value))}
                        className="w-full accent-purple-400 h-1 bg-slate-800 rounded cursor-pointer"
                      />
                    </div>

                    <button
                      onClick={() => onSetPadTempoSync(index, !pad.tempoSync)}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors ${
                        pad.tempoSync
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      SYNC
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
