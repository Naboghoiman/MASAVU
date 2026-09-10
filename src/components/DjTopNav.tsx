/**
 * Software Top Navigation Bar
 * Exactly matches the top navigation in the user's reference image:
 * "DJ IMAN", "[SONG LIST]" in glowing blue border, "BROWSE", "LIBRARY",
 * "PERFORMANCE", "SETTINGS", Search, Master Filter, Settings gear, and Digital Clock.
 */

import React, { useEffect, useState } from 'react';
import { Search, Sliders, Settings, Music, Disc } from 'lucide-react';

interface DjTopNavProps {
  onOpenSongList: () => void;
  onOpenSettings: () => void;
  activeTab: 'songlist' | 'browse' | 'library' | 'performance' | 'settings';
  setActiveTab: (tab: 'songlist' | 'browse' | 'library' | 'performance' | 'settings') => void;
}

export const DjTopNav: React.FC<DjTopNavProps> = ({
  onOpenSongList,
  onOpenSettings,
  activeTab,
  setActiveTab
}) => {
  const [currentTimeStr, setCurrentTimeStr] = useState('10:24 PM');

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

      {/* Right controls */}
      <div className="flex items-center gap-3 sm:gap-4 text-slate-300">
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
