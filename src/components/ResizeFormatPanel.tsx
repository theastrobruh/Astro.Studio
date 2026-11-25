import React from 'react';
import { Link2, Link2Off } from 'lucide-react';
import { RESIZE_PRESETS } from '../data/presets';
import {
  ExportFormatConfig,
  OutputFormat,
  ResizeConfig,
  ResizeFitMode,
} from '../types/editor';
import { computeTargetDimensions } from '../utils/imageProcessor';

interface ResizeFormatPanelProps {
  sourceDimensions: { width: number; height: number } | null;
  resize: ResizeConfig;
  formatConfig: ExportFormatConfig;
  onChangeResize: (patch: Partial<ResizeConfig>) => void;
  onChangeFormat: (patch: Partial<ExportFormatConfig>) => void;
  showCollageOption?: boolean;
}

export const ResizeFormatPanel: React.FC<ResizeFormatPanelProps> = ({
  sourceDimensions,
  resize,
  formatConfig,
  onChangeResize,
  onChangeFormat,
  showCollageOption = true,
}) => {
  const srcW = sourceDimensions?.width || 1080;
  const srcH = sourceDimensions?.height || 1350;
  const targetDims = computeTargetDimensions(srcW, srcH, resize);
  const aspect = srcW / Math.max(1, srcH);

  const selectPreset = (presetId: string) => {
    const p = RESIZE_PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    if (p.id === 'original') {
      onChangeResize({ enabled: false, presetId: 'original' });
    } else {
      onChangeResize({
        enabled: true,
        presetId: p.id,
        width: p.width,
        height: p.height,
        fitMode: p.fitMode,
      });
    }
  };

  const handleWidthChange = (raw: string) => {
    const nextW = Math.max(64, Math.min(8000, parseInt(raw, 10) || 64));
    if (resize.lockAspect) {
      onChangeResize({
        enabled: true,
        presetId: 'custom',
        width: nextW,
        height: Math.max(64, Math.round(nextW / aspect)),
      });
    } else {
      onChangeResize({ enabled: true, presetId: 'custom', width: nextW });
    }
  };

  const handleHeightChange = (raw: string) => {
    const nextH = Math.max(64, Math.min(8000, parseInt(raw, 10) || 64));
    if (resize.lockAspect) {
      onChangeResize({
        enabled: true,
        presetId: 'custom',
        height: nextH,
        width: Math.max(64, Math.round(nextH * aspect)),
      });
    } else {
      onChangeResize({ enabled: true, presetId: 'custom', height: nextH });
    }
  };

  const qualityPct = ((formatConfig.quality - 60) / 40) * 100;

  const formats: { id: OutputFormat; label: string }[] = [
    { id: 'jpeg', label: 'JPEG' },
    { id: 'png', label: 'PNG' },
    { id: 'webp', label: 'WebP' },
    ...(showCollageOption ? [{ id: 'collage' as const, label: 'Before/After' }] : []),
  ];

  return (
    <div className="space-y-5">
      {/* Platform & Web Size Presets */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200">Quick Size Presets</span>
          <span className="text-xs font-mono tabular-nums text-blue-400">
            {targetDims.width} × {targetDims.height} px
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {RESIZE_PRESETS.map((p) => {
            const isActive =
              (!resize.enabled && p.id === 'original') ||
              (resize.enabled && resize.presetId === p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPreset(p.id)}
                className={`p-3 min-h-[54px] rounded-xl border text-left transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-blue-600/15 border-blue-500 text-white'
                    : 'bg-[#090B0E] border-white/[0.08] hover:border-white/25 text-slate-300'
                }`}
              >
                <div className="text-xs font-semibold truncate">{p.platform}</div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">{p.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Dimensions & Fit Mode */}
      <div className="space-y-3 pt-4 border-t border-white/[0.08]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200">Custom Size</span>
          <button
            type="button"
            onClick={() => onChangeResize({ lockAspect: !resize.lockAspect })}
            className={`inline-flex items-center gap-1.5 px-3 min-h-[34px] rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
              resize.lockAspect
                ? 'bg-blue-600/15 border-blue-500/40 text-blue-300'
                : 'bg-[#090B0E] border-white/[0.08] text-slate-400'
            }`}
          >
            {resize.lockAspect ? <Link2 className="w-3.5 h-3.5" /> : <Link2Off className="w-3.5 h-3.5" />}
            {resize.lockAspect ? 'Ratio Locked' : 'Free Ratio'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label htmlFor="resize-w" className="block text-[11px] text-slate-400 font-mono">
              Width (px)
            </label>
            <input
              id="resize-w"
              type="number"
              min={64}
              max={8000}
              value={resize.enabled ? resize.width : srcW}
              onChange={(e) => handleWidthChange(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#090B0E] border border-white/[0.08] text-xs font-mono tabular-nums text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="resize-h" className="block text-[11px] text-slate-400 font-mono">
              Height (px)
            </label>
            <input
              id="resize-h"
              type="number"
              min={64}
              max={8000}
              value={resize.enabled ? resize.height : srcH}
              onChange={(e) => handleHeightChange(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#090B0E] border border-white/[0.08] text-xs font-mono tabular-nums text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {resize.enabled && (
          <div className="space-y-1.5">
            <span className="block text-xs text-slate-300 font-medium">How to Fit</span>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#090B0E] border border-white/[0.08]">
              {(
                [
                  { id: 'cover', label: 'Crop Fill' },
                  { id: 'contain', label: 'Fit Inside' },
                  { id: 'max-width', label: 'Max Width' },
                ] as { id: ResizeFitMode; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChangeResize({ fitMode: m.id })}
                  className={`min-h-[36px] px-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    resize.fitMode === m.id
                      ? 'bg-[#1A202C] text-blue-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Format & Compression Quality */}
      <div className="space-y-3 pt-4 border-t border-white/[0.08]">
        <span className="block text-xs font-semibold text-slate-200">File Type</span>
        <div
          className={`grid gap-1 p-1 rounded-xl bg-[#090B0E] border border-white/[0.08] ${
            formats.length === 4 ? 'grid-cols-4' : 'grid-cols-3'
          }`}
        >
          {formats.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onChangeFormat({ format: f.id })}
              className={`min-h-[38px] px-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                formatConfig.format === f.id
                  ? 'bg-[#1A202C] text-blue-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {formatConfig.format !== 'png' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-200 font-medium">Image Quality</span>
              <span className="font-mono tabular-nums text-xs text-blue-400">
                {formatConfig.quality}%
              </span>
            </div>
            <input
              type="range"
              min={60}
              max={100}
              step={1}
              value={formatConfig.quality}
              aria-label="Export Quality"
              onChange={(e) => onChangeFormat({ quality: parseInt(e.target.value, 10) })}
              style={{
                background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${qualityPct}%, #1E2430 ${qualityPct}%, #1E2430 100%)`,
              }}
              className="studio-slider"
            />
          </div>
        )}
      </div>
    </div>
  );
};
