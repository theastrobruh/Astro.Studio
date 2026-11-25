import React, { useState } from 'react';
import { Camera, ChevronDown, RotateCcw, Sparkles } from 'lucide-react';
import { EmbeddedEditRecipe, ParsedExifInfo } from '../types/editor';

interface ExifInspectorProps {
  exif: ParsedExifInfo | null;
  isLoading: boolean;
  dimensions: { width: number; height: number } | null;
  onLoadRecipe: (recipe: EmbeddedEditRecipe) => void;
  compact?: boolean;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const ExifInspector: React.FC<ExifInspectorProps> = ({
  exif,
  isLoading,
  dimensions,
  onLoadRecipe,
  compact = false,
}) => {
  const [expanded, setExpanded] = useState(!compact);

  const cameraLabel =
    exif?.make && exif?.model
      ? exif.model.toLowerCase().includes(exif.make.toLowerCase())
        ? exif.model
        : `${exif.make} ${exif.model}`
      : exif?.model || exif?.make || 'Camera not embedded';

  const exposureSummary = [
    exif?.focalLength,
    exif?.aperture,
    exif?.shutterSpeed,
    exif?.iso ? `ISO ${exif.iso}` : undefined,
    exif?.exposureBias,
  ]
    .filter(Boolean)
    .join(' · ');

  const hasCameraExif = Boolean(
    exif?.make ||
      exif?.model ||
      exif?.lens ||
      exif?.aperture ||
      exif?.shutterSpeed ||
      exif?.iso ||
      exif?.focalLength
  );

  const summaryLine = isLoading
    ? 'Reading EXIF...'
    : [
        hasCameraExif ? cameraLabel : null,
        dimensions ? `${dimensions.width}×${dimensions.height}` : null,
        formatBytes(exif?.fileSizeBytes) || null,
      ]
        .filter(Boolean)
        .join(' · ') || 'No camera EXIF';

  return (
    <div className="overflow-hidden">
      {exif?.recipe && (
        <div className="bg-blue-600/12 border-b border-blue-500/25 px-3.5 py-2.5 space-y-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-300">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Previous Astro.Studio Edit</span>
            </div>
            <p className="text-[11px] text-slate-300 font-mono tabular-nums truncate">
              {exif.recipe.presetName} · {exif.recipe.intensity}%
            </p>
          </div>
          <button
            type="button"
            onClick={() => onLoadRecipe(exif.recipe!)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Load Edit Recipe
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Camera className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-slate-200 block">EXIF &amp; Specs</span>
            <span className="text-[10.5px] text-slate-400 font-mono tabular-nums truncate block">
              {summaryLine}
            </span>
          </div>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {expanded && (
        <div className="px-3.5 pb-3 pt-1.5 border-t border-white/[0.06] space-y-2 text-[11px]">
          {hasCameraExif ? (
            <div className="space-y-1.5">
              <div>
                <span className="text-slate-500">Camera: </span>
                <span className="text-slate-200 font-medium">{cameraLabel}</span>
              </div>
              {exif?.lens && (
                <div>
                  <span className="text-slate-500">Lens: </span>
                  <span className="text-slate-200">{exif.lens}</span>
                </div>
              )}
              {exposureSummary && (
                <div className="font-mono tabular-nums text-slate-300">{exposureSummary}</div>
              )}
            </div>
          ) : (
            <p className="text-slate-400 leading-relaxed">
              No camera EXIF embedded. Upload a camera photo or Astro.Studio export to inspect
              settings &amp; edit history.
            </p>
          )}
          {(exif?.dateTaken || exif?.colorSpace) && (
            <div className="text-[10.5px] font-mono text-slate-500">
              {[exif.dateTaken, exif.colorSpace].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
