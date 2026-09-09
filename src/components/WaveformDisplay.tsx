/**
 * Waveform Display Component
 * Implements Section 8:
 * - Both waveforms scroll under ONE COMMON VISUAL REFERENCE LINE (Playhead)
 * - Displays 3-Band multi-frequency spectrum (Red=Low, Green=Mid, Blue=High)
 * - Displays Beat markers, Downbeats, Bar boundaries
 * - Displays Phase-Lock status widget reading directly from the audio engine
 * - Timing strictly reads from the audio engine; never drives audio clock!
 */

import React, { useEffect, useRef } from 'react';
import { ContinuousPhaseLockState, DeckTelemetry, TrackData } from '../types/dj';

interface WaveformDisplayProps {
  trackA: TrackData | null;
  trackB: TrackData | null;
  telemetryA: DeckTelemetry;
  telemetryB: DeckTelemetry;
  phaseLockState: ContinuousPhaseLockState | null;
  onSeekDeckA: (sourceSample: number) => void;
  onSeekDeckB: (sourceSample: number) => void;
}

export const WaveformDisplay: React.FC<WaveformDisplayProps> = ({
  trackA,
  trackB,
  telemetryA,
  telemetryB,
  phaseLockState,
  onSeekDeckA,
  onSeekDeckB
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Store latest props in ref so canvas loop runs at steady 60fps without React effect unmount/remount churn
  const propsRef = useRef({
    trackA,
    trackB,
    telemetryA,
    telemetryB,
    phaseLockState,
    onSeekDeckA,
    onSeekDeckB
  });

  propsRef.current = {
    trackA,
    trackB,
    telemetryA,
    telemetryB,
    phaseLockState,
    onSeekDeckA,
    onSeekDeckB
  };

  // High-performance canvas render loop locked to monitor refresh
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;

        if (width <= 0 || height <= 0) {
          animationFrameId = requestAnimationFrame(render);
          return;
        }

        if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
          canvas.width = Math.round(width * dpr);
          canvas.height = Math.round(height * dpr);
        }

        ctx.save();
        ctx.scale(dpr, dpr);

        // Dark pro studio background
        ctx.fillStyle = '#0B0F19';
        ctx.fillRect(0, 0, width, height);

        const currentProps = propsRef.current;
        const halfHeight = height / 2;
        const playheadX = width / 2;

        // Draw Top Half: Deck A
        drawDeckWaveform(ctx, {
          track: currentProps.trackA,
          telemetry: currentProps.telemetryA,
          yOffset: 0,
          deckHeight: halfHeight,
          playheadX,
          totalWidth: width,
          deckLabel: 'DECK A',
          accentColor: '#3B82F6' // Electric Blue
        });

        // Subtle divider line
        ctx.strokeStyle = '#1F2937';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, halfHeight);
        ctx.lineTo(width, halfHeight);
        ctx.stroke();

        // Draw Bottom Half: Deck B
        drawDeckWaveform(ctx, {
          track: currentProps.trackB,
          telemetry: currentProps.telemetryB,
          yOffset: halfHeight,
          deckHeight: halfHeight,
          playheadX,
          totalWidth: width,
          deckLabel: 'DECK B',
          accentColor: '#10B981' // Emerald Green
        });

        // COMMON VISUAL REFERENCE LINE (Center Vertical Playhead)
        ctx.strokeStyle = '#EF4444'; // High-contrast Red/Neon indicator
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, height);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Playhead triangle pointers
        ctx.fillStyle = '#EF4444';
        // Top pointer
        ctx.beginPath();
        ctx.moveTo(playheadX - 6, 0);
        ctx.lineTo(playheadX + 6, 0);
        ctx.lineTo(playheadX, 10);
        ctx.closePath();
        ctx.fill();

        // Bottom pointer
        ctx.beginPath();
        ctx.moveTo(playheadX - 6, height);
        ctx.lineTo(playheadX + 6, height);
        ctx.lineTo(playheadX, height - 10);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      } catch (err) {
        console.error('Waveform render error caught:', err);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, []); // Run once on mount! Loop reads from propsRef.current

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const isDeckA = clickY < rect.height / 2;

    const targetDeck = isDeckA ? telemetryA : telemetryB;
    const targetTrack = isDeckA ? trackA : trackB;
    const onSeek = isDeckA ? onSeekDeckA : onSeekDeckB;

    if (!targetTrack || !targetTrack.waveform) return;

    // Zoom scale: samples represented per pixel width
    const samplesPerPixelZoom = targetTrack.waveform.samplesPerPixel * 1.5;
    const deltaPixels = clickX - rect.width / 2;
    const deltaSamples = deltaPixels * samplesPerPixelZoom;
    const newSample = Math.max(0, Math.min(targetTrack.totalSamples, targetDeck.currentSourceSample + deltaSamples));

    onSeek(newSample);
  };

  return (
    <div id="waveform-container" ref={containerRef} className="relative w-full bg-slate-950 rounded-xl border border-slate-800 shadow-2xl overflow-hidden select-none">
      {/* Waveform Canvas */}
      <canvas
        id="dj-dual-waveform-canvas"
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="w-full h-44 sm:h-52 cursor-pointer block"
      />

      {/* Floating Center Phase-Lock Status Badge */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none z-20 flex items-center gap-2">
        <PhaseLockStatusWidget state={phaseLockState} telemetryA={telemetryA} telemetryB={telemetryB} />
      </div>

      {/* Track info overlay badges */}
      <div className="absolute top-2 left-3 pointer-events-none flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-2.5 py-1 rounded-md border border-slate-700/60 text-xs">
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
        <span className="font-bold text-blue-400">A: {trackA ? trackA.title : 'EMPTY'}</span>
        <span className="text-slate-400 font-mono">
          {telemetryA.effectiveBpm.toFixed(1)} BPM
        </span>
        {telemetryA.isMaster && (
          <span className="bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded text-[10px] border border-amber-500/40">
            MASTER
          </span>
        )}
      </div>

      <div className="absolute bottom-2 left-3 pointer-events-none flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-2.5 py-1 rounded-md border border-slate-700/60 text-xs">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span className="font-bold text-emerald-400">B: {trackB ? trackB.title : 'EMPTY'}</span>
        <span className="text-slate-400 font-mono">
          {telemetryB.effectiveBpm.toFixed(1)} BPM
        </span>
        {telemetryB.isMaster && (
          <span className="bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded text-[10px] border border-amber-500/40">
            MASTER
          </span>
        )}
      </div>

      {/* 3-Band Color Legend */}
      <div className="absolute top-2 right-3 pointer-events-none hidden md:flex items-center gap-2 text-[10px] bg-slate-900/80 backdrop-blur-sm px-2 py-0.5 rounded border border-slate-800">
        <span className="flex items-center gap-1 text-rose-400">
          <span className="w-2 h-2 rounded-full bg-rose-500"></span> Bass/Kick
        </span>
        <span className="flex items-center gap-1 text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Mids/Vocal
        </span>
        <span className="flex items-center gap-1 text-cyan-400">
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span> Highs
        </span>
      </div>
    </div>
  );
};

