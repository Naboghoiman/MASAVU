/**
 * Dual Waveform Display Component
 * Exactly matches the software screen waveform appearance from the user's reference image:
 * - Deck A: Electric Cyan glowing waveform, beat markers (1-8), cue flags, mini overview,
 *   header with album art, "Midnight Drive" / "Lunar Tribe", "F#m", "124.0 BPM", "03:26 / 06:14",
 *   "DECK A" label, and 12-segment vertical LED VU meter.
 * - Deck B: Neon Hot Magenta/Pink glowing waveform, beat markers (1-8), cue flags, mini overview,
 *   header with album art, "Higher Tonight" / "Solar Motion", "Am", "126.0 BPM", "01:48 / 05:20",
 *   "DECK B" label, and 12-segment vertical LED VU meter.
 * - Integrated mini transport buttons: [CUE], [▶], [FX], [LOOPER], [HOT CUE].
 * - One central common visual reference line (playhead) strictly synced with the audio engine!
 */

import React, { useEffect, useRef, useState } from 'react';
import { ContinuousPhaseLockState, DeckTelemetry, TrackData } from '../types/dj';
import { Play, Pause } from 'lucide-react';

interface WaveformDisplayProps {
  trackA: TrackData | null;
  trackB: TrackData | null;
  telemetryA: DeckTelemetry;
  telemetryB: DeckTelemetry;
  phaseLockState: ContinuousPhaseLockState | null;
  onSeekDeckA: (sourceSample: number) => void;
  onSeekDeckB: (sourceSample: number) => void;
  onPlayDeckA: () => void;
  onPauseDeckA: () => void;
  onCueDeckA: () => void;
  onPlayDeckB: () => void;
  onPauseDeckB: () => void;
  onCueDeckB: () => void;
  onToggleLooper?: (deckId: 'A' | 'B') => void;
  onToggleHotCue?: (deckId: 'A' | 'B') => void;
}

// 12-segment LED VU Meter
const DeckVuMeter: React.FC<{ isPlaying: boolean; level?: number }> = ({ isPlaying, level = 0.7 }) => {
  // Simulate active VU bounce if playing
  const [currentLevel, setCurrentLevel] = useState(0);

  useEffect(() => {
    if (!isPlaying) {
      setCurrentLevel(0);
      return;
    }
    let anim: number;
    const update = () => {
      const noise = (Math.random() * 0.35 + 0.65) * level;
      setCurrentLevel(noise);
      anim = requestAnimationFrame(update);
    };
    anim = requestAnimationFrame(update);
    return () => cancelAnimationFrame(anim);
  }, [isPlaying, level]);

  const totalSegments = 12;
  const activeSegments = isPlaying ? Math.floor(currentLevel * totalSegments) : 0;

  return (
    <div className="flex flex-col-reverse gap-0.5 w-2 h-14 bg-black/60 p-0.5 rounded border border-slate-800">
      {Array.from({ length: totalSegments }).map((_, idx) => {
        const isActive = idx < activeSegments;
        let colorClass = 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.8)]';
        let inactiveColor = 'bg-emerald-950/40';
        if (idx >= 9) {
          colorClass = 'bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.8)]';
          inactiveColor = 'bg-red-950/40';
        } else if (idx >= 6) {
          colorClass = 'bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.8)]';
          inactiveColor = 'bg-amber-950/40';
        }
        return (
          <div
            key={idx}
            className={`w-full flex-1 rounded-[1px] transition-opacity duration-75 ${
              isActive ? colorClass : inactiveColor
            }`}
          />
        );
      })}
    </div>
  );
};

