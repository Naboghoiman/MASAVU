/**
 * V2.2 Technical Corrections Verification & Live Telemetry Panel
 * Directly exposes mathematical formulas, coordinate transforms,
 * latency compensation, PLL controller terms, and live disturbance injection tests.
 */

import React, { useState } from 'react';
import {
  ContinuousPhaseLockState,
  DeckTelemetry,
  SlaveStartPlan,
  PLLControllerConfig
} from '../types/dj';
import { Activity, ShieldCheck, Gauge, Zap, AlertTriangle, RefreshCw, Cpu } from 'lucide-react';

interface SyncTelemetryPanelProps {
  telemetryA: DeckTelemetry;
  telemetryB: DeckTelemetry;
  phaseLockState: ContinuousPhaseLockState | null;
  slaveStartPlan: SlaveStartPlan | null;
  pllConfig: PLLControllerConfig;
  onUpdatePllConfig: (config: Partial<PLLControllerConfig>) => void;
  onInjectDisturbance: (ms: number) => void;
  onRetriggerSlaveSync: (quantizeMode: 'beat' | 'bar') => void;
}

export const SyncTelemetryPanel: React.FC<SyncTelemetryPanelProps> = ({
  telemetryA,
  telemetryB,
  phaseLockState,
  slaveStartPlan,
  pllConfig,
  onUpdatePllConfig,
  onInjectDisturbance,
  onRetriggerSlaveSync
}) => {
  const [quantizeMode, setQuantizeMode] = useState<'beat' | 'bar'>('beat');

  const masterTelem = telemetryA.isMaster ? telemetryA : telemetryB;
  const slaveTelem = telemetryA.isMaster ? telemetryB : telemetryA;

  const ms = phaseLockState ? phaseLockState.phaseErrorMs : 0;
  const inDeadband = phaseLockState ? phaseLockState.inDeadband : false;
  const correctionFraction = phaseLockState ? phaseLockState.correctionFraction : 0;
  const baseMultiplier = phaseLockState ? phaseLockState.baseTempoMultiplier : 1.0;
  const correctedMultiplier = phaseLockState ? phaseLockState.correctedTempoMultiplier : 1.0;

  return (
    <div id="v22-sync-telemetry-panel" className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-2xl text-slate-200">
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded border border-amber-500/40">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black font-mono uppercase text-white tracking-wider">
              V2.2 Synchronization Engine Diagnostics & PLL Verification
            </h4>
            <p className="text-[11px] text-slate-400">
              Shared monotonic audio clock • Source-sample BeatGrid coordinates • Bounded PI controller
            </p>
          </div>
        </div>

        {/* Sync Trigger Action */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800 text-[10px] font-mono">
            <span className="text-slate-500">QUANTIZE:</span>
            {(['beat', 'bar'] as const).map((m) => (
              <button
                key={m}
                id={`quantize-mode-${m}`}
                onClick={() => setQuantizeMode(m)}
                className={`px-1.5 py-0.5 rounded font-bold uppercase transition-colors ${
                  quantizeMode === m ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <button
            id="trigger-slave-sync-btn"
            onClick={() => onRetriggerSlaveSync(quantizeMode)}
            className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-mono font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>START SLAVE SYNC</span>
          </button>
        </div>
      </div>

      {/* Grid of Section telemetry monitors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-3.5">
        {/* Section 1: Exact Coordinate Mapping Card */}
        <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 font-mono text-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 pb-1.5 border-b border-slate-800 mb-2">
              <span className="font-bold text-blue-400">[1] COORDINATE MAPPING</span>
              <Gauge className="w-3.5 h-3.5 text-blue-400" />
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Master Source Sample:</span>
                <span className="text-slate-200 font-bold">{masterTelem.currentSourceSample.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Slave Source Sample:</span>
                <span className="text-slate-200 font-bold">{slaveTelem.currentSourceSample.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Shared Render Frame:</span>
                <span className="text-amber-400 font-bold">{masterTelem.currentOutputFrame.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Audio Clock (sec):</span>
                <span className="text-slate-300">{masterTelem.currentTimeSeconds.toFixed(4)}s</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
            Source Sample ↓ Stretch Ratio ↓ Output Frame (No UI clock dependence)
          </div>
        </div>

        {/* Section 6 & 7: Continuous Phase Lock & Drift Correction Card */}
        <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 font-mono text-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 pb-1.5 border-b border-slate-800 mb-2">
              <span className="font-bold text-amber-400">[6 & 7] CONTINUOUS PLL</span>
              <Activity className="w-3.5 h-3.5 text-amber-400" />
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Signed Phase Error:</span>
                <span className={`font-bold text-xs ${Math.abs(ms) <= 1.5 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {ms > 0 ? `+${ms.toFixed(2)} ms` : `${ms.toFixed(2)} ms`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Deadband Status:</span>
                <span className={`font-bold ${inDeadband ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {inDeadband ? 'IN DEADBAND (±1.5ms)' : 'ACTIVE CORRECTION'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Base Multiplier:</span>
                <span className="text-slate-300">{baseMultiplier.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Corrected Multiplier:</span>
                <span className="text-emerald-400 font-bold">{correctedMultiplier.toFixed(4)}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
            PLL Correction Fraction: {(correctionFraction * 100).toFixed(3)}%
          </div>
        </div>

        {/* Section 5: Latency-Compensated Slave Start Schedule */}
        <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 font-mono text-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 pb-1.5 border-b border-slate-800 mb-2">
              <span className="font-bold text-emerald-400">[5] SLAVE START PLAN</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>

            {slaveStartPlan ? (
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Output Frame:</span>
                  <span className="text-amber-400 font-bold">{slaveStartPlan.targetOutputFrame.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Matched Beat / Bar:</span>
                  <span className="text-slate-200">
                    Beat {slaveStartPlan.masterBeatNumber} (Bar {slaveStartPlan.masterBarIndex})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Slave Sample:</span>
                  <span className="text-slate-300">{slaveStartPlan.slaveSourceSample.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Buffer Latency Comp:</span>
                  <span className="text-emerald-400 font-bold">
                    {(slaveStartPlan.totalLatencySeconds * 1000).toFixed(1)} ms
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-slate-500 text-[11px]">
                Press SYNC or START SLAVE SYNC to trigger Section 5 beat-perfect start planning.
              </div>
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
            Latency compensated, not "latency-free" (Prerolls buffer lookahead)
          </div>
        </div>
      </div>

      {/* Interactive Phase Disturbance Injector (Verifies Section 7) */}
      <div className="mt-3 p-3 bg-slate-950/90 rounded-lg border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold font-mono text-amber-400">
            <Zap className="w-3.5 h-3.5" />
            <span>SECTION 7 SPEC VERIFICATION SUITE: INJECT PHASE DISTURBANCE</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Injects an instantaneous phase error into Slave deck. Observe the bounded PLL/PI controller smoothly converge back to 0.0ms over 2-4 beats without audible pops!
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            id="test-disturbance-5ms-late"
            onClick={() => onInjectDisturbance(5)}
            title="Inject +5ms error (Slave 5ms late as in Section 7 prompt example)"
            className="px-2.5 py-1 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800/60 rounded text-xs font-mono font-bold transition-all shadow-sm active:scale-95"
          >
            +5 ms (Late)
          </button>
          <button
            id="test-disturbance-5ms-early"
            onClick={() => onInjectDisturbance(-5)}
            title="Inject -5ms error (Slave 5ms early)"
            className="px-2.5 py-1 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800/60 rounded text-xs font-mono font-bold transition-all shadow-sm active:scale-95"
          >
            -5 ms (Early)
          </button>
          <button
            id="test-disturbance-15ms"
            onClick={() => onInjectDisturbance(15)}
            title="Inject +15ms moderate phase error"
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-mono font-bold transition-all shadow-sm active:scale-95"
          >
            +15 ms
          </button>
          <button
            id="test-disturbance-40ms-slip"
            onClick={() => onInjectDisturbance(40)}
            title="Inject +40ms severe slip (tests bounded clamping)"
            className="px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded text-xs font-mono font-bold transition-all shadow-sm active:scale-95"
          >
            +40 ms Slip
          </button>
        </div>
      </div>
    </div>
  );
};
