import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { DEFAULT_FILTER_SETTINGS, FilterSettings, ToneCurves } from '../types/editor';
import { ToneCurveEditor } from './ToneCurveEditor';

interface AdjustmentPanelProps {
  settings: FilterSettings;
  onChange: (key: keyof FilterSettings, value: number) => void;
  onChangeCurves: (curves: ToneCurves) => void;
  onResetAll: () => void;
}

type AdjustGroup = 'light' | 'color' | 'detail' | 'curves';

interface SliderConfig {
  key: keyof FilterSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  format?: (val: number) => string;
}

const LIGHT_SLIDERS: SliderConfig[] = [
  {
    key: 'brightness',
    label: 'Brightness',
    min: -50,
    max: 50,
    step: 1,
    format: (v) => `${v > 0 ? '+' : ''}${Math.round(v)}`,
  },
  {
    key: 'contrast',
    label: 'Contrast',
    min: -50,
    max: 50,
    step: 1,
    format: (v) => `${v > 0 ? '+' : ''}${Math.round(v)}`,
  },
  {
    key: 'highlights',
    label: 'Highlights',
    min: -100,
    max: 100,
    step: 1,
    format: (v) => `${v > 0 ? '+' : ''}${Math.round(v)}`,
  },
  {
    key: 'shadows',
    label: 'Shadows',
    min: -100,
    max: 100,
    step: 1,
    format: (v) => `${v > 0 ? '+' : ''}${Math.round(v)}`,
  },
  {
    key: 'whites',
    label: 'Whites',
    min: -50,
    max: 50,
    step: 1,
    format: (v) => `${v > 0 ? '+' : ''}${Math.round(v)}`,
  },
  {
    key: 'blacks',
    label: 'Blacks',
    min: -50,
    max: 50,
    step: 1,
    format: (v) => `${v > 0 ? '+' : ''}${Math.round(v)}`,
  },
  {
    key: 'exposure',
    label: 'Exposure',
    min: -2.0,
    max: 2.0,
    step: 0.05,
    format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(2)} EV`,
  },
];

const COLOR_SLIDERS: SliderConfig[] = [
  {
    key: 'saturation',
    label: 'Saturation',
    min: -50,
    max: 50,
    step: 1,
    format: (v) => `${v > 0 ? '+' : ''}${Math.round(v)}`,
  },
  {
    key: 'vibrance',
    label: 'Vibrance',
    min: -50,
    max: 50,
    step: 1,
    format: (v) => `${v > 0 ? '+' : ''}${Math.round(v)}`,
  },
  {
    key: 'temperature',
    label: 'Warmth',
    min: -50,
    max: 50,
    step: 1,
    format: (v) => `${v > 0 ? '+' : ''}${Math.round(v)}`,
  },
  {
    key: 'tint',
    label: 'Tint',
    min: -50,
    max: 50,
    step: 1,
    format: (v) => `${v > 0 ? '+' : ''}${Math.round(v)}`,
  },
  {
    key: 'grain',
    label: 'Film Grain',
    min: 0,
    max: 100,
    step: 1,
    format: (v) => `${Math.round(v)}`,
  },
  {
    key: 'vignette',
    label: 'Edge Vignette',
    min: 0,
    max: 100,
    step: 1,
    format: (v) => `${Math.round(v)}`,
  },
];

const DETAIL_SLIDERS: SliderConfig[] = [
  {
    key: 'sharpen',
    label: 'Sharpen',
    min: 0,
    max: 100,
    step: 1,
    format: (v) => `${Math.round(v)}`,
  },
  {
    key: 'structure',
    label: 'Clarity / Structure',
    min: -50,
    max: 100,
    step: 1,
    format: (v) => `${v > 0 ? '+' : ''}${Math.round(v)}`,
  },
  {
    key: 'fade',
    label: 'Soft Fade',
    min: 0,
    max: 100,
    step: 1,
    format: (v) => `${Math.round(v)}`,
  },
  {
    key: 'shadowCrispness',
    label: 'Shadow Crispness',
    min: 0,
    max: 100,
    step: 1,
    format: (v) => `${Math.round(v)}`,
  },
  {
    key: 'subjectGlow',
    label: 'Subject Pop',
    min: 0,
    max: 100,
    step: 1,
    format: (v) => `${Math.round(v)}`,
  },
  {
    key: 'backgroundEv',
    label: 'Background Depth',
    min: -3.0,
    max: 1.0,
    step: 0.1,
    format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} EV`,
  },
];

export const AdjustmentPanel: React.FC<AdjustmentPanelProps> = ({
  settings,
  onChange,
  onChangeCurves,
  onResetAll,
}) => {
  const [group, setGroup] = useState<AdjustGroup>('light');

  const activeSliders =
    group === 'light'
      ? LIGHT_SLIDERS
      : group === 'color'
      ? COLOR_SLIDERS
      : DETAIL_SLIDERS;

  return (
    <div className="flex flex-col gap-4">
      {/* Clean Sub-Tab Selector + Reset All */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#090B0E] border border-white/[0.08]">
          {(
            [
              { id: 'light', label: 'Light' },
              { id: 'color', label: 'Color' },
              { id: 'detail', label: 'Detail' },
              { id: 'curves', label: 'Curves' },
            ] as { id: AdjustGroup; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setGroup(t.id)}
              className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                group === t.id
                  ? 'bg-[#1A202C] text-blue-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onResetAll}
          title="Reset all adjustments"
          className="inline-flex items-center gap-1.5 px-3 h-10 rounded-xl bg-[#090B0E] hover:bg-white/[0.06] border border-white/[0.08] text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>

      {/* Active Controls */}
      {group === 'curves' ? (
        <ToneCurveEditor curves={settings.curves} onChange={onChangeCurves} />
      ) : (
        <div className="space-y-4">
          {activeSliders.map((item) => {
            const val = (settings[item.key] as number) ?? 0;
            const defaultVal = DEFAULT_FILTER_SETTINGS[item.key] as number;
            const isModified = Math.abs(val - defaultVal) > 0.001;
            const pct = ((val - item.min) / (item.max - item.min)) * 100;

            return (
              <div key={item.key} className="space-y-2 py-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-200 font-medium">{item.label}</span>
                  <div className="flex items-center gap-2">
                    {isModified && (
                      <button
                        type="button"
                        onClick={() => onChange(item.key, defaultVal)}
                        aria-label={`Reset ${item.label}`}
                        className="w-6 h-6 rounded-md text-slate-400 hover:text-blue-300 hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer"
                        title="Reset this slider"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                    <span
                      className={`font-mono tabular-nums text-xs ${
                        isModified ? 'text-blue-400 font-semibold' : 'text-slate-400'
                      }`}
                    >
                      {item.format ? item.format(val) : val}
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min={item.min}
                  max={item.max}
                  step={item.step}
                  value={val}
                  aria-label={item.label}
                  onChange={(e) => onChange(item.key, parseFloat(e.target.value))}
                  onDoubleClick={() => onChange(item.key, defaultVal)}
                  style={{
                    background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${pct}%, #1E2430 ${pct}%, #1E2430 100%)`,
                  }}
                  className="studio-slider"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
