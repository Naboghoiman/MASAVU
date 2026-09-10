/**
 * DJ Hardware Rotary Knob Component
 * Features realistic metallic rim, silver cap, position indicator dot/line,
 * smooth mouse/touch dragging, and graduation labels matching the reference image.
 */

import React, { useRef, useState } from 'react';

interface DjHardwareKnobProps {
  label: string;
  value: number; // typically -1 to +1, or 0 to 1
  min?: number;
  max?: number;
  onChange: (val: number) => void;
  leftSubLabel?: string;
  rightSubLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  isFilter?: boolean;
}

export const DjHardwareKnob: React.FC<DjHardwareKnobProps> = ({
  label,
  value,
  min = -1,
  max = 1,
  onChange,
  leftSubLabel,
  rightSubLabel,
  size = 'md',
  isFilter = false
}) => {
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startValRef = useRef(value);

  // Map value to angle (-135deg to +135deg)
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const angle = -135 + normalized * 270;

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startValRef.current = value;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const deltaY = startYRef.current - e.clientY;
    const sensitivity = 0.006 * (max - min);
    const newVal = Math.max(min, Math.min(max, startValRef.current + deltaY * sensitivity));
    onChange(newVal);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleDoubleClick = () => {
    // Reset to center/default (0 or 0.5)
    const def = min < 0 && max > 0 ? 0 : (min + max) / 2;
    onChange(def);
  };

  // Dimensions
  const knobSizeClass =
    size === 'lg'
      ? 'w-13 h-13 sm:w-15 sm:h-15'
      : size === 'sm'
      ? 'w-8 h-8 sm:w-9 sm:h-9'
      : 'w-10 h-10 sm:w-11 sm:h-11';

  return (
    <div className="flex flex-col items-center select-none group touch-none">
      {/* Top Label */}
      <span className="text-[10px] font-extrabold font-mono tracking-wider text-slate-300 uppercase mb-0.5">
        {label}
      </span>

      {/* Rotary Knob */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        title={`${label}: ${value.toFixed(2)} (Double click to reset)`}
        className={`relative ${knobSizeClass} rounded-full cursor-ns-resize shadow-[0_4px_10px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(255,255,255,0.2)] bg-gradient-to-b from-[#2A2E39] via-[#15171D] to-[#0D0F13] p-0.5 border border-[#3A404E] flex items-center justify-center`}
      >
        {/* Grooved outer ring */}
        <div className="w-full h-full rounded-full bg-[#1A1D24] p-1 flex items-center justify-center shadow-inner">
          {/* Inner brushed metal core */}
          <div
            className="w-full h-full rounded-full bg-gradient-to-tr from-[#1E222A] via-[#333845] to-[#12151B] relative flex items-center justify-center transition-transform duration-75"
            style={{ transform: `rotate(${angle}deg)` }}
          >
            {/* White indicator pointer line/needle */}
            <div className="absolute top-1 w-[2px] h-3 bg-white rounded-full shadow-[0_0_3px_#FFFFFF]"></div>

            {/* Center silver cap rivet */}
            <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-b from-[#555C6E] to-[#252933] border border-[#3E4554] shadow-sm"></div>
          </div>
        </div>
      </div>

      {/* Bottom Sub-Labels (e.g. -26 / +6 or LPF / HPF) */}
      {(leftSubLabel || rightSubLabel) && (
        <div className="flex items-center justify-between w-full max-w-[56px] text-[8px] sm:text-[9px] font-mono text-slate-400 mt-0.5 px-0.5">
          <span>{leftSubLabel}</span>
          <span>{rightSubLabel}</span>
        </div>
      )}
    </div>
  );
};
