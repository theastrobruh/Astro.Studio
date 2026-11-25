import React, { useRef, useState } from 'react';
import {
  ChevronDown,
  Grid3X3,
  Image as ImageIcon,
  RotateCcw,
  Stamp,
  Type,
  Upload,
} from 'lucide-react';
import { WATERMARK_FONTS, WATERMARK_PRESETS } from '../data/presets';
import {
  DEFAULT_WATERMARK_CONFIG,
  WatermarkConfig,
  WatermarkFontFamily,
  WatermarkPosition,
  WatermarkStyleMode,
} from '../types/editor';

interface WatermarkPanelProps {
  watermark: WatermarkConfig;
  onChange: (next: WatermarkConfig) => void;
}

const POSITION_GRID: { id: WatermarkPosition; glyph: string; label: string }[] = [
  { id: 'top-left', glyph: '↖', label: 'Top Left' },
  { id: 'top-center', glyph: '↑', label: 'Top Center' },
  { id: 'top-right', glyph: '↗', label: 'Top Right' },
  { id: 'mid-left', glyph: '←', label: 'Middle Left' },
  { id: 'center', glyph: '•', label: 'Center' },
  { id: 'mid-right', glyph: '→', label: 'Middle Right' },
  { id: 'bottom-left', glyph: '↙', label: 'Bottom Left' },
  { id: 'bottom-center', glyph: '↓', label: 'Bottom Center' },
  { id: 'bottom-right', glyph: '↘', label: 'Bottom Right' },
];

const COLOR_SWATCHES = ['#FFFFFF', '#000000', '#38BDF8', '#F59E0B', '#F43F5E', '#A3E635'];
const BADGE_SWATCHES = ['#0F172A', '#FFFFFF', '#0284C7', '#18181B', '#7F1D1D'];

