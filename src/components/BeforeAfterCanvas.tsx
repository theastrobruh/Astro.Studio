import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Columns2,
  Eye,
  ImagePlus,
  MoveHorizontal,
  Redo2,
  SplitSquareHorizontal,
  Undo2,
} from 'lucide-react';
import { CompareMode } from '../types/editor';

interface BeforeAfterCanvasProps {
  originalCanvas: HTMLCanvasElement | null;
  processedCanvas: HTMLCanvasElement | null;
  intensity: number;
  compareMode: CompareMode;
  onCompareModeChange: (mode: CompareMode) => void;
  onFileDrop: (file: File) => void;
  activePresetName: string;
  imageDimensions: { width: number; height: number } | null;
  isProcessing: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const BeforeAfterCanvas: React.FC<BeforeAfterCanvasProps> = ({
  originalCanvas,
  processedCanvas,
  intensity,
  compareMode,
  onCompareModeChange,
  onFileDrop,
  activePresetName,
  imageDimensions,
  isProcessing,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}) => {
  const [splitPercent, setSplitPercent] = useState<number>(18);
  const [isPeekingOriginal, setIsPeekingOriginal] = useState(false);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const origDisplayRef = useRef<HTMLCanvasElement>(null);
  const procDisplayRef = useRef<HTMLCanvasElement>(null);
  const sideOrigRef = useRef<HTMLCanvasElement>(null);
  const sideProcRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const paint = (src: HTMLCanvasElement | null, dst: HTMLCanvasElement | null) => {
      if (!src || !dst) return;
      if (dst.width !== src.width || dst.height !== src.height) {
        dst.width = src.width;
        dst.height = src.height;
      }
      const ctx = dst.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, dst.width, dst.height);
        ctx.drawImage(src, 0, 0);
      }
    };

    if (compareMode === 'split') {
      paint(originalCanvas, origDisplayRef.current);
      paint(processedCanvas, procDisplayRef.current);
    } else {
      paint(originalCanvas, sideOrigRef.current);
      paint(processedCanvas, sideProcRef.current);
    }
  }, [originalCanvas, processedCanvas, compareMode]);

  const updateSplitFromClientX = useCallback((clientX: number) => {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSplitPercent(Math.max(0, Math.min(100, pct)));
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (compareMode !== 'split') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingSlider(true);
    updateSplitFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSlider || compareMode !== 'split') return;
    updateSplitFromClientX(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSlider) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDraggingSlider(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (compareMode !== 'split') return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSplitPercent((p) => Math.max(0, p - 3));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSplitPercent((p) => Math.min(100, p + 3));
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onFileDrop(file);
    }
  };

  const aspectRatio =
    imageDimensions && imageDimensions.width > 0 && imageDimensions.height > 0
      ? imageDimensions.width / imageDimensions.height
      : 3 / 4;

  const effectiveSplit = isPeekingOriginal ? 100 : splitPercent;

  return (
    <section
      aria-label="Photo editing stage"
      className="flex-1 min-h-0 flex flex-col bg-[#080A0D] overflow-hidden relative"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Centered Full-Viewport Stage */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-3 sm:p-5 lg:p-7 overflow-hidden relative">
        {!originalCanvas ? (
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3">
              <ImagePlus className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-slate-200">Loading studio preview...</p>
          </div>
        ) : compareMode === 'split' ? (
          <div
            ref={stageRef}
            role="slider"
            tabIndex={0}
            aria-label="Before and after comparison slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(effectiveSplit)}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleKeyDown}
            style={{
              aspectRatio: `${aspectRatio}`,
              maxHeight: '100%',
              maxWidth: '100%',
            }}
            className="relative h-full w-auto max-w-full max-h-full select-none touch-none overflow-hidden rounded-xl border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.85)] cursor-ew-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <canvas
              ref={procDisplayRef}
              className="block w-full h-full object-contain pointer-events-none"
            />

            <div
              className="absolute inset-0 overflow-hidden pointer-events-none"
              style={{
                clipPath: `inset(0 ${100 - effectiveSplit}% 0 0)`,
              }}
            >
              <canvas
                ref={origDisplayRef}
                className="block w-full h-full object-contain"
              />
            </div>

            <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-black/75 backdrop-blur-md border border-white/15 text-[10px] font-mono font-semibold tracking-wider text-slate-100 uppercase">
                ORIGINAL
              </span>
            </div>
            <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none">
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-600 text-[10px] font-mono font-semibold tracking-wider text-white uppercase shadow-md shadow-blue-600/30">
                RESULT · {intensity}%
              </span>
            </div>

            {/* Vertical Blue Divider + 44px Touch Handle */}
            <div
              className="absolute top-0 bottom-0 z-20 pointer-events-none"
              style={{ left: `${effectiveSplit}%`, transform: 'translateX(-50%)' }}
            >
              <div className="w-[2px] h-full bg-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.9)]" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#0E1014] border-2 border-blue-400 shadow-[0_0_18px_rgba(37,99,235,0.65)] flex items-center justify-center text-blue-300">
                <MoveHorizontal className="w-4 h-4" />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full max-w-4xl max-h-full items-center">
            <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black max-h-full">
              <canvas
                ref={sideOrigRef}
                className="block w-full h-auto max-h-[calc(100dvh-230px)] object-contain mx-auto"
              />
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 border border-white/15 text-[10px] font-mono font-semibold tracking-wider text-slate-100 uppercase">
                BEFORE
              </span>
            </div>
            <div className="relative rounded-xl overflow-hidden border border-blue-500/35 bg-black max-h-full">
              <canvas
                ref={sideProcRef}
                className="block w-full h-auto max-h-[calc(100dvh-230px)] object-contain mx-auto"
              />
              <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-blue-600 text-[10px] font-mono font-semibold tracking-wider text-white uppercase shadow-md shadow-blue-600/30">
                AFTER · {intensity}%
              </span>
            </div>
          </div>
        )}

        {isDragOver && (
          <div className="absolute inset-4 rounded-xl bg-blue-600/15 border-2 border-dashed border-blue-400 backdrop-blur-sm z-30 flex flex-col items-center justify-center pointer-events-none">
            <ImagePlus className="w-8 h-8 text-blue-300 mb-2" />
            <p className="text-sm font-semibold text-white">Drop photo to edit</p>
          </div>
        )}

        {isProcessing && (
          <div className="absolute bottom-3 right-3 z-20 px-2.5 py-1 rounded-md bg-black/80 border border-white/10 text-[11px] font-mono text-blue-300">
            Updating...
          </div>
        )}
      </div>

      {/* Slim Pressmark Stage Footer Bar */}
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 sm:px-4 py-2 bg-[#101319] border-t border-white/[0.08]">
        <div className="flex items-center gap-1.5 min-w-0">
          {onUndo && onRedo && (
            <div className="inline-flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                aria-label="Undo"
                title="Undo (Ctrl+Z)"
                className="w-8 h-8 rounded-lg bg-[#090B0E] hover:bg-white/[0.06] disabled:opacity-30 border border-white/[0.08] text-slate-200 flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                aria-label="Redo"
                title="Redo (Ctrl+Shift+Z)"
                className="w-8 h-8 rounded-lg bg-[#090B0E] hover:bg-white/[0.06] disabled:opacity-30 border border-white/[0.08] text-slate-200 flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-slate-400 truncate pl-1.5">
            <span className="text-slate-200 font-medium truncate">{activePresetName}</span>
            {imageDimensions && (
              <>
                <span className="hidden sm:inline" aria-hidden="true">
                  ·
                </span>
                <span className="hidden sm:inline font-mono tabular-nums text-[11px]">
                  {imageDimensions.width} × {imageDimensions.height}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {compareMode === 'split' && (
            <button
              type="button"
              onPointerDown={() => setIsPeekingOriginal(true)}
              onPointerUp={() => setIsPeekingOriginal(false)}
              onPointerLeave={() => setIsPeekingOriginal(false)}
              onPointerCancel={() => setIsPeekingOriginal(false)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') setIsPeekingOriginal(true);
              }}
              onKeyUp={() => setIsPeekingOriginal(false)}
              className={`inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer select-none ${
                isPeekingOriginal
                  ? 'bg-blue-600/20 border-blue-400 text-blue-200'
                  : 'bg-[#090B0E] hover:bg-white/[0.06] border-white/[0.1] text-slate-200'
              }`}
              title="Press and hold to view original photo"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Hold Original</span>
              <span className="sm:hidden">Hold</span>
            </button>
          )}

          <div className="inline-flex items-center p-0.5 rounded-lg bg-[#090B0E] border border-white/[0.08]">
            <button
              type="button"
              onClick={() => onCompareModeChange('split')}
              className={`inline-flex items-center gap-1 px-2.5 h-7 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                compareMode === 'split'
                  ? 'bg-[#1A202C] text-blue-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <SplitSquareHorizontal className="w-3.5 h-3.5" />
              Split
            </button>
            <button
              type="button"
              onClick={() => onCompareModeChange('side-by-side')}
              className={`inline-flex items-center gap-1 px-2.5 h-7 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                compareMode === 'side-by-side'
                  ? 'bg-[#1A202C] text-blue-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              2-Up
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
