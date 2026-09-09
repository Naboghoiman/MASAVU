/**
 * Professional DJ Jog Wheel Component
 * Features realistic vinyl platter touch/scratching, rim pitch-bend nudging,
 * spinning visual cue indicator, and position telemetry.
 */

import React, { useEffect, useRef, useState } from 'react';
import { DeckTelemetry } from '../types/dj';
import { RotateCw, Disc3 } from 'lucide-react';

interface JogWheelProps {
  telemetry: DeckTelemetry;
  accentColor: 'blue' | 'emerald';
  onTouchDown: () => void;
  onTouchUp: () => void;
  onScratchMove: (deltaAngle: number) => void;
  onNudge: (direction: number) => void;
}

export const JogWheel: React.FC<JogWheelProps> = ({
  telemetry,
  accentColor,
  onTouchDown,
  onTouchUp,
  onScratchMove,
  onNudge
}) => {
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const [rotationAngle, setRotationAngle] = useState(0);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  const isInteracting = useRef(false);

  // Rotate wheel smoothly while playing
  useEffect(() => {
    let animId: number;
    const updateRotation = () => {
      if (telemetry.isPlaying && !isInteracting.current) {
        // Standard 33.3 RPM vinyl speed adjusted by effective tempo multiplier
        const rps = (33.33 / 60) * (telemetry.effectiveBpm / telemetry.bpm);
        setRotationAngle((prev) => (prev + (rps * 360) / 60) % 360);
      }
      animId = requestAnimationFrame(updateRotation);
    };
    animId = requestAnimationFrame(updateRotation);
    return () => cancelAnimationFrame(animId);
  }, [telemetry.isPlaying, telemetry.effectiveBpm, telemetry.bpm]);

  const getAngleFromEvent = (e: MouseEvent | TouchEvent, rect: DOMRect): number => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    return Math.atan2(clientY - centerY, clientX - centerX);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const wheel = wheelRef.current;
    if (!wheel) return;

    wheel.setPointerCapture(e.pointerId);
    isInteracting.current = true;
    onTouchDown();

    const rect = wheel.getBoundingClientRect();
    lastMousePos.current = {
      x: e.clientX - rect.left - rect.width / 2,
      y: e.clientY - rect.top - rect.height / 2
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isInteracting.current || !wheelRef.current || !lastMousePos.current) return;
    const rect = wheelRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left - rect.width / 2;
    const currentY = e.clientY - rect.top - rect.height / 2;

    const prevAngle = Math.atan2(lastMousePos.current.y, lastMousePos.current.x);
    const currAngle = Math.atan2(currentY, currentX);
    let deltaAngle = currAngle - prevAngle;

    // Handle wrap-around near ±PI
    if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
    if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

    lastMousePos.current = { x: currentX, y: currentY };
    setRotationAngle((prev) => (prev + (deltaAngle * 180) / Math.PI) % 360);

    onScratchMove(deltaAngle);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isInteracting.current) return;
    isInteracting.current = false;
    lastMousePos.current = null;
    onTouchUp();
    try {
      wheelRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }
  };

  const themeGlow = accentColor === 'blue'
    ? 'hover:border-blue-500/80 shadow-blue-500/10'
    : 'hover:border-emerald-500/80 shadow-emerald-500/10';

  const centerBadgeColor = accentColor === 'blue'
    ? 'text-blue-400 border-blue-500/50 bg-blue-950/70'
    : 'text-emerald-400 border-emerald-500/50 bg-emerald-950/70';

  const markerColor = accentColor === 'blue' ? '#3B82F6' : '#10B981';

  return (
    <div className="flex flex-col items-center select-none">
      {/* Platter outer rim and vinyl surface */}
      <div
        id={`jog-wheel-deck-${telemetry.deckId}`}
        ref={wheelRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative w-44 h-44 sm:w-52 sm:h-52 rounded-full cursor-grab active:cursor-grabbing border-4 border-slate-700/80 bg-slate-900 shadow-2xl transition-colors duration-200 touch-none flex items-center justify-center p-2.5 ${themeGlow}`}
      >
        {/* Outer ribbed metallic platter rim */}
        <div className="absolute inset-0 rounded-full border-2 border-slate-600/40 pointer-events-none" />

        {/* Vinyl record grooves texture */}
        <div
          className="w-full h-full rounded-full relative flex items-center justify-center shadow-inner overflow-hidden"
          style={{
            background: 'radial-gradient(circle, #1E293B 0%, #0F172A 55%, #020617 100%)',
            transform: `rotate(${rotationAngle}deg)`
          }}
        >
          {/* Circular groove rings */}
          <div className="absolute inset-3 rounded-full border border-slate-700/30 pointer-events-none" />
          <div className="absolute inset-6 rounded-full border border-slate-700/25 pointer-events-none" />
          <div className="absolute inset-9 rounded-full border border-slate-700/20 pointer-events-none" />
          <div className="absolute inset-12 rounded-full border border-slate-700/15 pointer-events-none" />

          {/* Rotating Platter Marker Needle */}
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-6 rounded-full shadow-md" style={{ backgroundColor: markerColor }} />

          {/* Dual vinyl label stripes */}
          <div className="absolute w-full h-0.5 bg-slate-700/40 pointer-events-none" />
          <div className="absolute h-full w-0.5 bg-slate-700/40 pointer-events-none" />
        </div>

        {/* Center Platter Display (Fixed orientation) */}
        <div className={`absolute w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 shadow-2xl backdrop-blur-md flex flex-col items-center justify-center pointer-events-none ${centerBadgeColor}`}>
          <div className="flex items-center gap-1 font-mono font-bold text-xs tracking-wider">
            <Disc3 className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: telemetry.isPlaying ? '1.8s' : '0s' }} />
            <span>DECK {telemetry.deckId}</span>
          </div>
          <div className="text-[13px] font-mono font-black text-white mt-0.5">
            {telemetry.effectiveBpm.toFixed(1)}
          </div>
          <div className="text-[10px] font-mono opacity-80">
            {telemetry.pitchPercentage >= 0 ? `+${(telemetry.pitchPercentage * 16).toFixed(1)}%` : `${(telemetry.pitchPercentage * 16).toFixed(1)}%`}
          </div>
        </div>
      </div>

      {/* Pitch Bend / Nudge Rim Buttons */}
      <div className="flex items-center gap-2 mt-3">
        <button
          id={`deck-${telemetry.deckId}-nudge-minus`}
          onClick={() => onNudge(-1)}
          title="Nudge - (Temporary pitch slow down)"
          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 font-mono text-xs rounded border border-slate-700 flex items-center gap-1 transition-all shadow-sm"
        >
          <RotateCw className="w-3 h-3 -scale-x-100" />
          <span>NUDGE -</span>
        </button>
        <button
          id={`deck-${telemetry.deckId}-nudge-plus`}
          onClick={() => onNudge(1)}
          title="Nudge + (Temporary pitch speed up)"
          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 font-mono text-xs rounded border border-slate-700 flex items-center gap-1 transition-all shadow-sm"
        >
          <RotateCw className="w-3 h-3" />
          <span>NUDGE +</span>
        </button>
      </div>
    </div>
  );
};
