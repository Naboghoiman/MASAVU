/**
 * Professional DJ Mixer Section
 * Includes Crossfader with adjustable curves, 3-Band EQ Isolators with Kill buttons,
 * Bipolar Color Filters, Channel Level Faders, Stereo VU meters, Master Output, and Sampler FX.
 */

import React, { useState } from 'react';
import { DeckTelemetry } from '../types/dj';
import { Volume2, Zap, Radio, Sliders } from 'lucide-react';

interface MixerSectionProps {
  telemetryA: DeckTelemetry;
  telemetryB: DeckTelemetry;
  crossfaderPos: number;
  onCrossfaderChange: (val: number) => void;
  crossfaderCurve: 'smooth' | 'linear' | 'cut';
  onCrossfaderCurveChange: (curve: 'smooth' | 'linear' | 'cut') => void;
  onSetLowEqA: (val: number) => void;
  onSetMidEqA: (val: number) => void;
  onSetHighEqA: (val: number) => void;
  onSetFilterA: (val: number) => void;
  onSetVolumeA: (val: number) => void;
  onSetLowEqB: (val: number) => void;
  onSetMidEqB: (val: number) => void;
  onSetHighEqB: (val: number) => void;
  onSetFilterB: (val: number) => void;
  onSetVolumeB: (val: number) => void;
  onMasterVolumeChange: (val: number) => void;
  onPlaySampler: (fx: 'airhorn' | 'siren' | 'laser' | 'drop') => void;
}