export const WaveformDisplay: React.FC<WaveformDisplayProps> = ({
  trackA,
  trackB,
  telemetryA,
  telemetryB,
  phaseLockState,
  onSeekDeckA,
  onSeekDeckB,
  onPlayDeckA,
  onPauseDeckA,
  onCueDeckA,
  onPlayDeckB,
  onPauseDeckB,
  onCueDeckB,
  onToggleLooper,
  onToggleHotCue
}) => {
  const canvasRefA = useRef<HTMLCanvasElement | null>(null);
  const canvasRefB = useRef<HTMLCanvasElement | null>(null);
  const overviewRefA = useRef<HTMLCanvasElement | null>(null);
  const overviewRefB = useRef<HTMLCanvasElement | null>(null);

  // Store latest props for high-rate canvas renderer
  const propsRef = useRef({
    trackA,
    trackB,
    telemetryA,
    telemetryB
  });
  propsRef.current = { trackA, trackB, telemetryA, telemetryB };

  // Format seconds into MM:SS
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) secs = 0;
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Main Waveforms Render Loop
  useEffect(() => {
    let animId: number;

    const renderWaveforms = () => {
      const { trackA: tA, trackB: tB, telemetryA: telemA, telemetryB: telemB } = propsRef.current;

      // Draw Deck A Main Waveform (Cyan Glow)
      if (canvasRefA.current) {
        drawMainWaveform(canvasRefA.current, {
          track: tA,
          telemetry: telemA,
          glowColor: '#00E5FF',
          coreColor: '#E0F7FA',
          gridNumberColor: '#38BDF8',
          accent: 'cyan'
        });
      }

      // Draw Deck A Mini Overview
      if (overviewRefA.current) {
        drawOverviewWaveform(overviewRefA.current, {
          track: tA,
          telemetry: telemA,
          waveColor: '#00E5FF',
          cueColor: '#FACC15'
        });
      }

      // Draw Deck B Main Waveform (Magenta/Pink Glow)
      if (canvasRefB.current) {
        drawMainWaveform(canvasRefB.current, {
          track: tB,
          telemetry: telemB,
          glowColor: '#FF007F',
          coreColor: '#FCE4EC',
          gridNumberColor: '#F472B6',
          accent: 'magenta'
        });
      }

      // Draw Deck B Mini Overview
      if (overviewRefB.current) {
        drawOverviewWaveform(overviewRefB.current, {
          track: tB,
          telemetry: telemB,
          waveColor: '#FF007F',
          cueColor: '#FACC15'
        });
      }

      animId = requestAnimationFrame(renderWaveforms);
    };

    animId = requestAnimationFrame(renderWaveforms);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Handle Main Waveform Click & Drag Seeking
  const handleMainWaveClick = (deck: 'A' | 'B', e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = deck === 'A' ? canvasRefA.current : canvasRefB.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetTrack = deck === 'A' ? trackA : trackB;
    const targetTelem = deck === 'A' ? telemetryA : telemetryB;
    const onSeek = deck === 'A' ? onSeekDeckA : onSeekDeckB;

    if (!targetTrack || !targetTrack.waveform) return;

    const samplesPerPixelZoom = targetTrack.waveform.samplesPerPixel * 1.5;
    const deltaPixels = clickX - rect.width / 2;
    const deltaSamples = deltaPixels * samplesPerPixelZoom;
    const newSample = Math.max(0, Math.min(targetTrack.totalSamples, targetTelem.currentSourceSample + deltaSamples));
    onSeek(newSample);
  };

  // Handle Mini Overview Click
  const handleOverviewClick = (deck: 'A' | 'B', e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = deck === 'A' ? overviewRefA.current : overviewRefB.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTrack = deck === 'A' ? trackA : trackB;
    const onSeek = deck === 'A' ? onSeekDeckA : onSeekDeckB;
    if (!targetTrack) return;
    onSeek(Math.floor(ratio * targetTrack.totalSamples));
  };

  return (
    <div id="deck-waveform-stage" className="w-full bg-[#07090E] p-2.5 sm:p-3.5 rounded-lg border border-[#171B26] select-none shadow-2xl flex flex-col gap-3">
      {/* ========================================================================= */}
      {/* DECK A STAGE                                                              */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-1.5 bg-[#090C14] p-2.5 rounded-md border border-[#161B29] relative overflow-hidden">
        {/* Track Header */}
        <div className="flex items-center justify-between gap-3 text-xs">
          {/* Left: Album Art & Track Info */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Album Art Icon */}
            <div className="w-10 h-10 rounded bg-gradient-to-br from-indigo-900 via-sky-800 to-purple-900 border border-sky-400/40 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-[0_0_8px_rgba(56,189,248,0.3)]">
              {/* Synthwave car / grid graphic */}
              <div className="w-full h-full relative flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-t from-sky-500/30 to-transparent"></div>
                <div className="w-5 h-3 border-t-2 border-sky-300 rounded-t-sm flex items-center justify-center">
                  <div className="w-2 h-1 bg-yellow-300 rounded-full shadow-[0_0_4px_#FDE047]"></div>
                </div>
              </div>
            </div>

            {/* Title & Artist */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm tracking-wide truncate">
                  {trackA ? trackA.title : 'Midnight Drive'}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 truncate block">
                {trackA ? trackA.artist : 'Lunar Tribe'}
              </span>
            </div>
          </div>

          {/* Center: Key, BPM, Time */}
          <div className="flex items-center gap-4 sm:gap-6 font-mono text-xs">
            {/* Key in bright cyan */}
            <span className="font-bold text-cyan-400 text-sm drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]">
              {trackA ? (trackA.key.includes('minor') ? trackA.key.replace(' minor', 'm') : trackA.key) : 'F#m'}
            </span>

            {/* BPM */}
            <span className="font-bold text-white text-sm">
              {(telemetryA ? telemetryA.effectiveBpm : (trackA?.bpm || 124.0)).toFixed(1)}{' '}
              <span className="text-[10px] text-slate-400 font-normal">BPM</span>
            </span>

            {/* Time: Elapsed / Remaining */}
            <span className="text-slate-300 text-xs hidden sm:inline-block">
              <strong className="text-white font-bold">
                {formatTime(telemetryA ? telemetryA.currentTimeSeconds : 206)}
              </strong>{' '}
              / {formatTime(trackA ? trackA.durationSeconds : 374)}
            </span>
          </div>

          {/* Right: DECK A Label & LED VU Meter */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-xs font-black tracking-widest text-slate-300 uppercase font-mono">
              DECK A
            </span>
            <DeckVuMeter isPlaying={telemetryA ? telemetryA.isPlaying : false} level={0.85} />
          </div>
        </div>

        {/* Main Waveform Canvas */}
        <div className="relative w-full h-16 sm:h-20 bg-[#05070B] rounded border border-cyan-900/30 overflow-hidden cursor-crosshair">
          <canvas
            ref={canvasRefA}
            onClick={(e) => handleMainWaveClick('A', e)}
            className="w-full h-full block"
          />
          {/* Central Visual Playhead */}
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-white shadow-[0_0_8px_#FFFFFF] pointer-events-none z-10">
            <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-white -ml-[3px]"></div>
          </div>
        </div>

        {/* Mini Overview Waveform & Transport row */}
        <div className="flex items-center gap-3">
          {/* Mini scrub waveform */}
          <div className="flex-1 h-6 bg-[#04060A] rounded border border-slate-800/80 overflow-hidden cursor-pointer relative">
            <canvas
              ref={overviewRefA}
              onClick={(e) => handleOverviewClick('A', e)}
              className="w-full h-full block"
            />
          </div>

          {/* Quick Buttons: CUE, PLAY, FX, LOOPER, HOT CUE */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* CUE button (Yellow border) */}
            <button
              id="deck-a-quick-cue"
              onClick={onCueDeckA}
              className="px-2.5 py-1 rounded text-[11px] font-black font-mono uppercase text-yellow-400 border border-yellow-400 hover:bg-yellow-400/20 active:scale-95 transition-all shadow-[0_0_6px_rgba(250,204,21,0.25)]"
            >
              CUE
            </button>

            {/* PLAY button (Vivid Green fill) */}
            <button
              id="deck-a-quick-play"
              onClick={telemetryA?.isPlaying ? onPauseDeckA : onPlayDeckA}
              className={`px-3 py-1 rounded text-[11px] font-black font-mono uppercase flex items-center justify-center transition-all active:scale-95 ${
                telemetryA?.isPlaying
                  ? 'bg-emerald-400 text-black shadow-[0_0_10px_rgba(52,211,153,0.7)]'
                  : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
              }`}
            >
              {telemetryA?.isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current ml-0.5" />}
            </button>

            <button
              onClick={() => onToggleLooper?.('A')}
              className="px-2 py-1 rounded text-[10px] font-bold font-mono text-slate-300 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 transition-colors uppercase"
            >
              FX
            </button>

            <button
              onClick={() => onToggleLooper?.('A')}
              className="px-2 py-1 rounded text-[10px] font-bold font-mono text-slate-300 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 transition-colors uppercase"
            >
              LOOPER
            </button>

            <button
              onClick={() => onToggleHotCue?.('A')}
              className="px-2 py-1 rounded text-[10px] font-bold font-mono text-slate-300 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 transition-colors uppercase"
            >
              HOT CUE
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DECK B STAGE                                                              */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-1.5 bg-[#090C14] p-2.5 rounded-md border border-[#161B29] relative overflow-hidden">
        {/* Track Header */}
        <div className="flex items-center justify-between gap-3 text-xs">
          {/* Left: Album Art & Track Info */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Album Art Icon */}
            <div className="w-10 h-10 rounded bg-gradient-to-br from-pink-900 via-rose-800 to-amber-900 border border-pink-400/40 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-[0_0_8px_rgba(244,63,94,0.3)]">
              {/* Sunset / palm graphic */}
              <div className="w-full h-full relative flex items-center justify-center">
                <div className="absolute bottom-0 inset-x-0 h-4 bg-gradient-to-t from-pink-600/40 to-transparent"></div>
                <div className="w-4 h-4 rounded-full bg-gradient-to-b from-yellow-300 to-rose-500 shadow-[0_0_6px_#FB7185]"></div>
              </div>
            </div>

            {/* Title & Artist */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm tracking-wide truncate">
                  {trackB ? trackB.title : 'Higher Tonight'}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 truncate block">
                {trackB ? trackB.artist : 'Solar Motion'}
              </span>
            </div>
          </div>

          {/* Center: Key, BPM, Time */}
          <div className="flex items-center gap-4 sm:gap-6 font-mono text-xs">
            {/* Key in bright magenta */}
            <span className="font-bold text-fuchsia-400 text-sm drop-shadow-[0_0_6px_rgba(232,121,249,0.6)]">
              {trackB ? (trackB.key.includes('minor') ? trackB.key.replace(' minor', 'm') : trackB.key) : 'Am'}
            </span>

            {/* BPM */}
            <span className="font-bold text-white text-sm">
              {(telemetryB ? telemetryB.effectiveBpm : (trackB?.bpm || 126.0)).toFixed(1)}{' '}
              <span className="text-[10px] text-slate-400 font-normal">BPM</span>
            </span>

            {/* Time: Elapsed / Remaining */}
            <span className="text-slate-300 text-xs hidden sm:inline-block">
              <strong className="text-white font-bold">
                {formatTime(telemetryB ? telemetryB.currentTimeSeconds : 108)}
              </strong>{' '}
              / {formatTime(trackB ? trackB.durationSeconds : 320)}
            </span>
          </div>

          {/* Right: DECK B Label & LED VU Meter */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-xs font-black tracking-widest text-slate-300 uppercase font-mono">
              DECK B
            </span>
            <DeckVuMeter isPlaying={telemetryB ? telemetryB.isPlaying : false} level={0.8} />
          </div>
        </div>

        {/* Main Waveform Canvas */}
        <div className="relative w-full h-16 sm:h-20 bg-[#05070B] rounded border border-pink-900/30 overflow-hidden cursor-crosshair">
          <canvas
            ref={canvasRefB}
            onClick={(e) => handleMainWaveClick('B', e)}
            className="w-full h-full block"
          />
          {/* Central Visual Playhead */}
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-white shadow-[0_0_8px_#FFFFFF] pointer-events-none z-10">
            <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-white -ml-[3px]"></div>
          </div>
        </div>

        {/* Mini Overview Waveform & Transport row */}
        <div className="flex items-center gap-3">
          {/* Mini scrub waveform */}
          <div className="flex-1 h-6 bg-[#04060A] rounded border border-slate-800/80 overflow-hidden cursor-pointer relative">
            <canvas
              ref={overviewRefB}
              onClick={(e) => handleOverviewClick('B', e)}
              className="w-full h-full block"
            />
          </div>

          {/* Quick Buttons: CUE, PLAY, FX, LOOPER, HOT CUE */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* CUE button (Yellow border) */}
            <button
              id="deck-b-quick-cue"
              onClick={onCueDeckB}
              className="px-2.5 py-1 rounded text-[11px] font-black font-mono uppercase text-yellow-400 border border-yellow-400 hover:bg-yellow-400/20 active:scale-95 transition-all shadow-[0_0_6px_rgba(250,204,21,0.25)]"
            >
              CUE
            </button>

            {/* PLAY button (Vivid Green fill) */}
            <button
              id="deck-b-quick-play"
              onClick={telemetryB?.isPlaying ? onPauseDeckB : onPlayDeckB}
              className={`px-3 py-1 rounded text-[11px] font-black font-mono uppercase flex items-center justify-center transition-all active:scale-95 ${
                telemetryB?.isPlaying
                  ? 'bg-emerald-400 text-black shadow-[0_0_10px_rgba(52,211,153,0.7)]'
                  : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
              }`}
            >
              {telemetryB?.isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current ml-0.5" />}
            </button>

            <button
              onClick={() => onToggleLooper?.('B')}
              className="px-2 py-1 rounded text-[10px] font-bold font-mono text-slate-300 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 transition-colors uppercase"
            >
              FX
            </button>

            <button
              onClick={() => onToggleLooper?.('B')}
              className="px-2 py-1 rounded text-[10px] font-bold font-mono text-slate-300 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 transition-colors uppercase"
            >
              LOOPER
            </button>

            <button
              onClick={() => onToggleHotCue?.('B')}
              className="px-2 py-1 rounded text-[10px] font-bold font-mono text-slate-300 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 transition-colors uppercase"
            >
              HOT CUE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// High-speed Canvas renderer for Main Waveform
function drawMainWaveform(
  canvas: HTMLCanvasElement,
  options: {
    track: TrackData | null;
    telemetry: DeckTelemetry | null;
    glowColor: string;
    coreColor: string;
    gridNumberColor: string;
    accent: 'cyan' | 'magenta';
  }
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width <= 0 || height <= 0) return;

  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  ctx.save();
  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = '#06080E';
  ctx.fillRect(0, 0, width, height);

  const { track, telemetry, glowColor, coreColor, gridNumberColor } = options;
  const centerY = height / 2;
  const playheadX = width / 2;

  // If no track or waveform, draw standby line
  if (!track || !track.waveform) {
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const currentSample = telemetry ? telemetry.currentSourceSample : 0;
  const samplesPerPixelZoom = track.waveform.samplesPerPixel * 1.5;
  const halfWidth = width / 2;

  const startSample = currentSample - halfWidth * samplesPerPixelZoom;
  const endSample = currentSample + halfWidth * samplesPerPixelZoom;

  // 1. Draw BeatGrid Markers & Numbers (1, 2, 3, 4, 5, 6, 7, 8)
  if (track.beatGrid && track.beatGrid.beatSamples) {
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let b = 0; b < track.beatGrid.beatSamples.length; b++) {
      const beatSample = track.beatGrid.beatSamples[b];
      if (beatSample >= startSample && beatSample <= endSample) {
        const x = playheadX + (beatSample - currentSample) / samplesPerPixelZoom;
        const isDownbeat = track.beatGrid.isDownbeat ? track.beatGrid.isDownbeat[b] : b % 4 === 0;
        const beatNumber = (b % 4) + 1;
        const barIndex = Math.floor(b / 4) + 1;

        // Grid line
        ctx.strokeStyle = isDownbeat ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = isDownbeat ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Beat number label along top (1 to 8 cycle)
        const displayNum = (b % 8) + 1;
        ctx.fillStyle = isDownbeat ? '#FFFFFF' : gridNumberColor;
        ctx.fillText(displayNum.toString(), x, 2);

        // Cue flag inverted triangles
        if (isDownbeat && barIndex % 2 === 1) {
          ctx.fillStyle = '#FACC15'; // Yellow cue flag
          ctx.beginPath();
          ctx.moveTo(x - 5, 12);
          ctx.lineTo(x + 5, 12);
          ctx.lineTo(x, 19);
          ctx.closePath();
          ctx.fill();
        } else if (beatNumber === 3) {
          ctx.fillStyle = options.accent === 'cyan' ? '#38BDF8' : '#F472B6';
          ctx.beginPath();
          ctx.moveTo(x - 4, height - 12);
          ctx.lineTo(x + 4, height - 12);
          ctx.lineTo(x, height - 18);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  // 2. Draw Multi-Band Glowing Waveform
  const wave = track.waveform;
  const step = 1;

  ctx.lineWidth = 1.8;
  for (let x = 0; x < width; x += step) {
    const sampleAtX = startSample + x * samplesPerPixelZoom;
    if (sampleAtX < 0 || sampleAtX >= track.totalSamples) continue;

    const dataIndex = Math.floor(sampleAtX / wave.samplesPerPixel);
    if (dataIndex < 0 || dataIndex >= wave.length) continue;

    const peak = wave.peaks[dataIndex] || 0;
    const low = wave.low[dataIndex] || 0;
    const mid = wave.mid[dataIndex] || 0;
    const high = wave.high[dataIndex] || 0;

    const amplitude = Math.min(centerY - 2, peak * (centerY * 0.95));

    // Outer glow
    ctx.strokeStyle = glowColor;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(x, centerY - amplitude);
    ctx.lineTo(x, centerY + amplitude);
    ctx.stroke();

    // Inner bright core (Punch / Transient)
    const coreAmp = Math.min(amplitude, (low * 0.6 + mid * 0.4) * (centerY * 0.8));
    ctx.strokeStyle = coreColor;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.moveTo(x, centerY - coreAmp);
    ctx.lineTo(x, centerY + coreAmp);
    ctx.stroke();
  }

  ctx.globalAlpha = 1.0;
  ctx.restore();
}

// High-speed Canvas renderer for Mini Overview
function drawOverviewWaveform(
  canvas: HTMLCanvasElement,
  options: {
    track: TrackData | null;
    telemetry: DeckTelemetry | null;
    waveColor: string;
    cueColor: string;
  }
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width <= 0 || height <= 0) return;

  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  ctx.save();
  ctx.scale(dpr, dpr);

  ctx.fillStyle = '#05070B';
  ctx.fillRect(0, 0, width, height);

  const { track, telemetry, waveColor, cueColor } = options;
  if (!track || !track.waveform) {
    ctx.restore();
    return;
  }

  const centerY = height / 2;
  const wave = track.waveform;
  const totalSamples = track.totalSamples;

  // Waveform silhouette
  ctx.strokeStyle = waveColor;
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x++) {
    const sampleIdx = Math.floor((x / width) * wave.length);
    const peak = wave.peaks[sampleIdx] || 0;
    const amp = Math.min(centerY - 1, peak * (centerY * 0.9));

    ctx.beginPath();
    ctx.moveTo(x, centerY - amp);
    ctx.lineTo(x, centerY + amp);
    ctx.stroke();
  }

  // Playhead position line
  const currentSample = telemetry ? telemetry.currentSourceSample : 0;
  const playheadX = (currentSample / totalSamples) * width;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(playheadX - 1, 0, 2, height);

  // Cue flags in overview
  ctx.fillStyle = cueColor;
  [0.15, 0.35, 0.7].forEach((ratio) => {
    const cx = ratio * width;
    ctx.beginPath();
    ctx.moveTo(cx - 3, 0);
    ctx.lineTo(cx + 3, 0);
    ctx.lineTo(cx, 5);
    ctx.closePath();
    ctx.fill();
  });

  ctx.restore();
}
