/**
 * Laptop Chassis Component
 * Recreates the photorealistic MacBook Pro chassis with backlit keyboard,
 * hinge bar, and glass trackpad between the software screen and the hardware controller.
 */

import React from 'react';

export const LaptopChassis: React.FC = () => {
  return (
    <div className="w-full bg-[#1C1F26] border-y border-[#2A2E39] shadow-inner select-none overflow-hidden relative">
      {/* Aluminum Hinge Bar */}
      <div className="w-full h-3 bg-gradient-to-b from-[#0F1116] via-[#1E2129] to-[#12141A] border-b border-[#2B303C] flex items-center justify-center">
        <div className="w-32 h-1 bg-[#0A0C10] rounded-full opacity-60"></div>
      </div>

      {/* Keyboard Well */}
      <div className="max-w-4xl mx-auto px-4 py-2 flex flex-col items-center">
        {/* Recessed Keyboard Tray */}
        <div className="w-full bg-[#111318] p-1.5 rounded-lg border border-[#232733] shadow-inner">
          {/* Function keys row */}
          <div className="grid grid-cols-14 gap-1 mb-1 opacity-80">
            {['esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', '⏏'].map((k, i) => (
              <div
                key={i}
                className="h-3.5 bg-[#1B1E26] rounded-[2px] border border-[#2B303D] flex items-center justify-center text-[7px] text-slate-400 font-mono shadow-sm"
              >
                {k}
              </div>
            ))}
          </div>

          {/* Number keys row */}
          <div className="grid grid-cols-14 gap-1 mb-1 opacity-85">
            {['~', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '+', 'delete'].map((k, i) => (
              <div
                key={i}
                className="h-4 bg-[#1E212A] rounded-[2px] border border-[#2E3342] flex items-center justify-center text-[8px] text-slate-300 font-mono shadow-sm"
              >
                {k}
              </div>
            ))}
          </div>

          {/* QWERTY Row */}
          <div className="grid grid-cols-14 gap-1 mb-1 opacity-85">
            {['tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'].map((k, i) => (
              <div
                key={i}
                className="h-4 bg-[#1E212A] rounded-[2px] border border-[#2E3342] flex items-center justify-center text-[8px] text-slate-300 font-mono shadow-sm"
              >
                {k}
              </div>
            ))}
          </div>

          {/* ASDF Row */}
          <div className="grid grid-cols-13 gap-1 mb-1 opacity-85">
            {['caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'return'].map((k, i) => (
              <div
                key={i}
                className="h-4 bg-[#1E212A] rounded-[2px] border border-[#2E3342] flex items-center justify-center text-[8px] text-slate-300 font-mono shadow-sm"
              >
                {k}
              </div>
            ))}
          </div>

          {/* Bottom Spacebar Row */}
          <div className="flex gap-1 items-center justify-between opacity-85">
            <div className="w-12 h-4 bg-[#1E212A] rounded-[2px] border border-[#2E3342] flex items-center justify-center text-[8px] text-slate-400 font-mono">
              shift
            </div>
            <div className="w-8 h-4 bg-[#1E212A] rounded-[2px] border border-[#2E3342] flex items-center justify-center text-[8px] text-slate-400 font-mono">
              fn
            </div>
            <div className="w-8 h-4 bg-[#1E212A] rounded-[2px] border border-[#2E3342] flex items-center justify-center text-[8px] text-slate-400 font-mono">
              control
            </div>
            <div className="w-10 h-4 bg-[#1E212A] rounded-[2px] border border-[#2E3342] flex items-center justify-center text-[8px] text-slate-400 font-mono">
              option
            </div>
            <div className="w-12 h-4 bg-[#1E212A] rounded-[2px] border border-[#2E3342] flex items-center justify-center text-[8px] text-slate-400 font-mono">
              command
            </div>
            {/* Spacebar */}
            <div className="flex-1 h-4 bg-[#1E212A] rounded-[2px] border border-[#2E3342] shadow-sm flex items-center justify-center">
              <div className="w-16 h-0.5 bg-slate-600 rounded-full opacity-40"></div>
            </div>
            <div className="w-12 h-4 bg-[#1E212A] rounded-[2px] border border-[#2E3342] flex items-center justify-center text-[8px] text-slate-400 font-mono">
              command
            </div>
            <div className="w-10 h-4 bg-[#1E212A] rounded-[2px] border border-[#2E3342] flex items-center justify-center text-[8px] text-slate-400 font-mono">
              option
            </div>
            <div className="w-12 h-4 bg-[#1E212A] rounded-[2px] border border-[#2E3342] flex items-center justify-center text-[8px] text-slate-400 font-mono">
              shift
            </div>
          </div>
        </div>

        {/* Centered Glass Trackpad */}
        <div className="w-56 sm:w-64 h-8 mt-1.5 bg-gradient-to-b from-[#181B22] to-[#12141A] rounded-lg border border-[#262B38] shadow-inner flex items-center justify-center">
          <div className="w-12 h-0.5 bg-[#2B303D] rounded-full opacity-50"></div>
        </div>
      </div>
    </div>
  );
};