export const MixerSection: React.FC<MixerSectionProps> = ({
  telemetryA,
  telemetryB,
  crossfaderPos,
  onCrossfaderChange,
  crossfaderCurve,
  onCrossfaderCurveChange,
  onSetLowEqA,
  onSetMidEqA,
  onSetHighEqA,
  onSetFilterA,
  onSetVolumeA,
  onSetLowEqB,
  onSetMidEqB,
  onSetHighEqB,
  onSetFilterB,
  onSetVolumeB,
  onMasterVolumeChange,
  onPlaySampler
}) => {
  // State for EQ knobs (-26dB to +6dB)
  const [eqA, setEqA] = useState({ high: 0, mid: 0, low: 0 });
  const [eqB, setEqB] = useState({ high: 0, mid: 0, low: 0 });
  // Bipolar filters (-1.0 to +1.0)
  const [filterA, setFilterA] = useState(0);
  const [filterB, setFilterB] = useState(0);
  // Channel faders (0 to 1.0)
  const [volA, setVolA] = useState(1.0);
  const [volB, setVolB] = useState(1.0);
  const [masterVol, setMasterVol] = useState(1.0);

  // EQ Kill states
  const [killA, setKillA] = useState({ high: false, mid: false, low: false });
  const [killB, setKillB] = useState({ high: false, mid: false, low: false });

  const toggleKillA = (band: 'high' | 'mid' | 'low') => {
    const next = !killA[band];
    setKillA({ ...killA, [band]: next });
    const gain = next ? -26 : eqA[band];
    if (band === 'high') onSetHighEqA(gain);
    if (band === 'mid') onSetMidEqA(gain);
    if (band === 'low') onSetLowEqA(gain);
  };

  const toggleKillB = (band: 'high' | 'mid' | 'low') => {
    const next = !killB[band];
    setKillB({ ...killB, [band]: next });
    const gain = next ? -26 : eqB[band];
    if (band === 'high') onSetHighEqB(gain);
    if (band === 'mid') onSetMidEqB(gain);
    if (band === 'low') onSetLowEqB(gain);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col justify-between">
      {/* Top Header: Master Output & Sampler FX */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Pro DJ Mixer</span>
        </div>

        {/* Master Output Knob & Sampler Launcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] text-slate-400 font-mono">MASTER</span>
            <input
              id="master-volume-slider"
              type="range"
              min="0"
              max="1.2"
              step="0.01"
              value={masterVol}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setMasterVol(val);
                onMasterVolumeChange(val);
              }}
              className="w-16 sm:w-20 accent-amber-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1">
            <button
              id="fx-airhorn"
              onClick={() => onPlaySampler('airhorn')}
              title="Airhorn FX"
              className="px-2 py-0.5 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded text-[10px] font-bold transition-all shadow-sm active:scale-95"
            >
              HORN
            </button>
            <button
              id="fx-siren"
              onClick={() => onPlaySampler('siren')}
              title="Siren Sweep FX"
              className="px-2 py-0.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/60 rounded text-[10px] font-bold transition-all shadow-sm active:scale-95"
            >
              SIREN
            </button>
            <button
              id="fx-drop"
              onClick={() => onPlaySampler('drop')}
              title="Sub Drop FX"
              className="px-2 py-0.5 bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800/60 rounded text-[10px] font-bold transition-all shadow-sm active:scale-95"
            >
              DROP
            </button>
          </div>
        </div>
      </div>

      {/* Main Dual Channel EQ Strips */}
      <div className="grid grid-cols-2 gap-4 my-3">
        {/* Channel A Column */}
        <div className="flex flex-col items-center bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
          <span className="text-xs font-bold text-blue-400 font-mono mb-2">CH 1 (DECK A)</span>

          {/* High EQ */}
          <EqKnobWithKill
            idPrefix="deck-a-eq-high"
            label="HI"
            value={killA.high ? -26 : eqA.high}
            isKilled={killA.high}
            accent="blue"
            onChange={(val) => {
              setEqA({ ...eqA, high: val });
              if (!killA.high) onSetHighEqA(val);
            }}
            onToggleKill={() => toggleKillA('high')}
          />

          {/* Mid EQ */}
          <EqKnobWithKill
            idPrefix="deck-a-eq-mid"
            label="MID"
            value={killA.mid ? -26 : eqA.mid}
            isKilled={killA.mid}
            accent="blue"
            onChange={(val) => {
              setEqA({ ...eqA, mid: val });
              if (!killA.mid) onSetMidEqA(val);
            }}
            onToggleKill={() => toggleKillA('mid')}
          />

          {/* Low EQ */}
          <EqKnobWithKill
            idPrefix="deck-a-eq-low"
            label="LOW"
            value={killA.low ? -26 : eqA.low}
            isKilled={killA.low}
            accent="blue"
            onChange={(val) => {
              setEqA({ ...eqA, low: val });
              if (!killA.low) onSetLowEqA(val);
            }}
            onToggleKill={() => toggleKillA('low')}
          />

          {/* Bipolar Color Filter */}
          <div className="mt-2 w-full flex flex-col items-center">
            <div className="flex items-center justify-between w-full text-[10px] font-mono text-slate-400 px-1">
              <span>LP</span>
              <span className="font-bold text-slate-300">FILTER</span>
              <span>HP</span>
            </div>
            <input
              id="deck-a-filter-knob"
              type="range"
              min="-1"
              max="1"
              step="0.02"
              value={filterA}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setFilterA(val);
                onSetFilterA(val);
              }}
              onDoubleClick={() => {
                setFilterA(0);
                onSetFilterA(0);
              }}
              className="w-full accent-blue-500 h-1.5 bg-slate-700 rounded cursor-pointer mt-1"
            />
          </div>

          {/* Channel Fader & VU Meter */}
          <div className="flex items-center gap-3 mt-4 h-32">
            <VuMeter levels={telemetryA.vuLevel} accent="blue" />
            <input
              id="deck-a-volume-fader"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volA}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setVolA(val);
                onSetVolumeA(val);
              }}
              className="h-28 w-6 appearance-none bg-slate-800 rounded-lg cursor-pointer accent-blue-500 [writing-mode:vertical-lr] [direction:rtl]"
            />
          </div>
        </div>

        {/* Channel B Column */}
        <div className="flex flex-col items-center bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
          <span className="text-xs font-bold text-emerald-400 font-mono mb-2">CH 2 (DECK B)</span>

          {/* High EQ */}
          <EqKnobWithKill
            idPrefix="deck-b-eq-high"
            label="HI"
            value={killB.high ? -26 : eqB.high}
            isKilled={killB.high}
            accent="emerald"
            onChange={(val) => {
              setEqB({ ...eqB, high: val });
              if (!killB.high) onSetHighEqB(val);
            }}
            onToggleKill={() => toggleKillB('high')}
          />

          {/* Mid EQ */}
          <EqKnobWithKill
            idPrefix="deck-b-eq-mid"
            label="MID"
            value={killB.mid ? -26 : eqB.mid}
            isKilled={killB.mid}
            accent="emerald"
            onChange={(val) => {
              setEqB({ ...eqB, mid: val });
              if (!killB.mid) onSetMidEqB(val);
            }}
            onToggleKill={() => toggleKillB('mid')}
          />

          {/* Low EQ */}
          <EqKnobWithKill
            idPrefix="deck-b-eq-low"
            label="LOW"
            value={killB.low ? -26 : eqB.low}
            isKilled={killB.low}
            accent="emerald"
            onChange={(val) => {
              setEqB({ ...eqB, low: val });
              if (!killB.low) onSetLowEqB(val);
            }}
            onToggleKill={() => toggleKillB('low')}
          />

          {/* Bipolar Color Filter */}
          <div className="mt-2 w-full flex flex-col items-center">
            <div className="flex items-center justify-between w-full text-[10px] font-mono text-slate-400 px-1">
              <span>LP</span>
              <span className="font-bold text-slate-300">FILTER</span>
              <span>HP</span>
            </div>
            <input
              id="deck-b-filter-knob"
              type="range"
              min="-1"
              max="1"
              step="0.02"
              value={filterB}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setFilterB(val);
                onSetFilterB(val);
              }}
              onDoubleClick={() => {
                setFilterB(0);
                onSetFilterB(0);
              }}
              className="w-full accent-emerald-500 h-1.5 bg-slate-700 rounded cursor-pointer mt-1"
            />
          </div>

          {/* Channel Fader & VU Meter */}
          <div className="flex items-center gap-3 mt-4 h-32">
            <input
              id="deck-b-volume-fader"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volB}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setVolB(val);
                onSetVolumeB(val);
              }}
              className="h-28 w-6 appearance-none bg-slate-800 rounded-lg cursor-pointer accent-emerald-500 [writing-mode:vertical-lr] [direction:rtl]"
            />
            <VuMeter levels={telemetryB.vuLevel} accent="emerald" />
          </div>
        </div>
      </div>

      {/* Crossfader Section with Curve Mode Selector */}
      <div className="pt-3 border-t border-slate-800 flex flex-col items-center">
        <div className="flex items-center justify-between w-full text-[11px] font-mono text-slate-400 mb-1 px-1">
          <span className="font-bold text-blue-400">A</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500">CURVE:</span>
            {(['smooth', 'linear', 'cut'] as const).map((c) => (
              <button
                key={c}
                id={`crossfader-curve-${c}`}
                onClick={() => onCrossfaderCurveChange(c)}
                className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase transition-colors ${
                  crossfaderCurve === c
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <span className="font-bold text-emerald-400">B</span>
        </div>

        {/* Crossfader Horizontal Track */}
        <div className="relative w-full flex items-center px-1">
          <input
            id="main-crossfader"
            type="range"
            min="-1"
            max="1"
            step="0.01"
            value={crossfaderPos}
            onChange={(e) => onCrossfaderChange(parseFloat(e.target.value))}
            onDoubleClick={() => onCrossfaderChange(0)}
            className="w-full accent-amber-500 h-3 bg-slate-950 border border-slate-700 rounded-lg cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};

interface EqKnobProps {
  idPrefix: string;
  label: string;
  value: number;
  isKilled: boolean;
  accent: 'blue' | 'emerald';
  onChange: (val: number) => void;
  onToggleKill: () => void;
}

const EqKnobWithKill: React.FC<EqKnobProps> = ({
  idPrefix,
  label,
  value,
  isKilled,
  accent,
  onChange,
  onToggleKill
}) => {
  const accentColor = accent === 'blue' ? 'accent-blue-500' : 'accent-emerald-500';

  return (
    <div className="w-full flex items-center justify-between gap-2 py-1">
      <span className="text-[10px] font-mono text-slate-400 w-6 font-bold">{label}</span>
      <input
        id={`${idPrefix}-slider`}
        type="range"
        min="-26"
        max="6"
        step="0.5"
        disabled={isKilled}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onDoubleClick={() => onChange(0)}
        className={`w-full ${accentColor} h-1.5 bg-slate-800 rounded cursor-pointer ${isKilled ? 'opacity-30' : ''}`}
      />
      <button
        id={`${idPrefix}-kill`}
        onClick={onToggleKill}
        className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded border transition-colors ${
          isKilled
            ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
            : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
        }`}
      >
        KILL
      </button>
    </div>
  );
};

const VuMeter: React.FC<{ levels: [number, number]; accent: 'blue' | 'emerald' }> = ({ levels, accent }) => {
  const segments = 12;
  const leftSegments = Math.round(levels[0] * segments);
  const rightSegments = Math.round(levels[1] * segments);

  const getSegmentColor = (idx: number) => {
    if (idx >= 10) return 'bg-rose-500'; // Peak clip
    if (idx >= 8) return 'bg-amber-400';
    return accent === 'blue' ? 'bg-blue-500' : 'bg-emerald-500';
  };

  return (
    <div className="flex gap-1 h-28 items-end bg-slate-950 p-1 rounded border border-slate-800/70">
      {/* Left Channel */}
      <div className="w-1.5 h-full flex flex-col-reverse gap-0.5">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={`w-full h-1.5 rounded-xs transition-opacity duration-75 ${
              i < leftSegments ? getSegmentColor(i) : 'bg-slate-800/30'
            }`}
          />
        ))}
      </div>
      {/* Right Channel */}
      <div className="w-1.5 h-full flex flex-col-reverse gap-0.5">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={`w-full h-1.5 rounded-xs transition-opacity duration-75 ${
              i < rightSegments ? getSegmentColor(i) : 'bg-slate-800/30'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
