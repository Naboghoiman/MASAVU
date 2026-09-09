/**
 * DJ Sync Looper Section
 * Hardware-style 4-channel synchronized loop workstation.
 * Features real-time phase locking with active decks, quantized launch,
 * dynamic loop slicing, slip roll, DJ combo filters, and live deck sampling.
 */

import React, { useRef } from 'react';
import {
  LooperTelemetry,
  LooperQuantize,
  LooperSyncTarget,
  LoopSlotData,
  DeckTelemetry,
  TrackData
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
  Timer
} from 'lucide-react';
import { motion } from 'motion/react';

interface LooperSectionProps {
  telemetry: LooperTelemetry | null;
  telemetryA: DeckTelemetry | null;
  telemetryB: DeckTelemetry | null;
  trackA: TrackData | null;
  trackB: TrackData | null;
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
  onStopAll: () => void;
  onPlayAll: () => void;
  onUploadCustomLoop: (slotIndex: number, file: File) => void;
  onCaptureFromDeck: (slotIndex: number, deckId: 'A' | 'B') => void;
}

export const LooperSection: React.FC<LooperSectionProps> = ({
  telemetry,
  telemetryA,
  telemetryB,
  trackA,
  trackB,
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
  onStopAll,
  onPlayAll,
  onUploadCustomLoop,
  onCaptureFromDeck
}) => {
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  if (!telemetry) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 text-center text-slate-400 font-mono text-xs">
        Loading DJ Sync Looper engine...
      </div>
    );
  }

  const loopLengths = [0.5, 1, 2, 4, 8, 16];

  // Helper to render mini waveform preview with animated playhead
  const renderWaveform = (slot: LoopSlotData) => {
    const points = Array.from(slot.waveform);
    const progress = slot.isPlaying ? (slot.currentBeatIndex + slot.beatPhase) / slot.activeLoopBeats : 0;
    const clampedProgress = Math.max(0, Math.min(1, progress));

    return (
      <div className="relative h-10 w-full bg-slate-950/80 rounded-lg overflow-hidden border border-slate-800/80 flex items-center px-1">
        {/* Bars */}
        <div className="flex items-center justify-between w-full h-full gap-[2px]">
          {points.map((val, idx) => {
            const barProgress = idx / points.length;
            const isPlayed = slot.isPlaying && barProgress <= clampedProgress;
            const height = Math.max(12, Math.round(val * 100));

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

        {/* Playhead Reference Needle */}
        {slot.isPlaying && (
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-white shadow-sm shadow-white pointer-events-none z-10 transition-all duration-75"
            style={{ left: `${clampedProgress * 100}%` }}
          />
        )}

        {/* Beat in loop indicator */}
        <div className="absolute top-1 right-2 pointer-events-none text-[10px] font-mono font-bold text-slate-300 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-700">
          {slot.isPlaying ? `BEAT ${slot.beatInLoop} / ${slot.activeLoopBeats}` : `${slot.activeLoopBeats} BEATS`}
        </div>
      </div>
    );
  };

  return (
    <div
      id="dj-sync-looper-console"
      className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 backdrop-blur-sm"
    >
      {/* Top Header & Sync Control Panel */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-wider text-slate-100 uppercase font-mono">
                PRO SYNC LOOPER
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-amber-400" />
                <span>PERFECT DECK SYNC</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Hardware-quantized beat & bar lock • 128 BPM Drum Break, Bass & Live Deck Sampling
            </p>
          </div>
        </div>

        {/* Master Clock & Sync Target Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Active Target BPM Display */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <div className="font-mono text-xs">
              <span className="text-slate-400 mr-1">SYNC TEMPO:</span>
              <span className="text-amber-400 font-bold text-sm">
                {telemetry.activeTargetBpm.toFixed(1)}
              </span>
              <span className="text-slate-500 text-[10px] ml-1">BPM</span>
            </div>

            {/* 4-Beat Live Master LED Pulse */}
            <div className="flex items-center gap-1 ml-2 border-l border-slate-800 pl-2">
              {[1, 2, 3, 4].map((b) => {
                const isActive = telemetry.masterBeatInBar === b;
                const isDownbeat = b === 1;
                return (
                  <div
                    key={b}
                    className={`w-2.5 h-4 rounded-sm flex items-center justify-center text-[8px] font-mono font-bold transition-all ${
                      isActive
                        ? isDownbeat
                          ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/50 scale-110'
                          : 'bg-emerald-400 text-slate-950 shadow-sm shadow-emerald-400/30'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {b}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sync Target Selector */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            {(['AUTO', 'DECK_A', 'DECK_B'] as LooperSyncTarget[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onSetSyncTarget(mode)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  telemetry.syncTarget === mode
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode === 'AUTO' ? 'AUTO MASTER' : mode === 'DECK_A' ? 'DECK A' : 'DECK B'}
              </button>
            ))}
          </div>

          {/* Quantize Mode Selector */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <span className="text-slate-500 text-[10px] px-2 flex items-center gap-1">
              <Timer className="w-3 h-3" />
              <span>Q:</span>
            </span>
            {(['1_BAR', '1_BEAT', 'HALF_BEAT', 'INSTANT'] as LooperQuantize[]).map((q) => (
              <button
                key={q}
                onClick={() => onSetQuantize(q)}
                className={`px-2 py-1 rounded-lg transition-all ${
                  telemetry.quantize === q
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {q === '1_BAR' ? '1 BAR' : q === '1_BEAT' ? '1 BEAT' : q === 'HALF_BEAT' ? '1/2' : 'OFF'}
              </button>
            ))}
          </div>

          {/* Master Transport Action Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onPlayAll}
              className="px-2.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-mono font-bold flex items-center gap-1 transition-all active:scale-95"
              title="Quantized start all loops"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>ALL</span>
            </button>
            <button
              onClick={onStopAll}
              className="px-2.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-mono font-bold flex items-center gap-1 transition-all active:scale-95"
              title="Stop all loop slots"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>STOP</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Multi-Slot Synchronized Channel Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {telemetry.slots.map((slot, index) => {
          const isUploadedGroove = index === 0;

          // Theme colors per category
          const categoryColors = {
            drum: {
              border: 'border-amber-500/40',
              accent: 'amber',
              badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
              buttonActive: 'bg-amber-500 text-slate-950 shadow-amber-500/30',
              glow: 'shadow-amber-500/10'
            },
            percussion: {
              border: 'border-emerald-500/40',
              accent: 'emerald',
              badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
              buttonActive: 'bg-emerald-500 text-slate-950 shadow-emerald-500/30',
              glow: 'shadow-emerald-500/10'
            },
            bass: {
              border: 'border-cyan-500/40',
              accent: 'cyan',
              badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
              buttonActive: 'bg-cyan-500 text-slate-950 shadow-cyan-500/30',
              glow: 'shadow-cyan-500/10'
            },
            synth: {
              border: 'border-purple-500/40',
              accent: 'purple',
              badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
              buttonActive: 'bg-purple-500 text-slate-950 shadow-purple-500/30',
              glow: 'shadow-purple-500/10'
            },
            vocal: {
              border: 'border-rose-500/40',
              accent: 'rose',
              badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
              buttonActive: 'bg-rose-500 text-slate-950 shadow-rose-500/30',
              glow: 'shadow-rose-500/10'
            },
            custom: {
              border: 'border-indigo-500/40',
              accent: 'indigo',
              badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
              buttonActive: 'bg-indigo-500 text-slate-950 shadow-indigo-500/30',
              glow: 'shadow-indigo-500/10'
            }
          };

          const theme = categoryColors[slot.category] || categoryColors.custom;

          return (
            <div
              key={slot.id}
              className={`bg-slate-950/70 border ${
                slot.isPlaying ? theme.border : 'border-slate-800'
              } rounded-xl p-3.5 flex flex-col justify-between space-y-3 transition-all relative overflow-hidden group shadow-lg ${
                slot.isPlaying ? theme.glow : ''
              }`}
            >
              {/* Slot Header Bar */}
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-mono text-[10px] font-bold">
                      SLOT {index + 1}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${theme.badge}`}
                    >
                      {isUploadedGroove ? 'UPLOADED AUDIO' : slot.category}
                    </span>
                  </div>

                  {/* Native BPM tag */}
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                    ORIG {slot.bpm} BPM
                  </span>
                </div>

                <h3 className="font-mono font-bold text-sm text-slate-100 truncate" title={slot.name}>
                  {slot.name}
                </h3>
              </div>

              {/* Waveform & Playhead progress display */}
              {renderWaveform(slot)}

              {/* Big Quantized Trigger Button & Playback Status */}
              <div className="flex items-center gap-2">
                <button
                  id={`slot-${index}-play-btn`}
                  onClick={() => onTogglePlaySlot(slot.id)}
                  className={`flex-1 py-2.5 px-3 rounded-xl font-mono font-black text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md ${
                    slot.isPendingQuantize
                      ? 'bg-amber-500/40 text-amber-200 border border-amber-400 animate-pulse'
                      : slot.isPlaying
                      ? `${theme.buttonActive} border border-white/20`
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  {slot.isPendingQuantize ? (
                    <>
                      <Timer className="w-4 h-4 animate-spin" />
                      <span>QUANTIZING...</span>
                    </>
                  ) : slot.isPlaying ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>STOP LOOP</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>SYNC PLAY</span>
                    </>
                  )}
                </button>

                {/* Mute & Solo Toggles */}
                <button
                  onClick={() => onToggleSlotMute(slot.id)}
                  className={`p-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                    slot.isMuted
                      ? 'bg-rose-500 text-slate-950 border-rose-400 font-black'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
                  }`}
                  title="Mute slot"
                >
                  {slot.isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => onToggleSlotSolo(slot.id)}
                  className={`px-2.5 py-2 rounded-xl text-xs font-mono font-black border transition-all ${
                    slot.isSoloed
                      ? 'bg-amber-400 text-slate-950 border-amber-300'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
                  }`}
                  title="Solo slot"
                >
                  SOLO
                </button>
              </div>

              {/* Loop Length Selector & Halve/Double controls */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>LOOP LENGTH:</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onHalveLoop(slot.id)}
                      className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 active:scale-95"
                      title="Halve loop length (/2)"
                    >
                      /2
                    </button>
                    <button
                      onClick={() => onDoubleLoop(slot.id)}
                      className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 active:scale-95"
                      title="Double loop length (x2)"
                    >
                      x2
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-6 gap-1">
                  {loopLengths.map((beats) => {
                    const isSelected = slot.activeLoopBeats === beats;
                    return (
                      <button
                        key={beats}
                        onClick={() => onSetLoopBeats(slot.id, beats)}
                        className={`py-1 text-[10px] font-mono font-bold rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-slate-200 text-slate-950 border-white shadow-sm'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800/80'
                        }`}
                      >
                        {beats < 1 ? `1/${Math.round(1 / beats)}` : `${beats}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Slip Roll / Stutter Momentary Pads */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span>SLIP ROLL:</span>
                  </span>
                  {slot.isRollActive && (
                    <span className="text-amber-400 font-bold animate-pulse text-[9px]">ROLL ACTIVE</span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-1">
                  {[0.25, 0.5, 1].map((rBeats) => (
                    <button
                      key={rBeats}
                      onMouseDown={() => onTriggerRoll(slot.id, rBeats)}
                      onMouseUp={() => onReleaseRoll(slot.id)}
                      onMouseLeave={() => {
                        if (slot.isRollActive) onReleaseRoll(slot.id);
                      }}
                      onTouchStart={() => onTriggerRoll(slot.id, rBeats)}
                      onTouchEnd={() => onReleaseRoll(slot.id)}
                      className={`py-1 text-[10px] font-mono font-bold rounded-lg border select-none transition-all active:scale-95 ${
                        slot.isRollActive && slot.rollBeats === rBeats
                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md shadow-amber-400/40'
                          : 'bg-slate-900 hover:bg-slate-800 text-amber-300/80 border-slate-800'
                      }`}
                    >
                      {rBeats === 0.25 ? '1/4 BEAT' : rBeats === 0.5 ? '1/2 BEAT' : '1 BEAT'}
                    </button>
                  ))}
                </div>
              </div>

              {/* DJ Color Filter & Volume Controls */}
              <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
                {/* Filter Knob / Slider */}
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                    <span className="text-slate-400">FILTER (LPF ↔ HPF):</span>
                    <span
                      className={`font-bold ${
                        slot.filter < -0.05
                          ? 'text-blue-400'
                          : slot.filter > 0.05
                          ? 'text-orange-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {slot.filter < -0.05
                        ? `LPF ${Math.round(Math.abs(slot.filter) * 100)}%`
                        : slot.filter > 0.05
                        ? `HPF ${Math.round(slot.filter * 100)}%`
                        : 'FLAT'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.02"
                    value={slot.filter}
                    onChange={(e) => onSetSlotFilter(slot.id, parseFloat(e.target.value))}
                    onDoubleClick={() => onSetSlotFilter(slot.id, 0)}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    title="Double-click to reset filter to center (flat)"
                  />
                </div>

                {/* Channel Volume Fader & VU Meter */}
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                    <span className="text-slate-400">SLOT LEVEL:</span>
                    <span className="text-slate-300 font-bold">{Math.round(slot.volume * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="1.2"
                      step="0.01"
                      value={slot.volume}
                      onChange={(e) => onSetSlotVolume(slot.id, parseFloat(e.target.value))}
                      className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                    />
                    {/* Tiny VU meter bar */}
                    <div className="w-12 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 transition-all duration-75"
                        style={{ width: `${Math.min(100, slot.vuLevel * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sample Capture & Custom File Loading Controls */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1 text-[10px] font-mono">
                {/* Capture from Deck A */}
                <button
                  onClick={() => onCaptureFromDeck(index, 'A')}
                  disabled={!trackA}
                  className="flex-1 py-1 px-1.5 bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-30 text-blue-300 border border-blue-500/30 rounded text-center transition-all truncate"
                  title="Capture 4-bar loop from Deck A"
                >
                  SAMP DECK A
                </button>

                {/* Capture from Deck B */}
                <button
                  onClick={() => onCaptureFromDeck(index, 'B')}
                  disabled={!trackB}
                  className="flex-1 py-1 px-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-30 text-emerald-300 border border-emerald-500/30 rounded text-center transition-all truncate"
                  title="Capture 4-bar loop from Deck B"
                >
                  SAMP DECK B
                </button>

                {/* Upload Audio File */}
                <input
                  type="file"
                  accept="audio/*"
                  ref={(el) => (fileInputRefs.current[index] = el)}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onUploadCustomLoop(index, file);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  onClick={() => fileInputRefs.current[index]?.click()}
                  className="py-1 px-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded flex items-center gap-1 transition-all"
                  title="Load custom loop audio file"
                >
                  <Upload className="w-3 h-3" />
                  <span>LOAD</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
