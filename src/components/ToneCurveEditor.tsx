import React, { useMemo, useRef, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { CurvePoint, DEFAULT_TONE_CURVES, ToneCurves } from '../types/editor';
import { buildCurveLut } from '../utils/imageProcessor';

type CurveChannel = keyof ToneCurves;

interface ToneCurveEditorProps {
  curves: ToneCurves;
  onChange: (next: ToneCurves) => void;
}

const CHANNELS: { id: CurveChannel; label: string; stroke: string }[] = [
  { id: 'rgb', label: 'All (RGB)', stroke: '#E2E8F0' },
  { id: 'red', label: 'Red', stroke: '#F87171' },
  { id: 'green', label: 'Green', stroke: '#4ADE80' },
  { id: 'blue', label: 'Blue', stroke: '#38BDF8' },
];

const CURVE_PRESETS: { label: string; points: CurvePoint[] }[] = [
  {
    label: 'Reset',
    points: [
      { x: 0, y: 0 },
      { x: 255, y: 255 },
    ],
  },
  {
    label: 'Film S',
    points: [
      { x: 0, y: 8 },
      { x: 64, y: 50 },
      { x: 192, y: 208 },
      { x: 255, y: 248 },
    ],
  },
  {
    label: 'Soft Matte',
    points: [
      { x: 0, y: 24 },
      { x: 56, y: 58 },
      { x: 190, y: 198 },
      { x: 255, y: 242 },
    ],
  },
  {
    label: 'Punchy',
    points: [
      { x: 0, y: 0 },
      { x: 55, y: 36 },
      { x: 198, y: 218 },
      { x: 255, y: 255 },
    ],
  },
];

export const ToneCurveEditor: React.FC<ToneCurveEditorProps> = ({ curves, onChange }) => {
  const [activeChannel, setActiveChannel] = useState<CurveChannel>('rgb');
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const safeCurves = curves || DEFAULT_TONE_CURVES;
  const points = useMemo(
    () =>
      [...(safeCurves[activeChannel] || DEFAULT_TONE_CURVES[activeChannel])].sort(
        (a, b) => a.x - b.x
      ),
    [safeCurves, activeChannel]
  );

  const channelMeta = CHANNELS.find((c) => c.id === activeChannel)!;

  const svgPath = useMemo(() => {
    const lut = buildCurveLut(points);
    const cmds: string[] = [];
    for (let x = 0; x <= 255; x += 4) {
      const y = 255 - lut[x];
      cmds.push(`${x === 0 ? 'M' : 'L'} ${x} ${y}`);
    }
    cmds.push(`L 255 ${255 - lut[255]}`);
    return cmds.join(' ');
  }, [points]);

  const clientToCurve = (clientX: number, clientY: number): CurvePoint => {
    const svg = svgRef.current;
    if (!svg) return { x: 128, y: 128 };
    const rect = svg.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    const ny = Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, rect.height)));
    return {
      x: Math.round(nx * 255),
      y: Math.round((1 - ny) * 255),
    };
  };

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const pt = clientToCurve(e.clientX, e.clientY);
    const hitIdx = points.findIndex((p) => Math.hypot(p.x - pt.x, p.y - pt.y) < 22);

    if (hitIdx !== -1) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDraggingIdx(hitIdx);
      setSelectedIdx(hitIdx);
      return;
    }

    if (points.length < 7) {
      const nextPts = [...points, pt].sort((a, b) => a.x - b.x);
      const newIdx = nextPts.findIndex((p) => p.x === pt.x && p.y === pt.y);
      onChange({ ...safeCurves, [activeChannel]: nextPts });
      e.currentTarget.setPointerCapture(e.pointerId);
      setDraggingIdx(newIdx);
      setSelectedIdx(newIdx);
    }
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingIdx === null) return;
    const pt = clientToCurve(e.clientX, e.clientY);
    const updated = [...points];
    const isFirst = draggingIdx === 0;
    const isLast = draggingIdx === updated.length - 1;

    const minX = isFirst ? 0 : updated[draggingIdx - 1].x + 6;
    const maxX = isLast ? 255 : updated[draggingIdx + 1].x - 6;

    updated[draggingIdx] = {
      x: isFirst ? 0 : isLast ? 255 : Math.max(minX, Math.min(maxX, pt.x)),
      y: Math.max(0, Math.min(255, pt.y)),
    };
    onChange({ ...safeCurves, [activeChannel]: updated });
  };

  const handleSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingIdx === null) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDraggingIdx(null);
  };

  const handleRemovePoint = (idx: number) => {
    if (idx <= 0 || idx >= points.length - 1) return;
    const next = points.filter((_, i) => i !== idx);
    onChange({ ...safeCurves, [activeChannel]: next });
    setSelectedIdx(null);
  };

  const canDeleteSelected =
    selectedIdx !== null && selectedIdx > 0 && selectedIdx < points.length - 1;

  return (
    <div className="space-y-3">
      {/* Channel Tabs + Remove/Reset */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#090B0E] border border-white/[0.08]">
          {CHANNELS.map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => {
                setActiveChannel(ch.id);
                setSelectedIdx(null);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                activeChannel === ch.id
                  ? 'bg-[#1A202C] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {canDeleteSelected && (
            <button
              type="button"
              onClick={() => handleRemovePoint(selectedIdx!)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-[11px] font-medium text-red-300 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              Remove
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onChange({
                ...safeCurves,
                [activeChannel]: DEFAULT_TONE_CURVES[activeChannel],
              });
              setSelectedIdx(null);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-blue-300 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>
      </div>

      {/* Interactive SVG Curve Grid */}
      <div className="relative rounded-xl bg-[#080A0D] border border-white/[0.08] p-3">
        <svg
          ref={svgRef}
          viewBox="0 0 255 255"
          onPointerDown={handleSvgPointerDown}
          onPointerMove={handleSvgPointerMove}
          onPointerUp={handleSvgPointerUp}
          onPointerCancel={handleSvgPointerUp}
          className="w-full h-44 touch-none select-none cursor-crosshair overflow-visible"
        >
          {[64, 128, 192].map((g) => (
            <React.Fragment key={g}>
              <line x1={g} y1={0} x2={g} y2={255} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
              <line x1={0} y1={g} x2={255} y2={g} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
            </React.Fragment>
          ))}
          <line
            x1={0}
            y1={255}
            x2={255}
            y2={0}
            stroke="rgba(255,255,255,0.14)"
            strokeDasharray="4 4"
            strokeWidth={1}
          />
          <path
            d={svgPath}
            fill="none"
            stroke={channelMeta.stroke}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          {points.map((pt, idx) => {
            const isSel = selectedIdx === idx;
            return (
              <circle
                key={`${idx}-${pt.x}`}
                cx={pt.x}
                cy={255 - pt.y}
                r={isSel ? 8 : 6.5}
                fill={isSel ? channelMeta.stroke : '#090B0E'}
                stroke={channelMeta.stroke}
                strokeWidth={2.5}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleRemovePoint(idx);
                }}
                className="cursor-grab active:cursor-grabbing"
              />
            );
          })}
        </svg>
        <p className="text-[11px] text-slate-400 mt-1.5 text-center">
          Tap graph to add a point, then drag up or down to adjust contrast
        </p>
      </div>

      {/* Quick Curve Presets */}
      <div className="grid grid-cols-4 gap-1.5">
        {CURVE_PRESETS.map((cp) => (
          <button
            key={cp.label}
            type="button"
            onClick={() => {
              onChange({
                ...safeCurves,
                [activeChannel]: cp.points.map((p) => ({ ...p })),
              });
              setSelectedIdx(null);
            }}
            className="min-h-[38px] py-1.5 px-2 rounded-xl bg-[#090B0E] hover:bg-white/[0.06] border border-white/[0.08] text-[11px] font-medium text-slate-200 transition-colors whitespace-nowrap cursor-pointer"
          >
            {cp.label}
          </button>
        ))}
      </div>
    </div>
  );
};
