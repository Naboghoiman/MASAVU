/**
 * Deck Controls Component (For Deck A or Deck B)
 * Features Play/Pause, CUE, SYNC (Master/Slave), Pitch Fader,
 * Hot Cues (1-8), Beat Loop Roll, and Beat Jump.
 */

import React, { useState } from 'react';
import { DeckTelemetry, HotCue, LoopState, TrackData } from '../types/dj';
import { Play, Pause, Disc, Lock, Unlock, FastForward, Rewind, Music2 } from 'lucide-react';

interface DeckControlsProps {
  telemetry: DeckTelemetry;
  track: TrackData | null;
  hotCues: HotCue[];
  loop: LoopState;
  accent: 'blue' | 'emerald';
  onPlay: () => void;
  onPause: () => void;
  onCueDown: () => void;
  onCueUp: () => void;
  onSyncToggle: () => void;
  onMasterToggle: () => void;
  onPitchChange: (val: number) => void;
  onKeyLockToggle: () => void;
  onTriggerHotCue: (id: number) => void;
  onClearHotCue: (id: number) => void;
  onSetLoop: (beats: number) => void;
  onToggleLoop: () => void;
  onBeatJump: (beats: number) => void;
  onOpenLibrary: () => void;
}

export const DeckControls: React.FC<DeckControlsProps> = ({
  telemetry,
  track,
  hotCues,
  loop,
  accent,
  onPlay,
  onPause,
  onCueDown,
  onCueUp,
  onSyncToggle,
  onMasterToggle,
  onPitchChange,
  onKeyLockToggle,
  onTriggerHotCue,
  onClearHotCue,
  onSetLoop,
  onToggleLoop,
  onBeatJump,
  onOpenLibrary
}) => {
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedLoopBeats, setSelectedLoopBeats] = useState(4);

  const isDeckA = telemetry.deckId === 'A';
  const themeAccentBorder = isDeckA ? 'border-blue-500/40' : 'border-emerald-500/40';
  const themeBgGlow = isDeckA ? 'bg-blue-950/20' : 'bg-emerald-950/20';
  const themeTextColor = isDeckA ? 'text-blue-400' : 'text-emerald-400';

  // Format time remaining / elapsed
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const totalDuration = track ? track.durationSeconds : 0;
  const currentElapsed = telemetry.currentTimeSeconds;
  const remaining = Math.max(0, totalDuration - currentElapsed);

  return (
    <div className={`bg-slate-900/95 border ${themeAccentBorder} rounded-xl p-4 shadow-xl flex flex-col gap-3.5 ${themeBgGlow}`}>
      {/* Deck Header: Track info and Quick Load */}
      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-black font-mono tracking-wider ${themeTextColor}`}>
              DECK {telemetry.deckId}
            </span>
            {telemetry.isMaster && (
              <span className="bg-amber-500 text-slate-950 font-black px-1.5 py-0.2 rounded text-[10px] uppercase tracking-wide">
                MASTER
              </span>
            )}
            {telemetry.isSyncEnabled && (
              <span className="bg-sky-500 text-slate-950 font-black px-1.5 py-0.2 rounded text-[10px] uppercase tracking-wide animate-pulse">
                SYNC ON
              </span>
            )}
            {telemetry.isStraightened && (
              <span
                className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-bold px-1.5 py-0.2 rounded text-[9px] uppercase tracking-wider"
                title={`Straight-BPM PCM Active (${telemetry.warpStatus?.kickTransientsProtected || 0} kicks & ${telemetry.warpStatus?.snareTransientsProtected || 0} snares protected)`}
              >
                WARP LOCKED
              </span>
            )}
          </div>

          <h3 className="text-sm font-bold text-white truncate mt-0.5" title={track ? track.title : 'No Track'}>
            {track ? track.title : 'SELECT TRACK...'}
          </h3>
          <p className="text-xs text-slate-400 truncate">
            {track ? `${track.artist} • ${track.genre} • ${track.key}` : 'Load a track to start mixing'}
          </p>
        </div>

        <button
          id={`deck-${telemetry.deckId}-load-btn`}
          onClick={onOpenLibrary}
          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
        >
          <Music2 className="w-3.5 h-3.5 text-amber-400" />
          <span>LOAD</span>
        </button>
      </div>

      {/* BPM & Monotonic Time Display */}
      <div className="grid grid-cols-3 gap-2 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 text-center font-mono">
        <div>
          <div className="text-[10px] text-slate-500">BPM / PITCH</div>
          <div className="text-base font-black text-white">
            {telemetry.effectiveBpm.toFixed(1)}
          </div>
          <div className="text-[10px] text-slate-400">
            {telemetry.pitchPercentage >= 0 ? `+${(telemetry.pitchPercentage * 16).toFixed(2)}%` : `${(telemetry.pitchPercentage * 16).toFixed(2)}%`}
          </div>
        </div>

        <div>
          <div className="text-[10px] text-slate-500">BEAT / BAR</div>
          <div className="text-base font-black text-amber-400">
            {telemetry.barIndex}.{telemetry.beatInBar}
          </div>
          <div className="text-[10px] text-slate-400">
            PHASE: {(telemetry.beatPhase * 100).toFixed(0)}%
          </div>
        </div>

        <div>
          <div className="text-[10px] text-slate-500">REMAINING</div>
          <div className="text-base font-black text-slate-300">
            -{formatTime(remaining)}
          </div>
          <div className="text-[10px] text-slate-500">
            +{formatTime(currentElapsed)}
          </div>
        </div>
      </div>

      {/* Primary Transport Controls: CUE, PLAY, SYNC, MASTER */}
      <div className="grid grid-cols-4 gap-2">
        {/* CUE Button */}
        <button
          id={`deck-${telemetry.deckId}-cue-btn`}
          onMouseDown={onCueDown}
          onMouseUp={onCueUp}
          onTouchStart={onCueDown}
          onTouchEnd={onCueUp}
          className="h-13 bg-amber-500/15 hover:bg-amber-500/25 active:bg-amber-500 text-amber-400 active:text-slate-950 border-2 border-amber-500/80 rounded-lg font-black text-sm flex flex-col items-center justify-center transition-all shadow-md active:scale-95"
        >
          <span>CUE</span>
          <span className="text-[9px] font-mono opacity-75">RETURN</span>
        </button>

        {/* PLAY / PAUSE Button */}
        <button
          id={`deck-${telemetry.deckId}-play-btn`}
          onClick={telemetry.isPlaying ? onPause : onPlay}
          className={`h-13 border-2 rounded-lg font-black text-sm flex flex-col items-center justify-center transition-all shadow-md active:scale-95 ${
            telemetry.isPlaying
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-emerald-500/20'
              : 'bg-slate-800 text-emerald-400 border-emerald-500/70 hover:bg-emerald-500/15'
          }`}
        >
          {telemetry.isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          <span className="text-[9px] font-mono">{telemetry.isPlaying ? 'PAUSE' : 'PLAY'}</span>
        </button>

        {/* SYNC Button */}
        <button
          id={`deck-${telemetry.deckId}-sync-btn`}
          onClick={onSyncToggle}
          title="Beat-Perfect Slave Start & Phase Lock"
          className={`h-13 border-2 rounded-lg font-black text-sm flex flex-col items-center justify-center transition-all shadow-md active:scale-95 ${
            telemetry.isSyncEnabled
              ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-sky-500/30'
              : 'bg-slate-800 text-sky-400 border-sky-500/60 hover:bg-sky-500/15'
          }`}
        >
          <span>SYNC</span>
          <span className="text-[9px] font-mono">{telemetry.isSyncEnabled ? 'LOCKED' : 'SLAVE'}</span>
        </button>

        {/* MASTER Button */}
        <button
          id={`deck-${telemetry.deckId}-master-btn`}
          onClick={onMasterToggle}
          className={`h-13 border-2 rounded-lg font-black text-sm flex flex-col items-center justify-center transition-all shadow-md active:scale-95 ${
            telemetry.isMaster
              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-amber-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-amber-300'
          }`}
        >
          <span>MASTER</span>
          <span className="text-[9px] font-mono">{telemetry.isMaster ? 'LEAD' : 'ASSIGN'}</span>
        </button>
      </div>

      {/* Pitch Slider & Key Lock */}
      <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            id={`deck-${telemetry.deckId}-keylock-btn`}
            onClick={onKeyLockToggle}
            className={`p-1.5 rounded border text-xs font-mono font-bold flex items-center gap-1 transition-colors ${
              telemetry.keyLock
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/60'
                : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300'
            }`}
          >
            {telemetry.keyLock ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span>KEY LOCK</span>
          </button>
          <button
            id={`deck-${telemetry.deckId}-pitch-reset`}
            onClick={() => onPitchChange(0)}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono rounded border border-slate-700"
          >
            RESET 0%
          </button>
        </div>

        <div className="flex-1 flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-500">-16%</span>
          <input
            id={`deck-${telemetry.deckId}-pitch-slider`}
            type="range"
            min="-1"
            max="1"
            step="0.001"
            value={telemetry.pitchPercentage}
            onChange={(e) => onPitchChange(parseFloat(e.target.value))}
            className="w-full accent-amber-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
          />
          <span className="text-[10px] font-mono text-slate-500">+16%</span>
        </div>
      </div>

      {/* Hot Cues 1-8 Section */}
      <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">Hot Cues</span>
          <button
            id={`deck-${telemetry.deckId}-cue-delete-mode`}
            onClick={() => setDeleteMode(!deleteMode)}
            className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-mono font-bold transition-colors ${
              deleteMode ? 'bg-rose-600 text-white' : 'text-slate-500 hover:text-rose-400'
            }`}
          >
            {deleteMode ? 'DELETE MODE ON' : 'CLEAR CUE'}
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {hotCues.map((cue) => (
            <button
              key={cue.id}
              id={`deck-${telemetry.deckId}-hotcue-${cue.id}`}
              onClick={() => {
                if (deleteMode) {
                  onClearHotCue(cue.id);
                } else {
                  onTriggerHotCue(cue.id);
                }
              }}
              style={{
                borderColor: cue.isActive ? cue.color : 'rgba(51, 65, 85, 0.6)',
                backgroundColor: cue.isActive ? `${cue.color}25` : 'rgba(30, 41, 59, 0.4)'
              }}
              className="h-9 rounded border font-mono font-bold text-xs flex items-center justify-center transition-all active:scale-95 shadow-sm"
            >
              <span style={{ color: cue.isActive ? cue.color : '#94A3B8' }}>{cue.id}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Beat Loop & Beat Jump Section */}
      <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 flex flex-col gap-2">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">Beat Loop</span>
          <button
            id={`deck-${telemetry.deckId}-loop-toggle`}
            onClick={onToggleLoop}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors ${
              loop.isActive
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm animate-pulse'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {loop.isActive ? 'LOOP ACTIVE' : 'LOOP OFF'}
          </button>
        </div>

        {/* Loop Divisions */}
        <div className="grid grid-cols-6 gap-1">
          {[0.5, 1, 2, 4, 8, 16].map((beats) => (
            <button
              key={beats}
              id={`deck-${telemetry.deckId}-loop-btn-${beats}`}
              onClick={() => {
                setSelectedLoopBeats(beats);
                onSetLoop(beats);
              }}
              className={`py-1 text-[10px] font-mono font-bold rounded border transition-colors ${
                loop.isActive && loop.lengthBeats === beats
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : selectedLoopBeats === beats
                  ? 'bg-slate-700 text-amber-300 border-amber-500/50'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {beats < 1 ? `1/${1 / beats}` : `${beats}`}
            </button>
          ))}
        </div>

        {/* Beat Jump Row */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px] font-mono text-slate-400">
          <span>JUMP:</span>
          <div className="flex items-center gap-1">
            <button
              id={`deck-${telemetry.deckId}-jump-back-4`}
              onClick={() => onBeatJump(-4)}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
            >
              &lt;&lt; 4
            </button>
            <button
              id={`deck-${telemetry.deckId}-jump-back-1`}
              onClick={() => onBeatJump(-1)}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
            >
              &lt; 1
            </button>
            <button
              id={`deck-${telemetry.deckId}-jump-fwd-1`}
              onClick={() => onBeatJump(1)}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
            >
              1 &gt;
            </button>
            <button
              id={`deck-${telemetry.deckId}-jump-fwd-4`}
              onClick={() => onBeatJump(4)}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
            >
              4 &gt;&gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
