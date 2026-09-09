/**
 * V2.2 Technical Corrections Reference & Documentation Modal
 * Displays full specification breakdown and formulas from the V2.2 standard.
 */

import React from 'react';
import { X, BookOpen, CheckCircle, ArrowDown } from 'lucide-react';

interface SpecsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SpecsModal: React.FC<SpecsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-base text-white font-mono">
                V2.2 REQUIRED TECHNICAL CORRECTIONS SPECIFICATION
              </h3>
              <p className="text-xs text-slate-400">
                Exact algorithmic behavior matching Algoriddim djay on Android
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-6 text-sm text-slate-300 font-sans leading-relaxed">
          {/* Section 1 */}
          <div className="border border-slate-800 bg-slate-950/60 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-amber-400 font-mono font-bold text-xs uppercase mb-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>[1. SOURCE TIME AND AUDIO-CLOCK TIME]</span>
            </div>
            <p className="mb-2 text-slate-300">
              BeatGrid timestamps must be stored in the song's original <strong>source-sample coordinates</strong>. Playback scheduling must use the <strong>shared monotonic audio-render frame clock</strong>.
            </p>
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg font-mono text-xs text-amber-300 flex items-center justify-center gap-3 my-2">
              <span>Source Sample Position</span>
              <ArrowDown className="w-4 h-4 text-slate-500 -rotate-90" />
              <span>Time-Stretch Ratio</span>
              <ArrowDown className="w-4 h-4 text-slate-500 -rotate-90" />
              <span>Rendered Output Frame</span>
            </div>
            <p className="text-xs text-slate-400 italic">
              * Analysis must never depend on UI time, animation frames or setTimeout.
            </p>
          </div>

          {/* Section 5 */}
          <div className="border border-slate-800 bg-slate-950/60 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-amber-400 font-mono font-bold text-xs uppercase mb-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>[5. BEAT-PERFECT SLAVE START]</span>
            </div>
            <p className="mb-2 text-slate-300">When SYNC is pressed:</p>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300 font-mono bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              <li>Read Master's current beat, bar, phase and render-frame position.</li>
              <li>Select required future Master beat: <span className="text-emerald-400">Target Output Frame = Next Master Beat Render Frame</span></li>
              <li>Select matching Slave beat using: Beat number, Downbeat status, Bar position, Phrase position.</li>
              <li>Calculate: <span className="text-amber-400">Base Tempo Multiplier = Master BPM / Slave BPM</span></li>
              <li>Set Slave source read-head to selected BeatGrid source sample.</li>
              <li>Measure: Decoder latency, Time-stretcher latency, Audio-buffer latency.</li>
              <li>Begin processing silently before the target frame (preroll lookahead).</li>
              <li>Make selected Slave beat become audible exactly at: <span className="text-emerald-400">Target Output Frame</span>.</li>
            </ol>
            <p className="text-xs text-rose-300 mt-2 font-mono">
              Do not calculate: Start Sample = Master Beat Sample - Output Latency. Source samples and output-render frames are different coordinate systems.
            </p>
          </div>

          {/* Section 6 & 7 */}
          <div className="border border-slate-800 bg-slate-950/60 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-amber-400 font-mono font-bold text-xs uppercase mb-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>[6. CONTINUOUS PHASE LOCK &amp; 7. DRIFT-CORRECTION CALCULATION]</span>
            </div>
            <p className="mb-2 text-slate-300">Every audio-render buffer:</p>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300 font-mono bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              <li>Predict next Master and Slave beat output times.</li>
              <li>Calculate signed phase error: <span className="text-amber-400">Phase Error = Slave Beat Output Time - Master Beat Output Time</span></li>
              <li>Wrap error to nearest corresponding beat: <span className="text-sky-400">[-0.5 * beatPeriod, +0.5 * beatPeriod]</span></li>
              <li>Apply Deadband: IF |error| &lt;= configurable deadband (±1.5ms): No correction.</li>
              <li>IF error is small or moderate: Apply bounded tempo correction over 2–4 beats:</li>
            </ol>
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg font-mono text-xs text-emerald-300 my-2 space-y-1">
              <div>Correction Fraction ≈ Phase Error Seconds / Correction Window Seconds</div>
              <div>Corrected Tempo Multiplier = Base Tempo Multiplier × (1 + Correction Fraction)</div>
            </div>
            <div className="text-xs text-slate-400 bg-slate-950 p-2.5 rounded border border-slate-800/80">
              <strong className="text-slate-200">Example at 120 BPM:</strong> 2 beats = 1.0s, 4 beats = 2.0s.
              Slave 5 ms late: Correction over 2 beats ≈ 1.005, over 4 beats ≈ 1.0025.
              A value of 1.00005 would require 100 seconds to recover 5ms and cannot provide a 2-4 beat correction.
              The engine utilizes a bounded PI controller to smooth this calculation.
            </div>
          </div>

          {/* Section 8 & 10 */}
          <div className="border border-slate-800 bg-slate-950/60 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-amber-400 font-mono font-bold text-xs uppercase mb-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>[8. WAVEFORM DISPLAY &amp; 10. ACCURATE FINAL RESULT]</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-xs text-slate-300">
              <li>Both waveforms scroll under one common visual reference line (the center playhead).</li>
              <li>Displays Waveform (3-Band RGB spectrum), Beat markers, Downbeats, Bar boundaries, Phase-lock status.</li>
              <li>The waveform display reads timing strictly from the audio engine; it never drives or corrects audio timing.</li>
              <li>Effective BPMs are matched, corresponding beats/downbeats are phase-aligned, transients play together, and playback is latency-compensated.</li>
            </ul>
          </div>

          {/* Section 11: Pro Hardware Sync Looper */}
          <div className="border border-slate-800 bg-slate-950/60 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-amber-400 font-mono font-bold text-xs uppercase mb-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>[11. HARDWARE SYNC LOOPER ARCHITECTURE]</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-xs text-slate-300">
              <li>Continuous tempo and sub-sample phase-lock matching the Master Deck (Deck A/Deck B/Auto Master).</li>
              <li>Quantized launch on 1-bar downbeat or 1-beat boundary with precise AudioContext time scheduling.</li>
              <li>Dynamic real-time loop slicing (1/4 to 16 beats) with /2 and x2 operators.</li>
              <li>Slip roll pads that maintain continuous underlying song position during momentary stutters.</li>
              <li>Dual-mode resonant DJ filter (LPF ↔ HPF), dedicated volume faders, VU meters, and live deck sampling.</li>
            </ul>
          </div>

          {/* Section 12: Pre-Sync Audio Warp & Transient Protection Engine */}
          <div className="border border-slate-800 bg-slate-950/60 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-amber-400 font-mono font-bold text-xs uppercase mb-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>[12. PRE-SYNC AUDIO WARP &amp; TRANSIENT-AWARE WSOLA DSP]</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-xs text-slate-300">
              <li><strong>Pre-Sync Preparation:</strong> Tempo fluctuations and micro-deviations are corrected silently during song loading/preparation, not during live playback.</li>
              <li><strong>Transient Protection:</strong> Kicks (40-140Hz) and snares (high flux + mid body) are detected. Attack windows (15-30ms) are protected verbatim to preserve 100% drum sharpness, punch, and transient rise time.</li>
              <li><strong>WSOLA DSP Engine:</strong> Replaced linear interpolation/np.interp with Waveform Similarity Based Overlap-Add. Sustains and decay regions are time-stretched while strictly preserving original pitch, vocals, and harmonic integrity.</li>
              <li><strong>Straight-BPM PCM Output:</strong> Decks operate on perfectly uniform-BPM audio streams. The BeatGrid is mathematically straight.</li>
              <li><strong>Live SYNC Operation:</strong> When SYNC is pressed, the slave deck solely performs beat phase alignment, downbeat alignment, and rhythmic kick-to-kick placement with zero live tempo fight.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors"
          >
            I Understand the V2.2 Specification
          </button>
        </div>
      </div>
    </div>
  );
};
