/**
 * DJ Hardware Controller Surface Component
 * Exactly matches the hardware controller in the user's reference image:
 * - Matte dark metal faceplate with tactile controls
 * - Rotary knobs with graduation labels (-26/+6, -∞/+6, LPF/HPF)
 * - Glowing blue SYNC buttons
 * - Dual Master LED VU meters
 * - Central Master Output Filter
 * - FX Select (Echo, Delay, Flanger) & Beat FX section
 * - 8 RGB illuminated performance pads with mode tabs (Hot Cue, Looper, Slicer, Sampler)
 * - Channel volume faders, DJ IMAN center matrix, and Crossfader
 * - Iconic large circular CUE (gold ring) and PLAY/PAUSE (green ring) buttons!
 */

import React, { useState } from 'react';
import { DjHardwareKnob } from './DjHardwareKnob';
import { DeckTelemetry } from '../types/dj';
import { Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';

interface DjHardwareControllerProps {
  telemetryA: DeckTelemetry | null;
  telemetryB: DeckTelemetry | null;
  // Transport & Sync
  onPlayA: () => void;
  onPauseA: () => void;
  onCueDownA: () => void;
  onCueUpA: () => void;
  onSyncA: () => void;
  onPlayB: () => void;
  onPauseB: () => void;
  onCueDownB: () => void;
  onCueUpB: () => void;
  onSyncB: () => void;
  // Mixer & EQs
  lowEqA: number;
  midEqA: number;
  highEqA: number;
  filterA: number;
  volumeA: number;
  onSetLowEqA: (v: number) => void;
  onSetMidEqA: (v: number) => void;
  onSetHighEqA: (v: number) => void;
  onSetFilterA: (v: number) => void;
  onSetVolumeA: (v: number) => void;
  lowEqB: number;
  midEqB: number;
  highEqB: number;
  filterB: number;
  volumeB: number;
  onSetLowEqB: (v: number) => void;
  onSetMidEqB: (v: number) => void;
  onSetHighEqB: (v: number) => void;
  onSetFilterB: (v: number) => void;
  onSetVolumeB: (v: number) => void;
  // Master & Crossfader
  masterVolume: number;
  onSetMasterVolume: (v: number) => void;
  crossfaderPos: number;
  onSetCrossfaderPos: (v: number) => void;
  // Actions
  onOpenLibrary: (deckId: 'A' | 'B') => void;
  onTriggerHotCueA: (id: number) => void;
  onTriggerHotCueB: (id: number) => void;
  onSetLoopA: (beats: number) => void;
  onSetLoopB: (beats: number) => void;
  onPlaySampler: (fx: 'airhorn' | 'siren' | 'laser' | 'drop' | 'kick' | 'snare' | 'hihat' | 'vocal') => void;
}

export const DjHardwareController: React.FC<DjHardwareControllerProps> = ({
  telemetryA,
  telemetryB,
  onPlayA,
  onPauseA,
  onCueDownA,
  onCueUpA,
  onSyncA,
  onPlayB,
  onPauseB,
  onCueDownB,
  onCueUpB,
  onSyncB,
  lowEqA,
  midEqA,
  highEqA,
  filterA,
  volumeA,
  onSetLowEqA,
  onSetMidEqA,
  onSetHighEqA,
  onSetFilterA,
  onSetVolumeA,
  lowEqB,
  midEqB,
  highEqB,
  filterB,
  volumeB,
  onSetLowEqB,
  onSetMidEqB,
  onSetHighEqB,
  onSetFilterB,
  onSetVolumeB,
  masterVolume,
  onSetMasterVolume,
  crossfaderPos,
  onSetCrossfaderPos,
  onOpenLibrary,
  onTriggerHotCueA,
  onTriggerHotCueB,
  onSetLoopA,
  onSetLoopB,
  onPlaySampler
}) => {
  // Pad mode state
  const [padModeA, setPadModeA] = useState<'hotcue' | 'looper' | 'slicer' | 'sampler'>('hotcue');
  const [padModeB, setPadModeB] = useState<'hotcue' | 'looper' | 'slicer' | 'sampler'>('hotcue');

  // FX states
  const [activeFxA, setActiveFxA] = useState<'echo' | 'delay' | 'flanger'>('echo');
  const [activeFxB, setActiveFxB] = useState<'echo' | 'delay' | 'flanger'>('echo');
  const [isFxAOn, setIsFxAOn] = useState(false);
  const [isFxBOn, setIsFxBOn] = useState(false);
  const [beatFxVal, setBeatFxVal] = useState(0);

  // Filter & Trim local states
  const [masterFilter, setMasterFilter] = useState(0);
  const [samplerVolume, setSamplerVolume] = useState(0.8);
  const [cueMix, setCueMix] = useState(0);

  // Deck A Pad colors matching screenshot (Row 1: Red, Orange, Cyan, Yellow; Row 2: Cyan, Blue, Purple, Cyan)
  const padColorsA = [
    'bg-[#FF334B] shadow-[0_0_12px_#FF334B]',
    'bg-[#FF7A29] shadow-[0_0_12px_#FF7A29]',
    'bg-[#00E5FF] shadow-[0_0_12px_#00E5FF]',
    'bg-[#FFD600] shadow-[0_0_12px_#FFD600]',
    'bg-[#00E5FF] shadow-[0_0_12px_#00E5FF]',
    'bg-[#2979FF] shadow-[0_0_12px_#2979FF]',
    'bg-[#D500F9] shadow-[0_0_12px_#D500F9]',
    'bg-[#00E5FF] shadow-[0_0_12px_#00E5FF]'
  ];

  // Deck B Pad colors matching screenshot (Row 1: Red, Orange, Cyan, Yellow; Row 2: Green, Pink, Cyan, Purple)
  const padColorsB = [
    'bg-[#FF334B] shadow-[0_0_12px_#FF334B]',
    'bg-[#FF7A29] shadow-[0_0_12px_#FF7A29]',
    'bg-[#00E5FF] shadow-[0_0_12px_#00E5FF]',
    'bg-[#FFD600] shadow-[0_0_12px_#FFD600]',
    'bg-[#00E676] shadow-[0_0_12px_#00E676]',
    'bg-[#FF80AB] shadow-[0_0_12px_#FF80AB]',
    'bg-[#00E5FF] shadow-[0_0_12px_#00E5FF]',
    'bg-[#D500F9] shadow-[0_0_12px_#D500F9]'
  ];

  const handlePadClickA = (index: number) => {
    if (padModeA === 'hotcue') {
      onTriggerHotCueA(index + 1);
    } else if (padModeA === 'looper') {
      const loopDivisions = [0.25, 0.5, 1, 2, 4, 8, 16, 32];
      onSetLoopA(loopDivisions[index] || 4);
    } else if (padModeA === 'sampler') {
      const samples: ('airhorn' | 'siren' | 'laser' | 'drop' | 'kick' | 'snare' | 'hihat' | 'vocal')[] = [
        'airhorn', 'siren', 'laser', 'drop', 'kick', 'snare', 'hihat', 'vocal'
      ];
      onPlaySampler(samples[index] || 'airhorn');
    }
  };

  const handlePadClickB = (index: number) => {
    if (padModeB === 'hotcue') {
      onTriggerHotCueB(index + 1);
    } else if (padModeB === 'looper') {
      const loopDivisions = [0.25, 0.5, 1, 2, 4, 8, 16, 32];
      onSetLoopB(loopDivisions[index] || 4);
    } else if (padModeB === 'sampler') {
      const samples: ('airhorn' | 'siren' | 'laser' | 'drop' | 'kick' | 'snare' | 'hihat' | 'vocal')[] = [
        'airhorn', 'siren', 'laser', 'drop', 'kick', 'snare', 'hihat', 'vocal'
      ];
      onPlaySampler(samples[index] || 'airhorn');
    }
  };

  return (
    <div className="w-full bg-[#0E1015] border-t-2 border-[#202532] shadow-2xl p-3 sm:p-5 select-none rounded-b-xl flex flex-col gap-4">
      {/* ========================================================================= */}
      {/* TOP CONTROLLER SECTION: Decks A & B Channels + Center Master/Filter Strip */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-12 gap-2 sm:gap-4 items-start">
        {/* ------------------------------------------------------------- */}
        {/* DECK A CHANNEL STRIP (Left 5 Cols)                           */}
        {/* ------------------------------------------------------------- */}
        <div className="col-span-5 grid grid-cols-2 gap-3 bg-[#0B0D12] p-3 rounded-lg border border-[#1C202C]">
          {/* Deck A Left: BROWSE, LOAD, BACK, VIEW, IN/OUT */}
          <div className="flex flex-col items-center justify-between gap-3">
            {/* BROWSE Rotary Encoder */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">
                BROWSE
              </span>
              <div
                onClick={() => onOpenLibrary('A')}
                title="Browse & Load Tracks"
                className="w-10 h-10 rounded-full bg-gradient-to-b from-[#2E3341] to-[#12141A] border-2 border-[#424A5E] p-1 flex items-center justify-center cursor-pointer shadow-md hover:border-amber-400 active:scale-95 transition-all"
              >
                <div className="w-full h-full rounded-full bg-[#181B23] flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-slate-500"></div>
                </div>
              </div>
            </div>

            {/* LOAD Button */}
            <button
              id="deck-a-hw-load-btn"
              onClick={() => onOpenLibrary('A')}
              className="w-full py-1 bg-[#1A1D26] hover:bg-[#252A38] border border-[#2D3344] rounded text-[10px] font-mono font-bold text-slate-200 tracking-wider transition-colors"
            >
              LOAD
            </button>

            {/* BACK / VIEW Buttons */}
            <div className="grid grid-cols-2 gap-1.5 w-full">
              <button
                onClick={() => onOpenLibrary('A')}
                className="py-1 bg-[#141720] hover:bg-[#1C212E] border border-[#262B3A] rounded text-[9px] font-mono font-bold text-slate-400 transition-colors"
              >
                BACK
              </button>
              <button
                onClick={() => onOpenLibrary('A')}
                className="py-1 bg-[#141720] hover:bg-[#1C212E] border border-[#262B3A] rounded text-[9px] font-mono font-bold text-slate-400 transition-colors"
              >
                VIEW
              </button>
            </div>

            {/* FILTER Knob */}
            <div className="my-1">
              <DjHardwareKnob
                label="FILTER"
                value={filterA}
                min={-1}
                max={1}
                onChange={onSetFilterA}
                leftSubLabel="LPF"
                rightSubLabel="HPF"
                size="md"
              />
            </div>

            {/* LOOP IN / OUT Buttons (Yellow outline) */}
            <div className="grid grid-cols-2 gap-2 w-full mt-1">
              <button
                onClick={() => onSetLoopA(4)}
                className="py-1 bg-[#101217] hover:bg-yellow-500/10 border border-yellow-500/70 rounded text-[10px] font-mono font-black text-yellow-400 tracking-wider shadow-[0_0_6px_rgba(234,179,8,0.2)] active:scale-95 transition-all"
              >
                IN
              </button>
              <button
                onClick={() => onSetLoopA(8)}
                className="py-1 bg-[#101217] hover:bg-yellow-500/10 border border-yellow-500/70 rounded text-[10px] font-mono font-black text-yellow-400 tracking-wider shadow-[0_0_6px_rgba(234,179,8,0.2)] active:scale-95 transition-all"
              >
                OUT
              </button>
            </div>
          </div>

          {/* Deck A Right: SYNC Button, HI, TRIM, MID, LOW */}
          <div className="flex flex-col items-center justify-between gap-2.5">
            {/* Glowing Blue SYNC Button */}
            <button
              id="deck-a-hw-sync-btn"
              onClick={onSyncA}
              className={`w-full py-1.5 rounded-lg text-xs font-black font-mono tracking-widest uppercase transition-all active:scale-95 ${
                telemetryA?.isSyncEnabled
                  ? 'bg-sky-500 text-black border-2 border-sky-300 shadow-[0_0_16px_rgba(56,189,248,0.9)] animate-pulse'
                  : 'bg-[#0E1B2E] text-sky-400 border-2 border-sky-500 hover:bg-sky-950/80 shadow-[0_0_10px_rgba(14,165,233,0.4)]'
              }`}
            >
              SYNC
            </button>

            {/* HI Knob */}
            <DjHardwareKnob
              label="HI"
              value={highEqA}
              min={-1}
              max={1}
              onChange={onSetHighEqA}
              leftSubLabel="-26"
              rightSubLabel="+6"
              size="sm"
            />

            {/* TRIM Knob */}
            <DjHardwareKnob
              label="TRIM"
              value={volumeA}
              min={0}
              max={1}
              onChange={onSetVolumeA}
              leftSubLabel="-∞"
              rightSubLabel="+6"
              size="sm"
            />

            {/* MID Knob */}
            <DjHardwareKnob
              label="MID"
              value={midEqA}
              min={-1}
              max={1}
              onChange={onSetMidEqA}
              leftSubLabel="-26"
              rightSubLabel="+6"
              size="sm"
            />

            {/* LOW Knob */}
            <DjHardwareKnob
              label="LOW"
              value={lowEqA}
              min={-1}
              max={1}
              onChange={onSetLowEqA}
              leftSubLabel="-26"
              rightSubLabel="+6"
              size="sm"
            />
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* CENTER MIXER STRIP: MASTER & MASTER OUTPUT FILTER (2 Cols)   */}
        {/* ------------------------------------------------------------- */}
        <div className="col-span-2 flex flex-col items-center justify-between gap-4 py-2 bg-[#090B0F] p-2 rounded-lg border border-[#171B26]">
          {/* Master Section */}
          <div className="flex flex-col items-center w-full">
            <DjHardwareKnob
              label="MASTER"
              value={masterVolume}
              min={0}
              max={1}
              onChange={onSetMasterVolume}
              leftSubLabel="-26"
              rightSubLabel="+6"
              size="md"
            />

            {/* Dual 8-segment Master Output LED VU Meters */}
            <div className="flex items-center gap-2 mt-2">
              {/* Left Channel */}
              <div className="flex flex-col-reverse gap-0.5 w-1.5 h-10 bg-black/80 p-0.5 rounded">
                {[
                  'bg-emerald-500',
                  'bg-emerald-500',
                  'bg-emerald-500',
                  'bg-emerald-500',
                  'bg-amber-400',
                  'bg-amber-400',
                  'bg-red-500',
                  'bg-red-500'
                ].map((c, i) => (
                  <div
                    key={i}
                    className={`w-full flex-1 rounded-[1px] ${
                      telemetryA?.isPlaying ? c : 'bg-slate-800'
                    }`}
                  />
                ))}
              </div>
              {/* Right Channel */}
              <div className="flex flex-col-reverse gap-0.5 w-1.5 h-10 bg-black/80 p-0.5 rounded">
                {[
                  'bg-emerald-500',
                  'bg-emerald-500',
                  'bg-emerald-500',
                  'bg-emerald-500',
                  'bg-amber-400',
                  'bg-amber-400',
                  'bg-red-500',
                  'bg-red-500'
                ].map((c, i) => (
                  <div
                    key={i}
                    className={`w-full flex-1 rounded-[1px] ${
                      telemetryB?.isPlaying ? c : 'bg-slate-800'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Large Master Output Filter Knob */}
          <div className="flex flex-col items-center text-center">
            <span className="text-[8px] sm:text-[9px] font-extrabold font-mono text-slate-300 uppercase tracking-tight leading-tight">
              MASTER
              <br />
              OUTPUT FILTER
            </span>
            <div className="mt-1">
              <DjHardwareKnob
                label=""
                value={masterFilter}
                min={-1}
                max={1}
                onChange={setMasterFilter}
                leftSubLabel="LPF"
                rightSubLabel="HPF"
                size="lg"
              />
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* DECK B CHANNEL STRIP (Right 5 Cols)                          */}
        {/* ------------------------------------------------------------- */}
        <div className="col-span-5 grid grid-cols-2 gap-3 bg-[#0B0D12] p-3 rounded-lg border border-[#1C202C]">
          {/* Deck B Left: HI, TRIM, MID, LOW */}
          <div className="flex flex-col items-center justify-between gap-2.5">
            {/* Glowing Blue SYNC Button */}
            <button
              id="deck-b-hw-sync-btn"
              onClick={onSyncB}
              className={`w-full py-1.5 rounded-lg text-xs font-black font-mono tracking-widest uppercase transition-all active:scale-95 ${
                telemetryB?.isSyncEnabled
                  ? 'bg-sky-500 text-black border-2 border-sky-300 shadow-[0_0_16px_rgba(56,189,248,0.9)] animate-pulse'
                  : 'bg-[#0E1B2E] text-sky-400 border-2 border-sky-500 hover:bg-sky-950/80 shadow-[0_0_10px_rgba(14,165,233,0.4)]'
              }`}
            >
              SYNC
            </button>

            {/* HI Knob */}
            <DjHardwareKnob
              label="HI"
              value={highEqB}
              min={-1}
              max={1}
              onChange={onSetHighEqB}
              leftSubLabel="-26"
              rightSubLabel="+6"
              size="sm"
            />

            {/* TRIM Knob */}
            <DjHardwareKnob
              label="TRIM"
              value={volumeB}
              min={0}
              max={1}
              onChange={onSetVolumeB}
              leftSubLabel="-∞"
              rightSubLabel="+6"
              size="sm"
            />

            {/* MID Knob */}
            <DjHardwareKnob
              label="MID"
              value={midEqB}
              min={-1}
              max={1}
              onChange={onSetMidEqB}
              leftSubLabel="-26"
              rightSubLabel="+6"
              size="sm"
            />

            {/* LOW Knob */}
            <DjHardwareKnob
              label="LOW"
              value={lowEqB}
              min={-1}
              max={1}
              onChange={onSetLowEqB}
              leftSubLabel="-26"
              rightSubLabel="+6"
              size="sm"
            />
          </div>

          {/* Deck B Right: BROWSE, LOAD, BACK, VIEW, IN/OUT */}
          <div className="flex flex-col items-center justify-between gap-3">
            {/* BROWSE Rotary Encoder */}
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">
                BROWSE
              </span>
              <div
                onClick={() => onOpenLibrary('B')}
                title="Browse & Load Tracks"
                className="w-10 h-10 rounded-full bg-gradient-to-b from-[#2E3341] to-[#12141A] border-2 border-[#424A5E] p-1 flex items-center justify-center cursor-pointer shadow-md hover:border-amber-400 active:scale-95 transition-all"
              >
                <div className="w-full h-full rounded-full bg-[#181B23] flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-slate-500"></div>
                </div>
              </div>
            </div>

            {/* LOAD Button */}
            <button
              id="deck-b-hw-load-btn"
              onClick={() => onOpenLibrary('B')}
              className="w-full py-1 bg-[#1A1D26] hover:bg-[#252A38] border border-[#2D3344] rounded text-[10px] font-mono font-bold text-slate-200 tracking-wider transition-colors"
            >
              LOAD
            </button>

            {/* BACK / VIEW Buttons */}
            <div className="grid grid-cols-2 gap-1.5 w-full">
              <button
                onClick={() => onOpenLibrary('B')}
                className="py-1 bg-[#141720] hover:bg-[#1C212E] border border-[#262B3A] rounded text-[9px] font-mono font-bold text-slate-400 transition-colors"
              >
                BACK
              </button>
              <button
                onClick={() => onOpenLibrary('B')}
                className="py-1 bg-[#141720] hover:bg-[#1C212E] border border-[#262B3A] rounded text-[9px] font-mono font-bold text-slate-400 transition-colors"
              >
                VIEW
              </button>
            </div>

            {/* FILTER Knob */}
            <div className="my-1">
              <DjHardwareKnob
                label="FILTER"
                value={filterB}
                min={-1}
                max={1}
                onChange={onSetFilterB}
                leftSubLabel="LPF"
                rightSubLabel="HPF"
                size="md"
              />
            </div>

            {/* LOOP IN / OUT Buttons (Yellow outline) */}
            <div className="grid grid-cols-2 gap-2 w-full mt-1">
              <button
                onClick={() => onSetLoopB(4)}
                className="py-1 bg-[#101217] hover:bg-yellow-500/10 border border-yellow-500/70 rounded text-[10px] font-mono font-black text-yellow-400 tracking-wider shadow-[0_0_6px_rgba(234,179,8,0.2)] active:scale-95 transition-all"
              >
                IN
              </button>
              <button
                onClick={() => onSetLoopB(8)}
                className="py-1 bg-[#101217] hover:bg-yellow-500/10 border border-yellow-500/70 rounded text-[10px] font-mono font-black text-yellow-400 tracking-wider shadow-[0_0_6px_rgba(234,179,8,0.2)] active:scale-95 transition-all"
              >
                OUT
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MIDDLE SECTION: FX SELECT, PARAMETER & BEAT FX                            */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-12 gap-2 sm:gap-4 items-center bg-[#090B0F] p-2.5 rounded-lg border border-[#181C28]">
        {/* Deck A FX (Col 5) */}
        <div className="col-span-5 flex items-center justify-between gap-2">
          {/* FX Select Buttons */}
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-mono font-bold text-slate-400 uppercase">FX SELECT</span>
            <div className="flex items-center gap-1">
              {(['echo', 'delay', 'flanger'] as const).map((fx) => (
                <button
                  key={fx}
                  onClick={() => setActiveFxA(fx)}
                  className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase transition-all ${
                    activeFxA === fx
                      ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                      : 'bg-[#12151D] text-slate-400 border border-[#242936] hover:text-white'
                  }`}
                >
                  {fx}
                </button>
              ))}
            </div>
          </div>

          {/* PARAMETER < > buttons (Pink outline) */}
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-mono font-bold text-slate-400 uppercase">PARAMETER</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onSetLoopA(2)}
                className="p-1 bg-[#151118] border border-rose-500/70 hover:bg-rose-500/20 text-rose-300 rounded text-xs transition-colors"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                onClick={() => onSetLoopA(4)}
                className="p-1 bg-[#151118] border border-rose-500/70 hover:bg-rose-500/20 text-rose-300 rounded text-xs transition-colors"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* FX A Toggle Button */}
          <div className="flex flex-col items-center">
            <span className="text-[8px] font-mono font-bold text-slate-400 uppercase mb-0.5">FX A</span>
            <button
              onClick={() => setIsFxAOn(!isFxAOn)}
              className={`w-12 h-6 rounded-md border flex items-center justify-center transition-all ${
                isFxAOn
                  ? 'bg-blue-600 border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.8)] text-white'
                  : 'bg-[#151924] border-[#2B3245] text-blue-400'
              }`}
            >
              <div className="w-6 h-1 rounded-full bg-blue-300 shadow-[0_0_6px_#93C5FD]"></div>
            </button>
          </div>
        </div>

        {/* BEAT FX Rotary Knob (Col 2) */}
        <div className="col-span-2 flex flex-col items-center">
          <span className="text-[9px] font-mono font-extrabold text-slate-300 uppercase tracking-wide">
            BEAT FX
          </span>
          <div className="mt-1 flex items-center gap-2">
            <DjHardwareKnob
              label=""
              value={beatFxVal}
              min={0}
              max={1}
              onChange={setBeatFxVal}
              size="sm"
            />
            <div className="text-[7px] font-mono text-slate-400 space-y-0.5 text-left hidden sm:block">
              <div>• ECHO</div>
              <div>• DELAY</div>
              <div>• BEAT</div>
              <div>• FLANGER</div>
            </div>
          </div>
        </div>

        {/* Deck B FX (Col 5) */}
        <div className="col-span-5 flex items-center justify-between gap-2">
          {/* FX B Toggle Button */}
          <div className="flex flex-col items-center">
            <span className="text-[8px] font-mono font-bold text-slate-400 uppercase mb-0.5">FX B</span>
            <button
              onClick={() => setIsFxBOn(!isFxBOn)}
              className={`w-12 h-6 rounded-md border flex items-center justify-center transition-all ${
                isFxBOn
                  ? 'bg-blue-600 border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.8)] text-white'
                  : 'bg-[#151924] border-[#2B3245] text-blue-400'
              }`}
            >
              <div className="w-6 h-1 rounded-full bg-blue-300 shadow-[0_0_6px_#93C5FD]"></div>
            </button>
          </div>

          {/* PARAMETER < > buttons */}
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-mono font-bold text-slate-400 uppercase">PARAMETER</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onSetLoopB(2)}
                className="p-1 bg-[#151118] border border-rose-500/70 hover:bg-rose-500/20 text-rose-300 rounded text-xs transition-colors"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                onClick={() => onSetLoopB(4)}
                className="p-1 bg-[#151118] border border-rose-500/70 hover:bg-rose-500/20 text-rose-300 rounded text-xs transition-colors"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* FX Select Buttons */}
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-mono font-bold text-slate-400 uppercase">FX SELECT</span>
            <div className="flex items-center gap-1">
              {(['echo', 'delay', 'flanger'] as const).map((fx) => (
                <button
                  key={fx}
                  onClick={() => setActiveFxB(fx)}
                  className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase transition-all ${
                    activeFxB === fx
                      ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                      : 'bg-[#12151D] text-slate-400 border border-[#242936] hover:text-white'
                  }`}
                >
                  {fx}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PERFORMANCE PADS SECTION: 8 RGB Pads Deck A & Deck B                      */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-12 gap-3 sm:gap-6 items-start">
        {/* Deck A Pads (Left 6 Cols) */}
        <div className="col-span-6 bg-[#0A0C11] p-3 rounded-lg border border-[#1A1E2A] flex flex-col gap-2">
          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-4 gap-1">
            <button
              onClick={() => setPadModeA('hotcue')}
              className={`py-1 text-[9px] font-mono font-bold uppercase rounded border transition-all ${
                padModeA === 'hotcue'
                  ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.4)]'
                  : 'bg-[#12141C] text-slate-400 border-[#222736]'
              }`}
            >
              HOT CUE
            </button>
            <button
              onClick={() => setPadModeA('looper')}
              className={`py-1 text-[9px] font-mono font-bold uppercase rounded border transition-all ${
                padModeA === 'looper'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                  : 'bg-[#12141C] text-slate-400 border-[#222736]'
              }`}
            >
              LOOPER
            </button>
            <button
              onClick={() => setPadModeA('slicer')}
              className={`py-1 text-[9px] font-mono font-bold uppercase rounded border transition-all ${
                padModeA === 'slicer'
                  ? 'bg-blue-500/20 text-blue-300 border-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.4)]'
                  : 'bg-[#12141C] text-slate-400 border-[#222736]'
              }`}
            >
              SLICER
            </button>
            <button
              onClick={() => setPadModeA('sampler')}
              className={`py-1 text-[9px] font-mono font-bold uppercase rounded border transition-all ${
                padModeA === 'sampler'
                  ? 'bg-pink-500/20 text-pink-300 border-pink-400 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
                  : 'bg-[#12141C] text-slate-400 border-[#222736]'
              }`}
            >
              SAMPLER
            </button>
          </div>

          {/* 8 RGB Performance Pads (4x2 grid) */}
          <div className="grid grid-cols-4 gap-2 mt-1">
            {padColorsA.map((colorClass, idx) => (
              <button
                key={idx}
                id={`pad-a-${idx + 1}`}
                onClick={() => handlePadClickA(idx)}
                className={`h-11 sm:h-13 rounded-md ${colorClass} active:brightness-150 active:scale-95 transition-all shadow-inner border border-white/20 flex items-center justify-center`}
              >
                <div className="w-2 h-2 rounded-full bg-white/40"></div>
              </button>
            ))}
          </div>
        </div>

        {/* Deck B Pads (Right 6 Cols) */}
        <div className="col-span-6 bg-[#0A0C11] p-3 rounded-lg border border-[#1A1E2A] flex flex-col gap-2">
          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-4 gap-1">
            <button
              onClick={() => setPadModeB('hotcue')}
              className={`py-1 text-[9px] font-mono font-bold uppercase rounded border transition-all ${
                padModeB === 'hotcue'
                  ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.4)]'
                  : 'bg-[#12141C] text-slate-400 border-[#222736]'
              }`}
            >
              HOT CUE
            </button>
            <button
              onClick={() => setPadModeB('looper')}
              className={`py-1 text-[9px] font-mono font-bold uppercase rounded border transition-all ${
                padModeB === 'looper'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                  : 'bg-[#12141C] text-slate-400 border-[#222736]'
              }`}
            >
              LOOPER
            </button>
            <button
              onClick={() => setPadModeB('slicer')}
              className={`py-1 text-[9px] font-mono font-bold uppercase rounded border transition-all ${
                padModeB === 'slicer'
                  ? 'bg-blue-500/20 text-blue-300 border-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.4)]'
                  : 'bg-[#12141C] text-slate-400 border-[#222736]'
              }`}
            >
              SLICER
            </button>
            <button
              onClick={() => setPadModeB('sampler')}
              className={`py-1 text-[9px] font-mono font-bold uppercase rounded border transition-all ${
                padModeB === 'sampler'
                  ? 'bg-pink-500/20 text-pink-300 border-pink-400 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
                  : 'bg-[#12141C] text-slate-400 border-[#222736]'
              }`}
            >
              SAMPLER
            </button>
          </div>

          {/* 8 RGB Performance Pads (4x2 grid) */}
          <div className="grid grid-cols-4 gap-2 mt-1">
            {padColorsB.map((colorClass, idx) => (
              <button
                key={idx}
                id={`pad-b-${idx + 1}`}
                onClick={() => handlePadClickB(idx)}
                className={`h-11 sm:h-13 rounded-md ${colorClass} active:brightness-150 active:scale-95 transition-all shadow-inner border border-white/20 flex items-center justify-center`}
              >
                <div className="w-2 h-2 rounded-full bg-white/40"></div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BOTTOM SECTION: Faders, DJ IMAN Matrix, Circular CUE / PLAY Buttons       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-12 gap-3 sm:gap-4 items-center bg-[#080A0E] p-3 rounded-lg border border-[#181C26]">
        {/* Left Transport: SAMPLER VOLUME, Circular CUE & Circular PLAY */}
        <div className="col-span-4 flex items-center justify-start gap-3 sm:gap-5">
          {/* SAMPLER VOLUME Knob */}
          <DjHardwareKnob
            label="SAMPLER VOLUME"
            value={samplerVolume}
            min={0}
            max={1}
            onChange={setSamplerVolume}
            leftSubLabel="-∞"
            rightSubLabel="+6"
            size="sm"
          />

          {/* Large Circular CUE Button (Gold Ring + Brushed Metal Center) */}
          <button
            id="deck-a-large-cue"
            onMouseDown={onCueDownA}
            onMouseUp={onCueUpA}
            onTouchStart={onCueDownA}
            onTouchEnd={onCueUpA}
            className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-[#12151D] border-4 border-amber-400 p-1 flex items-center justify-center shadow-[0_0_16px_rgba(251,191,36,0.6)] active:scale-95 active:brightness-125 transition-all cursor-pointer"
          >
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#D1D5DB] via-[#E5E7EB] to-[#9CA3AF] flex items-center justify-center shadow-inner border border-white">
              <span className="font-black text-sm sm:text-base text-slate-900 tracking-wider">
                CUE
              </span>
            </div>
          </button>

          {/* Large Circular PLAY/PAUSE Button (Green Ring + Dark Center + Green Triangle) */}
          <button
            id="deck-a-large-play"
            onClick={telemetryA?.isPlaying ? onPauseA : onPlayA}
            className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-[#0D1212] border-4 border-emerald-400 p-1 flex items-center justify-center shadow-[0_0_18px_rgba(52,211,153,0.7)] active:scale-95 active:brightness-125 transition-all cursor-pointer"
          >
            <div className="w-full h-full rounded-full bg-[#080B0C] flex items-center justify-center border border-emerald-950">
              {telemetryA?.isPlaying ? (
                <Pause className="w-7 h-7 text-emerald-400 fill-current shadow-[0_0_10px_#34D399]" />
              ) : (
                <Play className="w-7 h-7 text-emerald-400 fill-current ml-1 shadow-[0_0_10px_#34D399]" />
              )}
            </div>
          </button>
        </div>

        {/* Center: Vertical Volume Faders, DJ IMAN VU Matrix & Crossfader */}
        <div className="col-span-4 flex flex-col items-center gap-2">
          {/* Vertical Faders & DJ IMAN Peak Meter Grid */}
          <div className="flex items-center justify-center gap-4 sm:gap-6 w-full">
            {/* Channel A Vertical Fader */}
            <div className="flex flex-col items-center">
              <div className="relative w-8 h-24 bg-[#080A0D] rounded-md border border-[#232733] flex items-center justify-center p-1">
                {/* Scale ticks */}
                <div className="absolute left-1 inset-y-2 flex flex-col justify-between text-[6px] text-slate-500 font-mono">
                  <span>-</span>
                  <span>-</span>
                  <span>-</span>
                  <span>-</span>
                  <span>-</span>
                </div>
                {/* Slider Input */}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volumeA}
                  onChange={(e) => onSetVolumeA(parseFloat(e.target.value))}
                  className="w-20 h-4 -rotate-90 origin-center accent-white cursor-pointer"
                />
              </div>
            </div>

            {/* DJ IMAN Center Branding & LED VU Matrix */}
            <div className="flex flex-col items-center justify-center gap-1">
              <span className="font-black font-sans text-xs tracking-wider text-white uppercase drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]">
                DJ IMAN
              </span>
              {/* 4-column Peak LED Matrix */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-black/90 rounded border border-[#202534]">
                {Array.from({ length: 16 }).map((_, i) => {
                  const row = Math.floor(i / 4);
                  const isHigh = row === 0;
                  const isMid = row === 1;
                  const isActive = (telemetryA?.isPlaying || telemetryB?.isPlaying) && (row > 0 || Math.random() > 0.4);
                  return (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-[1px] transition-opacity ${
                        isActive
                          ? isHigh
                            ? 'bg-red-500 shadow-[0_0_4px_#EF4444]'
                            : isMid
                            ? 'bg-amber-400 shadow-[0_0_4px_#FBBF24]'
                            : 'bg-emerald-500 shadow-[0_0_4px_#10B981]'
                          : 'bg-slate-900'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Channel B Vertical Fader */}
            <div className="flex flex-col items-center">
              <div className="relative w-8 h-24 bg-[#080A0D] rounded-md border border-[#232733] flex items-center justify-center p-1">
                {/* Scale ticks */}
                <div className="absolute right-1 inset-y-2 flex flex-col justify-between text-[6px] text-slate-500 font-mono">
                  <span>-</span>
                  <span>-</span>
                  <span>-</span>
                  <span>-</span>
                  <span>-</span>
                </div>
                {/* Slider Input */}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volumeB}
                  onChange={(e) => onSetVolumeB(parseFloat(e.target.value))}
                  className="w-20 h-4 -rotate-90 origin-center accent-white cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Crossfader Assign & Horizontal Slider */}
          <div className="flex flex-col items-center w-full max-w-[200px] mt-1">
            <span className="text-[8px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              CROSSFADER ASSIGN
            </span>
            <div className="flex items-center gap-2 w-full">
              <span className="text-[10px] font-bold font-mono text-slate-300">A</span>
              <div className="flex-1 relative flex items-center bg-[#07090C] h-6 rounded border border-[#202534] px-1">
                <input
                  id="hardware-crossfader"
                  type="range"
                  min="-1"
                  max="1"
                  step="0.01"
                  value={crossfaderPos}
                  onChange={(e) => onSetCrossfaderPos(parseFloat(e.target.value))}
                  className="w-full accent-white cursor-pointer"
                />
              </div>
              <span className="text-[10px] font-bold font-mono text-slate-300">B</span>
            </div>
          </div>
        </div>

        {/* Right Transport: CUE MIX, MASTER FILTER, Circular CUE & PLAY */}
        <div className="col-span-4 flex items-center justify-end gap-3 sm:gap-5">
          {/* CUE MIX & MASTER FILTER Knobs */}
          <div className="flex flex-col items-center gap-1">
            <DjHardwareKnob
              label="CUE MIX"
              value={cueMix}
              min={-1}
              max={1}
              onChange={setCueMix}
              leftSubLabel="CUE"
              rightSubLabel="MASTER"
              size="sm"
            />
            <DjHardwareKnob
              label="MASTER FILTER"
              value={masterFilter}
              min={-1}
              max={1}
              onChange={setMasterFilter}
              leftSubLabel="LPF"
              rightSubLabel="HPF"
              size="sm"
            />
          </div>

          {/* Large Circular CUE Button */}
          <button
            id="deck-b-large-cue"
            onMouseDown={onCueDownB}
            onMouseUp={onCueUpB}
            onTouchStart={onCueDownB}
            onTouchEnd={onCueUpB}
            className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-[#12151D] border-4 border-amber-400 p-1 flex items-center justify-center shadow-[0_0_16px_rgba(251,191,36,0.6)] active:scale-95 active:brightness-125 transition-all cursor-pointer"
          >
            <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#D1D5DB] via-[#E5E7EB] to-[#9CA3AF] flex items-center justify-center shadow-inner border border-white">
              <span className="font-black text-sm sm:text-base text-slate-900 tracking-wider">
                CUE
              </span>
            </div>
          </button>

          {/* Large Circular PLAY/PAUSE Button */}
          <button
            id="deck-b-large-play"
            onClick={telemetryB?.isPlaying ? onPauseB : onPlayB}
            className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-[#0D1212] border-4 border-emerald-400 p-1 flex items-center justify-center shadow-[0_0_18px_rgba(52,211,153,0.7)] active:scale-95 active:brightness-125 transition-all cursor-pointer"
          >
            <div className="w-full h-full rounded-full bg-[#080B0C] flex items-center justify-center border border-emerald-950">
              {telemetryB?.isPlaying ? (
                <Pause className="w-7 h-7 text-emerald-400 fill-current shadow-[0_0_10px_#34D399]" />
              ) : (
                <Play className="w-7 h-7 text-emerald-400 fill-current ml-1 shadow-[0_0_10px_#34D399]" />
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