export const WatermarkPanel: React.FC<WatermarkPanelProps> = ({ watermark, onChange }) => {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const update = (patch: Partial<WatermarkConfig>) => {
    onChange({ ...watermark, ...patch });
  };

  const handleLogoUpload = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (watermark.logoUrl) URL.revokeObjectURL(watermark.logoUrl);
    const url = URL.createObjectURL(file);
    update({
      enabled: true,
      styleMode: 'logo',
      logoUrl: url,
      logoName: file.name,
    });
  };

  const pct = (val: number, min: number, max: number) => ((val - min) / (max - min)) * 100;

  return (
    <div className="space-y-4">
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleLogoUpload(f);
          e.target.value = '';
        }}
      />

      {/* Enable + Reset Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
        <div>
          <p className="text-sm font-semibold text-white">
            Watermark {watermark.enabled ? 'On' : 'Off'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Sign your photo with text, a badge, or a logo
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onChange(DEFAULT_WATERMARK_CONFIG)}
            title="Reset watermark"
            aria-label="Reset watermark"
            className="w-10 h-10 rounded-xl bg-[#090B0E] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={watermark.enabled}
            aria-label="Toggle watermark"
            onClick={() => update({ enabled: !watermark.enabled })}
            className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
              watermark.enabled ? 'bg-blue-600' : 'bg-[#1E2430]'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                watermark.enabled ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 1. Quick Styles */}
      <div className="space-y-2">
        <span className="block text-xs font-semibold text-slate-200">Quick Styles</span>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {WATERMARK_PRESETS.map((wp) => (
            <button
              key={wp.id}
              type="button"
              onClick={() => update(wp.patch)}
              className="px-3 min-h-[36px] rounded-xl bg-[#090B0E] hover:bg-white/[0.06] border border-white/[0.08] text-xs font-medium text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {wp.name}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Mode & Content */}
      <div className="space-y-3 pt-3 border-t border-white/[0.08]">
        <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#090B0E] border border-white/[0.08]">
          {(
            [
              { id: 'text', label: 'Text', icon: Type },
              { id: 'badge', label: 'Badge', icon: Stamp },
              { id: 'tiled', label: 'Tiled', icon: Grid3X3 },
              { id: 'logo', label: 'Logo', icon: ImageIcon },
            ] as { id: WatermarkStyleMode; label: string; icon: React.FC<{ className?: string }> }[]
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => update({ styleMode: id, enabled: true })}
              className={`inline-flex items-center justify-center gap-1.5 min-h-[36px] px-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                watermark.styleMode === id
                  ? 'bg-[#1A202C] text-blue-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {watermark.styleMode === 'logo' ? (
          <div className="rounded-xl bg-[#090B0E] border border-white/[0.08] p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-300 truncate">
                {watermark.logoName || 'Choose a PNG or SVG logo'}
              </span>
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 min-h-[38px] rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                {watermark.logoUrl ? 'Change' : 'Upload Logo'}
              </button>
            </div>
            {watermark.logoUrl && (
              <div className="h-14 rounded-lg bg-[#080A0D] flex items-center justify-center p-2">
                <img
                  src={watermark.logoUrl}
                  alt="Watermark logo preview"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="space-y-1">
              <label htmlFor="wm-text" className="block text-xs font-medium text-slate-300">
                Your Text or Name
              </label>
              <input
                id="wm-text"
                type="text"
                maxLength={48}
                value={watermark.text}
                onChange={(e) => update({ text: e.target.value, enabled: true })}
                placeholder="Astro.Studio"
                className="w-full h-10 px-3 rounded-xl bg-[#090B0E] border border-white/[0.08] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {watermark.styleMode === 'badge' && (
              <div className="space-y-1">
                <label htmlFor="wm-subtext" className="block text-xs font-medium text-slate-300">
                  Second Line (optional)
                </label>
                <input
                  id="wm-subtext"
                  type="text"
                  maxLength={48}
                  value={watermark.subtext}
                  onChange={(e) => update({ subtext: e.target.value, enabled: true })}
                  placeholder="35mm Color Lab"
                  className="w-full h-10 px-3 rounded-xl bg-[#090B0E] border border-white/[0.08] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            {/* Color Swatches */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-xs font-medium text-slate-300">Color</span>
              <div className="flex items-center gap-2">
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Color ${c}`}
                    onClick={() => update({ color: c, enabled: true })}
                    style={{ backgroundColor: c }}
                    className={`w-7 h-7 rounded-full border transition-transform cursor-pointer ${
                      watermark.color.toUpperCase() === c
                        ? 'border-blue-400 scale-110 ring-2 ring-blue-400/35'
                        : 'border-white/25'
                    }`}
                  />
                ))}
                <input
                  type="color"
                  aria-label="Custom text color"
                  value={watermark.color}
                  onChange={(e) => update({ color: e.target.value, enabled: true })}
                  className="w-8 h-8 rounded-lg bg-transparent border border-white/15 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Position Pad (Visual 3x3) + Size & Opacity */}
      <div className="space-y-3.5 pt-3 border-t border-white/[0.08]">
        {watermark.styleMode === 'tiled' ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-200 font-medium">Tile Density</span>
              <span className="font-mono tabular-nums text-blue-400">
                {watermark.tileDensity} × {watermark.tileDensity}
              </span>
            </div>
            <input
              type="range"
              min={2}
              max={5}
              step={1}
              value={watermark.tileDensity}
              onChange={(e) => update({ tileDensity: parseInt(e.target.value, 10), enabled: true })}
              style={{
                background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${pct(
                  watermark.tileDensity,
                  2,
                  5
                )}%, #1E2430 ${pct(watermark.tileDensity, 2, 5)}%, #1E2430 100%)`,
              }}
              className="studio-slider"
            />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="block text-xs font-semibold text-slate-200">Position</span>
              <span className="block text-[11px] text-slate-400 mt-0.5">
                {POSITION_GRID.find((p) => p.id === watermark.position)?.label}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 w-36 shrink-0">
              {POSITION_GRID.map((pos) => {
                const active = watermark.position === pos.id;
                return (
                  <button
                    key={pos.id}
                    type="button"
                    aria-label={pos.label}
                    title={pos.label}
                    onClick={() => update({ position: pos.id, enabled: true })}
                    className={`h-9 rounded-lg text-sm font-semibold border transition-colors cursor-pointer flex items-center justify-center ${
                      active
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-[#090B0E] border-white/[0.08] text-slate-400 hover:text-white'
                    }`}
                  >
                    {pos.glyph}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-200 font-medium">Size</span>
            <span className="font-mono tabular-nums text-blue-400">
              {watermark.scale.toFixed(1)}%
            </span>
          </div>
          <input
            type="range"
            min={1.2}
            max={8.0}
            step={0.2}
            value={watermark.scale}
            onChange={(e) => update({ scale: parseFloat(e.target.value), enabled: true })}
            style={{
              background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${pct(
                watermark.scale,
                1.2,
                8.0
              )}%, #1E2430 ${pct(watermark.scale, 1.2, 8.0)}%, #1E2430 100%)`,
            }}
            className="studio-slider"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-200 font-medium">Opacity</span>
            <span className="font-mono tabular-nums text-blue-400">{watermark.opacity}%</span>
          </div>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={watermark.opacity}
            onChange={(e) => update({ opacity: parseInt(e.target.value, 10), enabled: true })}
            style={{
              background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${pct(
                watermark.opacity,
                10,
                100
              )}%, #1E2430 ${pct(watermark.opacity, 10, 100)}%, #1E2430 100%)`,
            }}
            className="studio-slider"
          />
        </div>
      </div>

      {/* 4. Collapsible More Options (Fonts, Badge, Angle, Spacing, Shadow/Outline) */}
      <div className="pt-2 border-t border-white/[0.08]">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="w-full py-2 flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
        >
          <span>More Options (Font, Angle, Effects)</span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${
              showAdvanced ? 'rotate-180' : ''
            }`}
          />
        </button>

        {showAdvanced && (
          <div className="space-y-3.5 pt-2">
            {watermark.styleMode !== 'logo' && (
              <>
                <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                  <div className="space-y-1">
                    <label htmlFor="wm-font" className="block text-xs font-medium text-slate-300">
                      Font Style
                    </label>
                    <select
                      id="wm-font"
                      value={watermark.fontFamily}
                      onChange={(e) =>
                        update({ fontFamily: e.target.value as WatermarkFontFamily, enabled: true })
                      }
                      className="w-full h-10 px-2.5 rounded-xl bg-[#090B0E] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {WATERMARK_FONTS.map((f) => (
                        <option key={f.id} value={f.id} className="bg-[#11141B]">
                          {f.label} ({f.category})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => update({ italic: !watermark.italic, enabled: true })}
                      className={`h-10 px-3 rounded-xl border text-xs font-serif italic transition-colors cursor-pointer ${
                        watermark.italic
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                          : 'bg-[#090B0E] border-white/[0.08] text-slate-400'
                      }`}
                      title="Italic"
                    >
                      I
                    </button>
                    <button
                      type="button"
                      onClick={() => update({ uppercase: !watermark.uppercase, enabled: true })}
                      className={`h-10 px-3 rounded-xl border text-xs font-mono font-semibold transition-colors cursor-pointer ${
                        watermark.uppercase
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                          : 'bg-[#090B0E] border-white/[0.08] text-slate-400'
                      }`}
                      title="All Caps"
                    >
                      AA
                    </button>
                  </div>
                </div>

                {watermark.styleMode === 'badge' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <span className="block text-xs font-medium text-slate-300">Badge Fill</span>
                      <div className="flex items-center gap-1.5">
                        {BADGE_SWATCHES.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => update({ badgeColor: c, enabled: true })}
                            style={{ backgroundColor: c }}
                            className={`w-6 h-6 rounded-md border cursor-pointer ${
                              watermark.badgeColor.toUpperCase() === c
                                ? 'border-blue-400 ring-1 ring-blue-400'
                                : 'border-white/25'
                            }`}
                          />
                        ))}
                        <input
                          type="color"
                          aria-label="Custom badge color"
                          value={watermark.badgeColor}
                          onChange={(e) => update({ badgeColor: e.target.value, enabled: true })}
                          className="w-7 h-7 rounded bg-transparent border border-white/15 cursor-pointer"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300">Roundness</span>
                        <span className="font-mono tabular-nums text-blue-400">
                          {watermark.badgeRadius}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={24}
                        step={1}
                        value={watermark.badgeRadius}
                        onChange={(e) =>
                          update({ badgeRadius: parseInt(e.target.value, 10), enabled: true })
                        }
                        style={{
                          background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${pct(
                            watermark.badgeRadius,
                            0,
                            24
                          )}%, #1E2430 ${pct(watermark.badgeRadius, 0, 24)}%, #1E2430 100%)`,
                        }}
                        className="studio-slider"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">Tilt Angle</span>
                  <span className="font-mono tabular-nums text-blue-400">{watermark.rotation}°</span>
                </div>
                <input
                  type="range"
                  min={-45}
                  max={45}
                  step={1}
                  value={watermark.rotation}
                  onChange={(e) => update({ rotation: parseInt(e.target.value, 10), enabled: true })}
                  style={{
                    background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${pct(
                      watermark.rotation,
                      -45,
                      45
                    )}%, #1E2430 ${pct(watermark.rotation, -45, 45)}%, #1E2430 100%)`,
                  }}
                  className="studio-slider"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">Edge Space</span>
                  <span className="font-mono tabular-nums text-blue-400">{watermark.marginPct}%</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={12}
                  step={1}
                  value={watermark.marginPct}
                  onChange={(e) => update({ marginPct: parseInt(e.target.value, 10), enabled: true })}
                  style={{
                    background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${pct(
                      watermark.marginPct,
                      1,
                      12
                    )}%, #1E2430 ${pct(watermark.marginPct, 1, 12)}%, #1E2430 100%)`,
                  }}
                  className="studio-slider"
                />
              </div>
            </div>

            {watermark.styleMode !== 'logo' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">Letter Spacing</span>
                  <span className="font-mono tabular-nums text-blue-400">
                    {watermark.letterSpacing}px
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={watermark.letterSpacing}
                  onChange={(e) =>
                    update({ letterSpacing: parseInt(e.target.value, 10), enabled: true })
                  }
                  style={{
                    background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${pct(
                      watermark.letterSpacing,
                      0,
                      10
                    )}%, #1E2430 ${pct(watermark.letterSpacing, 0, 10)}%, #1E2430 100%)`,
                  }}
                  className="studio-slider"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => update({ shadowEnabled: !watermark.shadowEnabled, enabled: true })}
                className={`min-h-[40px] px-3 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                  watermark.shadowEnabled
                    ? 'bg-blue-600/15 border-blue-500 text-blue-300'
                    : 'bg-[#090B0E] border-white/[0.08] text-slate-400'
                }`}
              >
                Shadow: {watermark.shadowEnabled ? 'On' : 'Off'}
              </button>
              {watermark.styleMode !== 'logo' && watermark.styleMode !== 'badge' && (
                <button
                  type="button"
                  onClick={() => update({ outlineEnabled: !watermark.outlineEnabled, enabled: true })}
                  className={`min-h-[40px] px-3 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                    watermark.outlineEnabled
                      ? 'bg-blue-600/15 border-blue-500 text-blue-300'
                      : 'bg-[#090B0E] border-white/[0.08] text-slate-400'
                  }`}
                >
                  Outline: {watermark.outlineEnabled ? 'On' : 'Off'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
