/**
 * Software Top Navigation Bar
 * Exactly matches the top navigation in the user's reference image:
 * "DJ IMAN", "[SONG LIST]" in glowing blue border, "BROWSE", "LIBRARY",
 * "PERFORMANCE", "SETTINGS", Search, Master Filter, Settings gear, and Digital Clock.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Search, Sliders, Settings, Music, Disc, Layers, Grid, Upload } from 'lucide-react';

interface DjTopNavProps {
  onOpenSongList: () => void;
  onOpenSettings: () => void;
  activeTab: 'songlist' | 'browse' | 'library' | 'performance' | 'settings';
  setActiveTab: (tab: 'songlist' | 'browse' | 'library' | 'performance' | 'settings') => void;
  isLooperBoardOpen: boolean;
  onToggleLooperBoard: (mode?: 'looper' | 'sampler') => void;
  onUploadLoopFile: (file: File) => void;
  onUploadSampleFile: (file: File) => void;
  isLooperPlaying?: boolean;
  isSamplerPlaying?: boolean;
}

export const DjTopNav: React.FC<DjTopNavProps> = ({
  onOpenSongList,
  onOpenSettings,
  activeTab,
  setActiveTab,
  isLooperBoardOpen,
  onToggleLooperBoard,
  onUploadLoopFile,
  onUploadSampleFile,
  isLooperPlaying,
  isSamplerPlaying
}) => {
  const [currentTimeStr, setCurrentTimeStr] = useState('10:24 PM');
  const looperFileInputRef = useRef<HTMLInputElement | null>(null);
  const samplerFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // hour '0' should be '12'
      const minutesStr = minutes < 10 ? '0' + minutes : minutes;
      setCurrentTimeStr(`${hours}:${minutesStr} ${ampm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="w-full bg-[#07090E] border-b border-[#1A1F2C] px-3 sm:px-5 py-2 flex items-center justify-between select-none z-30 shadow-md">
      {/* Brand Title */}
      <div className="flex items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-1.5 cursor-pointer">
          <h1 className="text-white font-black text-lg sm:text-xl tracking-wider uppercase font-sans drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
            DJ IMAN
          </h1>
        </div>

        {/* Navigation items */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {/* SONG LIST button with prominent bright blue glowing outline */}
          <button
            id="nav-song-list-btn"
            onClick={() => {
              setActiveTab('songlist');
              onOpenSongList();
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] sm:text-xs font-bold font-mono uppercase tracking-wider text-sky-300 bg-sky-950/60 border-2 border-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.45)] hover:bg-sky-900/80 hover:text-white transition-all active:scale-95"
          >
            <Music className="w-3 h-3 text-sky-400 animate-pulse" />
            <span>SONG LIST</span>
          </button>

          <button
            id="nav-browse-btn"
            onClick={() => {
              setActiveTab('browse');
              onOpenSongList();
            }}
            className={`px-2.5 py-1 rounded text-[11px] sm:text-xs font-semibold tracking-wider transition-colors uppercase ${
              activeTab === 'browse'
                ? 'text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            BROWSE
          </button>

          <button
            id="nav-library-btn"
            onClick={() => {
              setActiveTab('library');
              onOpenSongList();
            }}
            className={`px-2.5 py-1 rounded text-[11px] sm:text-xs font-semibold tracking-wider transition-colors uppercase ${
              activeTab === 'library'
                ? 'text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            LIBRARY
          </button>

          <button
            id="nav-performance-btn"
            onClick={() => setActiveTab('performance')}
            className={`hidden md:inline-block px-2.5 py-1 rounded text-[11px] sm:text-xs font-semibold tracking-wider transition-colors uppercase ${
              activeTab === 'performance'
                ? 'text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            PERFORMANCE
          </button>

          <button
            id="nav-settings-tab-btn"
            onClick={() => {
              setActiveTab('settings');
              onOpenSettings();
            }}
            className={`hidden md:inline-block px-2.5 py-1 rounded text-[11px] sm:text-xs font-semibold tracking-wider transition-colors uppercase ${
              activeTab === 'settings'
                ? 'text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            SETTINGS
          </button>
        </nav>
      </div>

      {/* Center/Right Socket Action Buttons & Utility Controls */}
      <div className="flex items-center gap-2 sm:gap-3 text-slate-300">
        {/* Hidden File Inputs for Direct Local Storage Upload */}
        <input
          type="file"
          accept="audio/*,.wav,.mp3,.ogg,.flac,.aiff,.m4a"
          ref={looperFileInputRef}
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              onUploadLoopFile(e.target.files[0]);
              // Reset so same file can be re-selected if desired
              e.target.value = '';
            }
          }}
        />
        <input
          type="file"
          accept="audio/*,.wav,.mp3,.ogg,.flac,.aiff,.m4a"
          ref={samplerFileInputRef}
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              onUploadSampleFile(e.target.files[0]);
              e.target.value = '';
            }
          }}
        />

        {/* LOOPER SOCKET BUTTON */}
        <div className="flex items-center rounded-lg bg-amber-950/40 border border-amber-500/60 p-0.5 shadow-[0_0_10px_rgba(245,158,11,0.25)]">
          <button
            id="nav-looper-socket-toggle-btn"
            onClick={() => onToggleLooperBoard('looper')}
            title="Toggle Audio Sample Looper Board"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-bold font-mono uppercase tracking-wider transition-all ${
              isLooperBoardOpen
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-amber-300 hover:text-white hover:bg-amber-900/50'
            }`}
          >
            <Layers className="w-3 h-3 text-amber-400" />
            <span>LOOPER</span>
            {isLooperPlaying && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            )}
          </button>
          <button
            id="nav-looper-socket-upload-btn"
            onClick={() => {
              onToggleLooperBoard('looper');
              looperFileInputRef.current?.click();
            }}
            title="Upload audio loop from local storage (perfectly tempo-matched to songs)"
            className="p-1 px-1.5 rounded-r-md text-[10px] font-mono text-amber-300 hover:text-white hover:bg-amber-600/60 transition-all border-l border-amber-500/40 flex items-center gap-1"
          >
            <Upload className="w-3 h-3" />
            <span className="hidden sm:inline font-bold">SOCKET</span>
          </button>
        </div>

        {/* SAMPLER SOCKET BUTTON */}
        <div className="flex items-center rounded-lg bg-purple-950/40 border border-purple-500/60 p-0.5 shadow-[0_0_10px_rgba(168,85,247,0.25)]">
          <button
            id="nav-sampler-socket-toggle-btn"
            onClick={() => onToggleLooperBoard('sampler')}
            title="Toggle Performance Sample Pad Board"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-bold font-mono uppercase tracking-wider transition-all ${
              isLooperBoardOpen
                ? 'bg-purple-600 text-white font-black shadow-sm'
                : 'text-purple-300 hover:text-white hover:bg-purple-900/50'
            }`}
          >
            <Grid className="w-3 h-3 text-purple-400" />
            <span>SAMPLER</span>
            {isSamplerPlaying && (
              <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-ping" />
            )}
          </button>
          <button
            id="nav-sampler-socket-upload-btn"
            onClick={() => {
              onToggleLooperBoard('sampler');
              samplerFileInputRef.current?.click();
            }}
            title="Upload audio sample from local storage to pad"
            className="p-1 px-1.5 rounded-r-md text-[10px] font-mono text-purple-300 hover:text-white hover:bg-purple-600/60 transition-all border-l border-purple-500/40 flex items-center gap-1"
          >
            <Upload className="w-3 h-3" />
            <span className="hidden sm:inline font-bold">SOCKET</span>
          </button>
        </div>

        {/* Right tools */}
        <button
          id="nav-search-btn"
          onClick={onOpenSongList}
          title="Search Library"
          className="p-1 text-slate-400 hover:text-white transition-colors"
        >
          <Search className="w-4 h-4" />
        </button>

        <button
          id="nav-master-filter-btn"
          title="Master Filter Active"
          className="p-1 text-slate-400 hover:text-sky-400 transition-colors"
        >
          <Sliders className="w-4 h-4" />
        </button>

        <button
          id="nav-settings-gear-btn"
          onClick={onOpenSettings}
          title="Open Diagnostics & Specs"
          className="p-1 text-slate-400 hover:text-white transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Live digital clock */}
        <div className="text-xs font-mono text-slate-300 tracking-wider font-semibold pl-1">
          {currentTimeStr}
        </div>
      </div>
    </header>
  );
};
