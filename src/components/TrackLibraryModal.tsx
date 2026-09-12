/**
 * Track Library & Audio Upload Modal
 * Allows selecting preset pro tracks or uploading user audio files (MP3/WAV)
 * with automated BeatGrid onset detection and 3-band waveform extraction.
 */

import React, { useRef, useState } from 'react';
import { DeckId, TrackData } from '../types/dj';
import { X, Upload, Music, Disc3, Check, Loader2 } from 'lucide-react';
import { analyzeUserAudioFile } from '../audio/trackGenerator';

interface TrackLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: TrackData[];
  targetDeck: DeckId;
  onLoadTrack: (deckId: DeckId, track: TrackData) => void;
  onAddTrack: (track: TrackData) => void;
  audioCtx: AudioContext;
}

export const TrackLibraryModal: React.FC<TrackLibraryModalProps> = ({
  isOpen,
  onClose,
  tracks,
  targetDeck,
  onLoadTrack,
  onAddTrack,
  audioCtx
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingFileName, setAnalyzingFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsAnalyzing(true);
      setAnalyzingFileName(file.name);
      const newTrack = await analyzeUserAudioFile(file, audioCtx);
      onAddTrack(newTrack);
      onLoadTrack(targetDeck, newTrack);
      setIsAnalyzing(false);
      onClose();
    } catch (err) {
      console.error('Error analyzing audio file:', err);
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-base text-white">DJ Track Library</h3>
              <p className="text-xs text-slate-400">
                Load track into <span className="font-bold text-amber-400">DECK {targetDeck}</span>
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

        {/* Custom Upload Drop Zone */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/30">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            id="upload-custom-track-btn"
            disabled={isAnalyzing}
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-4 px-4 border-2 border-dashed border-slate-700 hover:border-amber-500/80 rounded-xl bg-slate-900/50 hover:bg-amber-500/5 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group"
          >
            {isAnalyzing ? (
              <div className="flex flex-col items-center gap-2 text-amber-400">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-xs font-mono font-bold">
                  Analyzing WarpMap & Preparing Straight-BPM PCM (WSOLA DSP) for {analyzingFileName}...
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Detecting kicks/snares • Protecting attack transients • Pitch-locked time-stretch
                </span>
              </div>
            ) : (
              <>
                <Upload className="w-6 h-6 text-slate-400 group-hover:text-amber-400 transition-colors" />
                <div className="text-center">
                  <span className="text-xs font-bold text-slate-200 group-hover:text-amber-300">
                    Upload Your Own Audio File (MP3, WAV, OGG, AAC)
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Auto WarpMap • Transient Protection (Kicks & Snares) • Silent Straight-BPM WSOLA Preparation
                  </p>
                </div>
              </>
            )}
          </button>
        </div>

        {/* Preset Tracks List */}
        <div className="p-4 overflow-y-auto flex-1 divide-y divide-slate-800/80">
          {/* Quick Load Test Pair Banner */}
          {tracks.length >= 2 && (
            <div className="mb-4 p-3.5 bg-gradient-to-r from-sky-950/60 via-indigo-950/40 to-pink-950/60 rounded-xl border border-sky-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_0_15px_rgba(56,189,248,0.15)]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 flex-shrink-0">
                  <Music className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-sky-300 uppercase tracking-wider">
                      ⭐️ Synchronisation Test Pair
                    </span>
                    <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-bold">
                      PERFECT RHYTHM LOCK
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    <strong>High School Plumber</strong> (103 BPM Afro-Dancehall) ↔ <strong>Yatapita</strong> (91 BPM Bongo Flava)
                  </p>
                </div>
              </div>

              <button
                id="load-test-pair-modal-btn"
                onClick={() => {
                  const t1 = tracks.find(t => t.id === 'track-high-school-plumber-103') || tracks[0];
                  const t2 = tracks.find(t => t.id === 'track-yatapita-diamond-platnumz-91') || tracks[1];
                  onLoadTrack('A', t1);
                  onLoadTrack('B', t2);
                  onClose();
                }}
                className="w-full sm:w-auto px-3.5 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-mono font-bold rounded-lg shadow-md hover:shadow-[0_0_12px_rgba(56,189,248,0.5)] transition-all active:scale-95 flex items-center justify-center gap-1.5 flex-shrink-0 cursor-pointer"
              >
                <span>⚡️ LOAD TEST PAIR (A & B)</span>
              </button>
            </div>
          )}

          <div className="text-xs font-bold font-mono text-slate-500 uppercase tracking-wider mb-2">
            Built-In Pro Tracks ({tracks.length})
          </div>

          {tracks.map((t) => (
            <div
              key={t.id}
              className={`py-3 flex items-center justify-between gap-3 hover:bg-slate-800/40 px-2 rounded-lg transition-colors group ${
                t.id.includes('track-high-school-plumber') || t.id.includes('track-yatapita')
                  ? 'bg-slate-900/40 border border-sky-500/20 mb-1'
                  : ''
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-amber-400 group-hover:border-amber-500/40 transition-colors flex-shrink-0">
                  <Disc3 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <h4 className="text-sm font-bold text-white truncate">{t.title}</h4>
                    {(t.id.includes('track-high-school-plumber') || t.id.includes('track-yatapita')) && (
                      <span className="text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/40 shrink-0">
                        TEST TRACK
                      </span>
                    )}
                    {t.isStraightened && (
                      <span className="text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/30 shrink-0">
                        STRAIGHT BPM
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    {t.artist} • <span className="text-slate-300">{t.genre}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-right font-mono text-xs hidden sm:block">
                  <div className="font-bold text-amber-400">{t.bpm.toFixed(1)} BPM</div>
                  <div className="text-[11px] text-slate-500">{t.key}</div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    id={`load-track-${t.id}-deck-a`}
                    onClick={() => {
                      onLoadTrack('A', t);
                      onClose();
                    }}
                    className={`px-2.5 py-1 text-xs font-mono font-bold rounded border transition-colors ${
                      targetDeck === 'A'
                        ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500'
                        : 'bg-slate-800 hover:bg-slate-700 text-blue-300 border-slate-700'
                    }`}
                  >
                    DECK A
                  </button>
                  <button
                    id={`load-track-${t.id}-deck-b`}
                    onClick={() => {
                      onLoadTrack('B', t);
                      onClose();
                    }}
                    className={`px-2.5 py-1 text-xs font-mono font-bold rounded border transition-colors ${
                      targetDeck === 'B'
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                        : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border-slate-700'
                    }`}
                  >
                    DECK B
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>All BeatGrids generated in exact 44.1kHz source-sample coordinates</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
