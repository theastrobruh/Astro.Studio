import React from 'react';
import { Download, X } from 'lucide-react';
import { ExportFormatConfig, ResizeConfig } from '../types/editor';
import { ResizeFormatPanel } from './ResizeFormatPanel';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: () => void;
  presetName: string;
  intensity: number;
  dimensions: { width: number; height: number } | null;
  watermarkLabel?: string;
  resize: ResizeConfig;
  formatConfig: ExportFormatConfig;
  onChangeResize: (patch: Partial<ResizeConfig>) => void;
  onChangeFormat: (patch: Partial<ExportFormatConfig>) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  onExport,
  presetName,
  intensity,
  dimensions,
  watermarkLabel,
  resize,
  formatConfig,
  onChangeResize,
  onChangeFormat,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-[#11141B] border border-white/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] shrink-0">
          <div>
            <h2 id="export-modal-title" className="text-base font-semibold text-white">
              Export Size &amp; Format
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
              {presetName} · {intensity}%
              {dimensions ? ` · Src ${dimensions.width} × ${dimensions.height}` : ''}
              {watermarkLabel ? ` · WM: ${watermarkLabel}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export modal"
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto studio-scroll">
          <ResizeFormatPanel
            sourceDimensions={dimensions}
            resize={resize}
            formatConfig={formatConfig}
            onChangeResize={onChangeResize}
            onChangeFormat={onChangeFormat}
            showCollageOption={true}
          />
        </div>

        <div className="flex items-center justify-between gap-2.5 px-5 py-4 bg-[#0D1016] border-t border-white/[0.08] shrink-0">
          <span className="text-[11px] text-slate-400">
            Includes embedded Astro.Studio edit recipe
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onExport();
                onClose();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