interface DeckRenderParams {
  track: TrackData | null;
  telemetry: DeckTelemetry;
  yOffset: number;
  deckHeight: number;
  playheadX: number;
  totalWidth: number;
  deckLabel: string;
  accentColor: string;
}

function drawDeckWaveform(ctx: CanvasRenderingContext2D, p: DeckRenderParams) {
  const { track, telemetry, yOffset, deckHeight, playheadX, totalWidth } = p;
  const centerY = yOffset + deckHeight / 2;

  if (!track || !track.waveform) {
    // Empty deck state
    ctx.fillStyle = '#475569';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.deckLabel} - NO AUDIO LOADED`, playheadX, centerY);
    return;
  }

  const waveform = track.waveform;
  const samplesPerPixelZoom = (Number.isFinite(waveform.samplesPerPixel) && waveform.samplesPerPixel > 0)
    ? waveform.samplesPerPixel * 1.5
    : 150;
  const currentSourceSample = Number.isFinite(telemetry.currentSourceSample) ? telemetry.currentSourceSample : 0;

  // Center horizontal guideline
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(totalWidth, centerY);
  ctx.stroke();

  // Draw 3-Band frequency-separated waveform bars (crisp 2px column layout for maximum smoothness)
  const halfBarHeight = deckHeight * 0.44;

  for (let x = 0; x < totalWidth; x += 2) {
    // Calculate sample index for this screen column
    const sampleOffset = (x - playheadX) * samplesPerPixelZoom;
    let sourceSample = currentSourceSample + sampleOffset;

    if (track.totalSamples > 0) {
      sourceSample = ((sourceSample % track.totalSamples) + track.totalSamples) % track.totalSamples;
    }

    if (!Number.isFinite(sourceSample) || sourceSample < 0 || sourceSample >= track.totalSamples) {
      continue;
    }

    const pixelIndex = Math.floor(sourceSample / waveform.samplesPerPixel);
    if (!Number.isFinite(pixelIndex) || pixelIndex < 0 || pixelIndex >= waveform.length) continue;

    const lowEnergy = waveform.low[pixelIndex] || 0;
    const midEnergy = waveform.mid[pixelIndex] || 0;
    const highEnergy = waveform.high[pixelIndex] || 0;

    // Combine 3-Band RGB components: Red (Low), Green (Mid), Blue (High)
    const r = Math.min(255, Math.max(0, Math.floor(lowEnergy * 255)));
    const g = Math.min(255, Math.max(0, Math.floor(midEnergy * 230)));
    const b = Math.min(255, Math.max(0, Math.floor(highEnergy * 255)));

    const rawAmp = Math.max(lowEnergy, midEnergy, highEnergy);
    const maxAmp = Number.isFinite(rawAmp) ? Math.max(0.04, rawAmp) : 0.04;
    const barH = Math.max(1, maxAmp * halfBarHeight);

    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(x, centerY - barH, 2, barH * 2);
  }

  // Draw BeatGrid Markers across entire visible canvas in continuous coordinates
  if (track.beatGrid && track.beatGrid.samplesPerBeat > 0) {
    const grid = track.beatGrid;
    const samplesPerBeat = grid.samplesPerBeat;
    const beatsPerBar = grid.beatsPerBar || 4;
    const firstDownbeat = grid.firstDownbeatSample || 0;

    const visibleStartSample = currentSourceSample - playheadX * samplesPerPixelZoom;
    const visibleEndSample = currentSourceSample + (totalWidth - playheadX) * samplesPerPixelZoom;

    const minBeatIndex = Math.floor((visibleStartSample - firstDownbeat) / samplesPerBeat);
    const maxBeatIndex = Math.ceil((visibleEndSample - firstDownbeat) / samplesPerBeat);

    for (let i = minBeatIndex; i <= maxBeatIndex; i++) {
      const beatSample = firstDownbeat + i * samplesPerBeat;
      const screenX = playheadX + (beatSample - currentSourceSample) / samplesPerPixelZoom;
      if (screenX < -10 || screenX > totalWidth + 10) continue;

      const beatInBar = (((i % beatsPerBar) + beatsPerBar) % beatsPerBar) + 1;
      const isDownbeat = beatInBar === 1;
      const barNumber = Math.floor(i / beatsPerBar) + 1;

      if (isDownbeat) {
        // DOWNBEAT / BAR MARKER (Prominent Orange vertical marker)
        ctx.strokeStyle = '#F97316';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(screenX, yOffset + 2);
        ctx.lineTo(screenX, yOffset + deckHeight - 2);
        ctx.stroke();

        // Bar boundary badge number
        ctx.fillStyle = '#F97316';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${barNumber}.1`, screenX + 3, yOffset + 12);
      } else {
        // STANDARD BEAT MARKER (Crisp White/Slate Tick)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(screenX, centerY - halfBarHeight * 0.7);
        ctx.lineTo(screenX, centerY + halfBarHeight * 0.7);
        ctx.stroke();

        // Small beat number
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.font = '8px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${barNumber}.${beatInBar}`, screenX + 2, centerY - halfBarHeight * 0.7 - 2);
      }
    }
  }
}

