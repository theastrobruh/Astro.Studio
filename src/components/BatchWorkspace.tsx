import React, { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FolderArchive,
  ImagePlus,
  Layers,
  Loader2,
  Maximize2,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { FILTER_PRESETS } from '../data/presets';
import { SAMPLE_PHOTOS } from '../data/samples';
import {
  ExportFormatConfig,
  FilterPreset,
  FilterSettings,
  ResizeConfig,
  WatermarkConfig,
} from '../types/editor';
import {
  computeTargetDimensions,
  loadImageElement,
  renderGradedOutput,
  triggerBlobDownload,
} from '../utils/imageProcessor';
import { ResizeFormatPanel } from './ResizeFormatPanel';

interface BatchItem {
  id: string;
  name: string;
  src: string;
  isObjectUrl: boolean;
  width?: number;
  height?: number;
  status: 'queued' | 'processing' | 'done' | 'error';
  resultUrl?: string;
  resultBlob?: Blob;
  resultExt?: 'jpg' | 'png' | 'webp';
  dimensions?: string;
}

interface BatchWorkspaceProps {
  settings: FilterSettings;
  intensity: number;
  presetName: string;
  activePresetId: string;
  customPresets: FilterPreset[];
  watermark: WatermarkConfig;
  loadedLogoImg: HTMLImageElement | null;
  resize: ResizeConfig;
  formatConfig: ExportFormatConfig;
  onSelectPreset: (preset: FilterPreset) => void;
  onChangeIntensity: (val: number) => void;
  onChangeResize: (patch: Partial<ResizeConfig>) => void;
  onChangeFormat: (patch: Partial<ExportFormatConfig>) => void;
  onToggleWatermark: () => void;
  onBackToEditor: () => void;
}

export const BatchWorkspace: React.FC<BatchWorkspaceProps> = ({
  settings,
  intensity,
  presetName,
  activePresetId,
  customPresets,
  watermark,
  loadedLogoImg,
  resize,
  formatConfig,
  onSelectPreset,
  onChangeIntensity,
  onChangeResize,
  onChangeFormat,
  onToggleWatermark,
  onBackToEditor,
}) => {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [zipReadyBlob, setZipReadyBlob] = useState<Blob | null>(null);
  const [showBatchControls, setShowBatchControls] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<BatchItem[]>(items);
  itemsRef.current = items;

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => {
        if (item.isObjectUrl) URL.revokeObjectURL(item.src);
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      });
    };
  }, []);

  useEffect(() => {
    setZipReadyBlob(null);
    setProcessedCount(0);
    setItems((prev) =>
      prev.map((item) => {
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
        return {
          ...item,
          status: 'queued',
          resultUrl: undefined,
          resultBlob: undefined,
        };
      })
    );
  }, [settings, intensity, watermark, resize, formatConfig]);

  const addFiles = (fileList: FileList | File[]) => {
    const validFiles = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    const newItems: BatchItem[] = validFiles.map((file, idx) => ({
      id: `batch-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      name: file.name,
      src: URL.createObjectURL(file),
      isObjectUrl: true,
      status: 'queued',
    }));

    setZipReadyBlob(null);
    setItems((prev) => [...prev, ...newItems]);
  };

  const handleAddSamples = () => {
    const newItems: BatchItem[] = SAMPLE_PHOTOS.map((s, idx) => ({
      id: `sample-${s.id}-${Date.now()}-${idx}`,
      name: `${s.label.toLowerCase().replace(/\s+/g, '-')}.jpg`,
      src: s.src,
      isObjectUrl: false,
      status: 'queued',
    }));
    setZipReadyBlob(null);
    setItems((prev) => [...prev, ...newItems]);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) {
        if (target.isObjectUrl) URL.revokeObjectURL(target.src);
        if (target.resultUrl) URL.revokeObjectURL(target.resultUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
    setZipReadyBlob(null);
  };

  const handleClearAll = () => {
    items.forEach((item) => {
      if (item.isObjectUrl) URL.revokeObjectURL(item.src);
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
    });
    setItems([]);
    setZipReadyBlob(null);
    setProcessedCount(0);
  };

  const buildZipFilename = () => {
    const slug = presetName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `astro-studio-batch-${slug}-${items.length}-photos.zip`;
  };

  const handleProcessAndDownloadZip = async () => {
    if (items.length === 0 || isRunning) return;
    setIsRunning(true);
    setProcessedCount(0);
    setZipReadyBlob(null);

    const zip = new JSZip();
    const usedNames = new Set<string>();
    const snapshot = [...items];

    for (let i = 0; i < snapshot.length; i++) {
      const item = snapshot[i];
      setItems((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, status: 'processing' } : p))
      );

      await new Promise((r) => setTimeout(r, 16));

      try {
        const img = await loadImageElement(item.src);
        const { blob, width, height, ext } = await renderGradedOutput(
          img,
          settings,
          intensity,
          formatConfig,
          resize,
          watermark,
          loadedLogoImg,
          presetName,
          3000
        );

        const baseName = item.name.replace(/\.[^/.]+$/, '');
        let candidate = `${baseName}-astro-${width}x${height}.${ext}`;
        let counter = 2;
        while (usedNames.has(candidate)) {
          candidate = `${baseName}-astro-${width}x${height}-${counter}.${ext}`;
          counter++;
        }
        usedNames.add(candidate);

        zip.file(candidate, blob);
        const resultUrl = URL.createObjectURL(blob);

        setItems((prev) =>
          prev.map((p) =>
            p.id === item.id
              ? {
                  ...p,
                  status: 'done',
                  resultUrl,
                  resultBlob: blob,
                  resultExt: ext,
                  dimensions: `${width}×${height}`,
                }
              : p
          )
        );
      } catch {
        setItems((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, status: 'error' } : p))
        );
      }

      setProcessedCount(i + 1);
    }

    try {
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      setZipReadyBlob(zipBlob);
      triggerBlobDownload(zipBlob, buildZipFilename());
    } finally {
      setIsRunning(false);
    }
  };

  const allPresets = [...customPresets, ...FILTER_PRESETS];
  const sampleTargetDims = computeTargetDimensions(1080, 1350, resize);

  return (
    <div
      className="space-y-5"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files?.length) {
          addFiles(e.dataTransfer.files);
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Batch Header Bar */}
      <div className="rounded-2xl bg-[#11141B] border border-white/[0.08] p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToEditor}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#090B0E] hover:bg-white/[0.06] border border-white/[0.08] text-xs font-medium text-slate-200 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Editor
            </button>
            <h1 className="text-base sm:text-lg font-bold text-white">
              Batch Edit, Resize &amp; ZIP
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-mono tabular-nums">
            {presetName} · {intensity}% Intensity ·{' '}
            {resize.enabled ? `${sampleTargetDims.width}×${sampleTargetDims.height}` : 'Original Size'}{' '}
            · {formatConfig.format.toUpperCase()} · Watermark:{' '}
            {watermark.enabled ? watermark.styleMode : 'Off'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowBatchControls((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              showBatchControls
                ? 'bg-blue-600/15 border-blue-500 text-blue-300'
                : 'bg-[#090B0E] border-white/[0.08] text-slate-200'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Size &amp; Recipe
          </button>

          <button
            type="button"
            disabled={isRunning}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-[#090B0E] hover:bg-white/[0.06] border border-white/[0.08] text-xs font-medium text-slate-100 transition-colors whitespace-nowrap cursor-pointer"
          >
            <ImagePlus className="w-4 h-4 text-blue-400" />
            Select Photos
          </button>

          {zipReadyBlob && !isRunning ? (
            <button
              type="button"
              onClick={() => triggerBlobDownload(zipReadyBlob, buildZipFilename())}
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              <FolderArchive className="w-4 h-4" />
              Download ZIP ({items.length})
            </button>
          ) : (
            <button
              type="button"
              disabled={items.length === 0 || isRunning}
              onClick={handleProcessAndDownloadZip}
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white shadow-lg shadow-blue-600/20 transition-colors whitespace-nowrap cursor-pointer"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing {processedCount}/{items.length}...
                </>
              ) : (
                <>
                  <FolderArchive className="w-4 h-4" />
                  Apply &amp; Download ZIP
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {items.length > 0 && (isRunning || processedCount > 0) && (
        <div className="rounded-xl bg-[#11141B] border border-white/[0.08] px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-200">
              {isRunning
                ? 'Grading, resizing, watermarking, and packaging ZIP...'
                : 'Batch complete — ZIP archive downloaded'}
            </span>
            <span className="font-mono tabular-nums text-blue-400">
              {processedCount} / {items.length} photos
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#1E2430] overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-200"
              style={{
                width: `${items.length > 0 ? Math.round((processedCount / items.length) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Batch Layout: Queue Grid + Live Batch Resize & Recipe Sidebar */}
      <div
        className={`grid grid-cols-1 ${
          showBatchControls ? 'lg:grid-cols-[1fr_380px]' : ''
        } gap-5 items-start`}
      >
        {/* Queue Area */}
        <div
          className={`relative rounded-2xl border transition-colors p-4 sm:p-6 min-h-[420px] ${
            isDragOver
              ? 'bg-blue-600/10 border-blue-500 border-dashed'
              : 'bg-[#11141B] border-white/[0.08]'
          }`}
        >
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20 px-4">
              <div className="w-14 h-14 rounded-2xl bg-[#090B0E] border border-white/[0.08] flex items-center justify-center text-blue-400 mb-4">
                <Layers className="w-6 h-6" />
              </div>
              <h2 className="text-base font-semibold text-white">
                Drop multiple photos here to batch process
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mt-1.5 leading-relaxed">
                Apply the same edit recipe, intensity, watermark, and target dimensions to an
                entire group of photos at once and download them as a ZIP.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  <ImagePlus className="w-4 h-4" />
                  Choose Photos
                </button>
                <button
                  type="button"
                  onClick={handleAddSamples}
                  className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl bg-[#090B0E] hover:bg-white/[0.06] border border-white/[0.08] text-xs font-medium text-slate-200 transition-colors cursor-pointer"
                >
                  Load 4 Studio Samples
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-slate-300 font-mono tabular-nums">
                  {items.length} {items.length === 1 ? 'photo' : 'photos'} in queue
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={handleAddSamples}
                    className="px-2.5 py-1.5 rounded-lg bg-[#090B0E] hover:bg-white/[0.06] border border-white/[0.08] text-xs font-medium text-slate-300 transition-colors cursor-pointer"
                  >
                    + Add Samples
                  </button>
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={handleClearAll}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#090B0E] hover:bg-red-500/15 border border-white/[0.08] hover:border-red-500/30 text-xs font-medium text-slate-300 hover:text-red-300 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="group relative rounded-xl overflow-hidden bg-[#090B0E] border border-white/[0.08] flex flex-col"
                  >
                    <div className="relative aspect-[3/4] w-full bg-black overflow-hidden">
                      <img
                        src={item.resultUrl || item.src}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />

                      {item.status === 'processing' && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                        </div>
                      )}

                      {!isRunning && (
                        <button
                          type="button"
                          aria-label={`Remove ${item.name}`}
                          onClick={() => handleRemoveItem(item.id)}
                          className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-slate-950/80 hover:bg-red-500/80 text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {item.status === 'done' && item.resultBlob && (
                        <button
                          type="button"
                          onClick={() =>
                            triggerBlobDownload(
                              item.resultBlob!,
                              `${item.name.replace(/\.[^/.]+$/, '')}-astro.${
                                item.resultExt || 'jpg'
                              }`
                            )
                          }
                          title="Download this photo"
                          className="absolute bottom-2 right-2 w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="p-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-slate-200 truncate">
                          {item.name}
                        </p>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                          {item.status === 'done'
                            ? item.dimensions || 'Ready'
                            : item.status === 'processing'
                            ? 'Processing'
                            : item.status === 'error'
                            ? 'Failed'
                            : 'Queued'}
                        </p>
                      </div>
                      {item.status === 'done' && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Batch Recipe & Resize Controls Sidebar */}
        {showBatchControls && (
          <aside className="rounded-2xl bg-[#11141B] border border-white/[0.08] p-4 space-y-5">
            {/* Quick Batch Edit Controls */}
            <div className="space-y-3 pb-4 border-b border-white/[0.08]">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
                  Batch Filter &amp; Intensity
                </span>
                <button
                  type="button"
                  onClick={onBackToEditor}
                  className="text-[11px] font-medium text-blue-400 hover:text-blue-300 cursor-pointer"
                >
                  Open Full Editor
                </button>
              </div>

              <div className="space-y-1">
                <label htmlFor="batch-preset-select" className="block text-[11px] text-slate-400">
                  Preset Look
                </label>
                <select
                  id="batch-preset-select"
                  value={activePresetId}
                  onChange={(e) => {
                    const found = allPresets.find((p) => p.id === e.target.value);
                    if (found) onSelectPreset(found);
                  }}
                  className="w-full h-9 px-3 rounded-lg bg-[#090B0E] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {activePresetId === 'custom-edited' && (
                    <option value="custom-edited" className="bg-[#11141B]">
                      Custom Manual Edit
                    </option>
                  )}
                  {allPresets.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#11141B]">
                      {p.name} ({p.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Effect Intensity</span>
                  <span className="font-mono tabular-nums text-[11px] text-blue-400">
                    {intensity}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={intensity}
                  onChange={(e) => onChangeIntensity(parseInt(e.target.value, 10))}
                  style={{
                    background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${intensity}%, #1E2430 ${intensity}%, #1E2430 100%)`,
                  }}
                  className="studio-slider"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-300">
                  Watermark ({watermark.enabled ? watermark.text || watermark.styleMode : 'Off'})
                </span>
                <button
                  type="button"
                  onClick={onToggleWatermark}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer ${
                    watermark.enabled
                      ? 'bg-blue-600/15 border-blue-500 text-blue-300'
                      : 'bg-[#090B0E] border-white/[0.08] text-slate-400'
                  }`}
                >
                  {watermark.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>

            {/* Batch Multi-Size & Format Panel */}
            <ResizeFormatPanel
              sourceDimensions={{ width: 1080, height: 1350 }}
              resize={resize}
              formatConfig={formatConfig}
              onChangeResize={onChangeResize}
              onChangeFormat={onChangeFormat}
              showCollageOption={true}
            />
          </aside>
        )}
      </div>
    </div>
  );
};