const PhaseLockStatusWidget: React.FC<{
  state: ContinuousPhaseLockState | null;
  telemetryA: DeckTelemetry;
  telemetryB: DeckTelemetry;
}> = ({ state, telemetryA, telemetryB }) => {
  if (!state || (!telemetryA.isPlaying && !telemetryB.isPlaying)) {
    return (
      <div className="flex items-center gap-1.5 bg-slate-900/90 text-slate-400 border border-slate-700/60 px-3 py-1 rounded-full text-xs font-mono shadow-lg">
        <span className="w-2 h-2 rounded-full bg-slate-500"></span>
        <span>ENGINE READY</span>
      </div>
    );
  }

  const ms = state.phaseErrorMs;
  const isLocked = state.status === 'locked' || state.inDeadband;
  const isDeadband = state.inDeadband;
  const isReanchor = state.status === 'reanchoring';

  const badgeColor = isLocked
    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
    : isReanchor
    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
    : 'bg-amber-500/20 text-amber-300 border-amber-500/50';

  const dotColor = isLocked
    ? 'bg-emerald-400'
    : isReanchor
    ? 'bg-rose-400 animate-ping'
    : 'bg-amber-400 animate-pulse';

  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono shadow-xl border backdrop-blur-md ${badgeColor}`}>
      <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
      <span className="font-bold">
        {isDeadband
          ? 'DEADBAND (±1.5ms)'
          : isLocked
          ? 'PHASE LOCKED'
          : isReanchor
          ? 'SMOOTH RE-ANCHOR'
          : 'PLL DRIFT CORR'}
      </span>
      <span className="text-[11px] opacity-90 border-l border-current/30 pl-2">
        Δt: {ms > 0 ? `+${ms.toFixed(1)}` : ms.toFixed(1)}ms
      </span>
      {Math.abs(state.correctionFraction) > 0.0001 && (
        <span className="text-[10px] opacity-75">
          ({(state.correctionFraction * 100).toFixed(2)}%)
        </span>
      )}
    </div>
  );
};
