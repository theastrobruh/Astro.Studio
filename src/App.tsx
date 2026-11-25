import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Aperture,
  ChevronUp,
  Download,
  Layers,
  Maximize2,
  SlidersHorizontal,
  Sparkles,
  Type,
  X,
} from 'lucide-react';
import { AdjustmentPanel } from './components/AdjustmentPanel';
import { BatchWorkspace } from './components/BatchWorkspace';
import { BeforeAfterCanvas } from './components/BeforeAfterCanvas';
import { ExifInspector } from './components/ExifInspector';
import { ExportModal } from './components/ExportModal';
import { MediaQueueSidebar, QueuePhotoItem } from './components/MediaQueueSidebar';
import { PresetGrid } from './components/PresetGrid';
import { ResizeFormatPanel } from './components/ResizeFormatPanel';
import { StudioIntroGate } from './components/StudioIntroGate';
import { WatermarkPanel } from './components/WatermarkPanel';
import { FILTER_PRESETS } from './data/presets';
import { SAMPLE_PHOTOS } from './data/samples';
import {
  CompareMode,
  DEFAULT_EXPORT_FORMAT,
  DEFAULT_FILTER_SETTINGS,
  DEFAULT_RESIZE_CONFIG,
  DEFAULT_TONE_CURVES,
  DEFAULT_WATERMARK_CONFIG,
  EmbeddedEditRecipe,
  ExportFormatConfig,
  FilterPreset,
  FilterSettings,
  ParsedExifInfo,
  ResizeConfig,
  ToneCurves,
  WatermarkConfig,
} from './types/editor';
import { parsePhotoMetadata } from './utils/exifParser';
import {
  computeTargetDimensions,
  drawWatermark,
  exportGradedPhoto,
  getScaledImageData,
  imageDataToDataUrl,
  loadImageElement,
  processImageData,
} from './utils/imageProcessor';

const STORAGE_CUSTOM_PRESETS = 'astro_studio_custom_presets_v1';
const STORAGE_FAVORITES = 'astro_studio_favorites_v1';
const STORAGE_WATERMARK = 'astro_studio_watermark_v1';
const DEFAULT_INTENSITY = 77;

type StudioTab = 'presets' | 'adjust' | 'watermark' | 'size';
type WorkspaceMode = 'editor' | 'batch';

interface EditSnapshot {
  settings: FilterSettings;
  intensity: number;
  presetId: string;
}

function mergeFilterSettings(raw?: Partial<FilterSettings> | null): FilterSettings {
  if (!raw) return DEFAULT_FILTER_SETTINGS;
  return {
    ...DEFAULT_FILTER_SETTINGS,
    ...raw,
    shadowTint: {
      ...DEFAULT_FILTER_SETTINGS.shadowTint,
      ...(raw.shadowTint ?? {}),
    },
    highlightTint: {
      ...DEFAULT_FILTER_SETTINGS.highlightTint,
      ...(raw.highlightTint ?? {}),
    },
    curves: {
      rgb: raw.curves?.rgb?.length ? raw.curves.rgb : DEFAULT_TONE_CURVES.rgb,
      red: raw.curves?.red?.length ? raw.curves.red : DEFAULT_TONE_CURVES.red,
      green: raw.curves?.green?.length ? raw.curves.green : DEFAULT_TONE_CURVES.green,
      blue: raw.curves?.blue?.length ? raw.curves.blue : DEFAULT_TONE_CURVES.blue,
    },
  };
}

const TOOL_META: Record<StudioTab, { title: string; subtitle: string }> = {
  presets: {
    title: 'Filters',
    subtitle: 'One-tap color & film looks',
  },
  adjust: {
    title: 'Adjust',
    subtitle: 'Exposure, tone curves & detail',
  },
  watermark: {
    title: 'Watermark',
    subtitle: 'Text, badge, tiled & logo marks',
  },
  size: {
    title: 'Resize & Format',
    subtitle: 'Social sizes, quality & file type',
  },
};

export default function App() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedObjectUrl, setUploadedObjectUrl] = useState<string | null>(null);
  const [activePhotoSrc, setActivePhotoSrc] = useState<string>(SAMPLE_PHOTOS[0].src);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(
    null
  );

  const [exifInfo, setExifInfo] = useState<ParsedExifInfo | null>(null);
  const [isParsingExif, setIsParsingExif] = useState<boolean>(false);

  const initialSettings = useMemo(() => mergeFilterSettings(FILTER_PRESETS[0].settings), []);
  const [activePresetId, setActivePresetId] = useState<string>(FILTER_PRESETS[0].id);
  const [settings, setSettings] = useState<FilterSettings>(initialSettings);
  const [intensity, setIntensity] = useState<number>(DEFAULT_INTENSITY);
  const [compareMode, setCompareMode] = useState<CompareMode>('split');
  const [activeTab, setActiveTab] = useState<StudioTab>('presets');
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('editor');

  // Mobile/Tablet slide-up sheets
  const [mobileSheetOpen, setMobileSheetOpen] = useState<boolean>(false);
  const [mobileExifOpen, setMobileExifOpen] = useState<boolean>(false);

  // Undo / Redo history stack
  const [history, setHistory] = useState<EditSnapshot[]>([
    { settings: initialSettings, intensity: DEFAULT_INTENSITY, presetId: FILTER_PRESETS[0].id },
  ]);
  const [historyIdx, setHistoryIdx] = useState<number>(0);
  const historyCommitTimerRef = useRef<number | null>(null);
  const isApplyingHistoryRef = useRef<boolean>(false);

  const [resize, setResize] = useState<ResizeConfig>(DEFAULT_RESIZE_CONFIG);
  const [formatConfig, setFormatConfig] = useState<ExportFormatConfig>(DEFAULT_EXPORT_FORMAT);
  const [showWelcomeGuide, setShowWelcomeGuide] = useState<boolean>(false);

  const [watermark, setWatermark] = useState<WatermarkConfig>(() => {
    try {
      const raw =
        localStorage.getItem(STORAGE_WATERMARK) ||
        localStorage.getItem('fnatix_light_watermark_v1');
      if (!raw) return DEFAULT_WATERMARK_CONFIG;
      const parsed = JSON.parse(raw) as Partial<WatermarkConfig>;
      const safeLogoUrl =
        parsed.logoUrl && !parsed.logoUrl.startsWith('blob:') ? parsed.logoUrl : null;
      return {
        ...DEFAULT_WATERMARK_CONFIG,
        ...parsed,
        logoUrl: safeLogoUrl,
        styleMode:
          parsed.styleMode === 'logo' && !safeLogoUrl
            ? 'text'
            : parsed.styleMode ?? DEFAULT_WATERMARK_CONFIG.styleMode,
      };
    } catch {
      return DEFAULT_WATERMARK_CONFIG;
    }
  });
  const [loadedLogoImg, setLoadedLogoImg] = useState<HTMLImageElement | null>(null);

  const [customPresets, setCustomPresets] = useState<FilterPreset[]>(() => {
    try {
      const raw =
        localStorage.getItem(STORAGE_CUSTOM_PRESETS) ||
        localStorage.getItem('fnatix_light_custom_presets_v1');
      if (!raw) return [];
      const parsed = JSON.parse(raw) as FilterPreset[];
      return parsed.map((p) => ({
        ...p,
        settings: mergeFilterSettings(p.settings),
      }));
    } catch {
      return [];
    }
  });

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const raw =
        localStorage.getItem(STORAGE_FAVORITES) ||
        localStorage.getItem('fnatix_light_favorites_v1');
      return raw ? (JSON.parse(raw) as string[]) : ['fuji-superia-cool', 'seoul-soft-glow'];
    } catch {
      return ['fuji-superia-cool', 'seoul-soft-glow'];
    }
  });

  const [originalCanvas, setOriginalCanvas] = useState<HTMLCanvasElement | null>(null);
  const [processedCanvas, setProcessedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  const loadedImgRef = useRef<HTMLImageElement | null>(null);
  const previewImageDataRef = useRef<ImageData | null>(null);
  const hdImageDataRef = useRef<ImageData | null>(null);
  const hdRefineTimerRef = useRef<number | null>(null);

  // Record history snapshot (debounced for slider drags, immediate on preset click)
  const recordHistory = useCallback(
    (snap: EditSnapshot, immediate = false) => {
      if (isApplyingHistoryRef.current) return;
      if (historyCommitTimerRef.current) {
        window.clearTimeout(historyCommitTimerRef.current);
        historyCommitTimerRef.current = null;
      }

      const commit = () => {
        setHistory((prev) => {
          const sliced = prev.slice(0, historyIdx + 1);
          const next = [...sliced, snap].slice(-30);
          setHistoryIdx(next.length - 1);
          return next;
        });
      };

      if (immediate) {
        commit();
      } else {
        historyCommitTimerRef.current = window.setTimeout(commit, 220);
      }
    },
    [historyIdx]
  );

  const handleUndo = useCallback(() => {
    if (historyIdx <= 0) return;
    const nextIdx = historyIdx - 1;
    const snap = history[nextIdx];
    isApplyingHistoryRef.current = true;
    setHistoryIdx(nextIdx);
    setSettings(snap.settings);
    setIntensity(snap.intensity);
    setActivePresetId(snap.presetId);
    window.setTimeout(() => {
      isApplyingHistoryRef.current = false;
    }, 30);
  }, [history, historyIdx]);

  const handleRedo = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    const nextIdx = historyIdx + 1;
    const snap = history[nextIdx];
    isApplyingHistoryRef.current = true;
    setHistoryIdx(nextIdx);
    setSettings(snap.settings);
    setIntensity(snap.intensity);
    setActivePresetId(snap.presetId);
    window.setTimeout(() => {
      isApplyingHistoryRef.current = false;
    }, 30);
  }, [history, historyIdx]);

  // Keyboard shortcuts for Undo / Redo & Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Escape') {
        setMobileSheetOpen(false);
        setMobileExifOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  // Persist custom presets, favorites & watermark
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CUSTOM_PRESETS, JSON.stringify(customPresets));
    } catch {
      // Ignore storage quota errors
    }
  }, [customPresets]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FAVORITES, JSON.stringify(favorites));
    } catch {
      // Ignore storage quota errors
    }
  }, [favorites]);

  useEffect(() => {
    try {
      const serializable: WatermarkConfig = {
        ...watermark,
        logoUrl: watermark.logoUrl?.startsWith('blob:') ? null : watermark.logoUrl,
      };
      localStorage.setItem(STORAGE_WATERMARK, JSON.stringify(serializable));
    } catch {
      // Ignore storage quota errors
    }
  }, [watermark]);

  useEffect(() => {
    let cancelled = false;
    if (!watermark.logoUrl) {
      setLoadedLogoImg(null);
      return;
    }
    loadImageElement(watermark.logoUrl)
      .then((img) => {
        if (!cancelled) setLoadedLogoImg(img);
      })
      .catch(() => {
        if (!cancelled) setLoadedLogoImg(null);
      });
    return () => {
      cancelled = true;
    };
  }, [watermark.logoUrl]);

  useEffect(() => {
    return () => {
      if (uploadedObjectUrl) {
        URL.revokeObjectURL(uploadedObjectUrl);
      }
    };
  }, [uploadedObjectUrl]);

  useEffect(() => {
    let cancelled = false;
    setIsParsingExif(true);
    parsePhotoMetadata(uploadedFile || activePhotoSrc)
      .then((info) => {
        if (!cancelled) {
          setExifInfo(info);
          setIsParsingExif(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setExifInfo(null);
          setIsParsingExif(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [uploadedFile, activePhotoSrc]);

  const activePresetName = useMemo(() => {
    if (activePresetId === 'original-none') return 'Original Photo';
    if (activePresetId === 'custom-edited') return 'Custom Edit';
    const found =
      customPresets.find((p) => p.id === activePresetId) ??
      FILTER_PRESETS.find((p) => p.id === activePresetId);
    return found ? found.name : 'Custom Edit';
  }, [activePresetId, customPresets]);

  const renderCanvasFromBuffer = useCallback(
    (
      srcData: ImageData,
      nextSettings: FilterSettings,
      nextIntensity: number,
      nextWatermark: WatermarkConfig,
      nextLogoImg: HTMLImageElement | null
    ): HTMLCanvasElement => {
      const graded = processImageData(srcData, nextSettings, { intensity: nextIntensity });
      const canvas = document.createElement('canvas');
      canvas.width = graded.width;
      canvas.height = graded.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(graded, 0, 0);
        drawWatermark(ctx, graded.width, graded.height, nextWatermark, nextLogoImg);
      }
      return canvas;
    },
    []
  );

  // Load photo and generate preview + HD buffer + preset thumbnails
  useEffect(() => {
    let cancelled = false;
    setIsProcessing(true);
    hdImageDataRef.current = null;

    loadImageElement(activePhotoSrc)
      .then((img) => {
        if (cancelled) return;
        loadedImgRef.current = img;
        setImageDimensions({
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
        });

        const { imageData: fastData } = getScaledImageData(img, 900);
        previewImageDataRef.current = fastData;

        const { imageData: hdData } = getScaledImageData(img, 1480);
        hdImageDataRef.current = hdData;

        const origC = document.createElement('canvas');
        origC.width = hdData.width;
        origC.height = hdData.height;
        origC.getContext('2d')?.putImageData(hdData, 0, 0);
        setOriginalCanvas(origC);

        const procC = renderCanvasFromBuffer(
          hdData,
          settings,
          intensity,
          watermark,
          loadedLogoImg
        );
        setProcessedCanvas(procC);
        setIsProcessing(false);

        const { imageData: thumbSrc } = getScaledImageData(img, 140);
        const allList = [...customPresets, ...FILTER_PRESETS];
        const nextThumbs: Record<string, string> = {};
        let idx = 0;

        const generateBatch = () => {
          if (cancelled) return;
          const end = Math.min(allList.length, idx + 4);
          for (; idx < end; idx++) {
            const p = allList[idx];
            const gradedThumb = processImageData(thumbSrc, p.settings, {
              intensity: DEFAULT_INTENSITY,
            });
            nextThumbs[p.id] = imageDataToDataUrl(gradedThumb, 0.8);
          }
          setThumbnails((prev) => ({ ...prev, ...nextThumbs }));
          if (idx < allList.length) {
            requestAnimationFrame(generateBatch);
          }
        };
        requestAnimationFrame(generateBatch);
      })
      .catch(() => {
        if (!cancelled) setIsProcessing(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePhotoSrc]);

  // Instant fast preview while dragging + silent HD refinement 220ms after idle
  useEffect(() => {
    const fastData = previewImageDataRef.current;
    if (!fastData) return;

    const raf = requestAnimationFrame(() => {
      const fastCanvas = renderCanvasFromBuffer(
        fastData,
        settings,
        intensity,
        watermark,
        loadedLogoImg
      );
      setProcessedCanvas(fastCanvas);
    });

    if (hdRefineTimerRef.current) {
      window.clearTimeout(hdRefineTimerRef.current);
    }

    hdRefineTimerRef.current = window.setTimeout(() => {
      const hdData = hdImageDataRef.current;
      if (!hdData) return;
      const hdCanvas = renderCanvasFromBuffer(
        hdData,
        settings,
        intensity,
        watermark,
        loadedLogoImg
      );
      setProcessedCanvas(hdCanvas);
    }, 220);

    return () => {
      cancelAnimationFrame(raf);
      if (hdRefineTimerRef.current) {
        window.clearTimeout(hdRefineTimerRef.current);
      }
    };
  }, [settings, intensity, watermark, loadedLogoImg, renderCanvasFromBuffer]);

  // Generate thumbnail for newly saved custom presets
  useEffect(() => {
    const img = loadedImgRef.current;
    if (!img || customPresets.length === 0) return;
    const missing = customPresets.filter((cp) => !thumbnails[cp.id]);
    if (missing.length === 0) return;

    const { imageData: thumbSrc } = getScaledImageData(img, 140);
    const added: Record<string, string> = {};
    missing.forEach((p) => {
      const gradedThumb = processImageData(thumbSrc, p.settings, {
        intensity: DEFAULT_INTENSITY,
      });
      added[p.id] = imageDataToDataUrl(gradedThumb, 0.8);
    });
    setThumbnails((prev) => ({ ...prev, ...added }));
  }, [customPresets, thumbnails]);

  const handleSelectPreset = (preset: FilterPreset) => {
    const nextSettings = mergeFilterSettings(preset.settings);
    setActivePresetId(preset.id);
    setSettings(nextSettings);
    recordHistory({ settings: nextSettings, intensity, presetId: preset.id }, true);
  };

  const handleResetToOriginal = () => {
    setActivePresetId('original-none');
    setSettings(DEFAULT_FILTER_SETTINGS);
    setIntensity(DEFAULT_INTENSITY);
    recordHistory(
      {
        settings: DEFAULT_FILTER_SETTINGS,
        intensity: DEFAULT_INTENSITY,
        presetId: 'original-none',
      },
      true
    );
  };

  const handleSettingChange = (key: keyof FilterSettings, value: number) => {
    setActivePresetId('custom-edited');
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      recordHistory({ settings: next, intensity, presetId: 'custom-edited' });
      return next;
    });
  };

  const handleChangeCurves = (curves: ToneCurves) => {
    setActivePresetId('custom-edited');
    setSettings((prev) => {
      const next = { ...prev, curves };
      recordHistory({ settings: next, intensity, presetId: 'custom-edited' });
      return next;
    });
  };

  const handleIntensityChange = (val: number) => {
    setIntensity(val);
    recordHistory({ settings, intensity: val, presetId: activePresetId });
  };

  const handleLoadRecipe = (recipe: EmbeddedEditRecipe) => {
    const merged = mergeFilterSettings(recipe.settings);
    const nextIntensity =
      typeof recipe.intensity === 'number' ? recipe.intensity : DEFAULT_INTENSITY;
    const matchingPreset = [...customPresets, ...FILTER_PRESETS].find(
      (p) => p.name.toLowerCase() === recipe.presetName.toLowerCase()
    );
    const nextId = matchingPreset ? matchingPreset.id : 'custom-edited';
    setSettings(merged);
    setIntensity(nextIntensity);
    setActivePresetId(nextId);
    setWorkspaceMode('editor');
    setActiveTab('adjust');
    setMobileExifOpen(false);
    recordHistory({ settings: merged, intensity: nextIntensity, presetId: nextId }, true);
  };

  const handleToggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSaveCustomPreset = (name: string) => {
    const id = `custom-${Date.now()}`;
    const newPreset: FilterPreset = {
      id,
      name,
      category: 'Clean & Minimal',
      subtitle: `Custom · ${settings.backgroundEv.toFixed(1)} EV`,
      settings: mergeFilterSettings(settings),
    };
    setCustomPresets((prev) => [newPreset, ...prev]);
    setActivePresetId(id);
  };

  const handleDeleteCustomPreset = (id: string) => {
    setCustomPresets((prev) => prev.filter((p) => p.id !== id));
    if (activePresetId === id) {
      setActivePresetId('custom-edited');
    }
  };

  const handleFileSelected = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (uploadedObjectUrl) {
      URL.revokeObjectURL(uploadedObjectUrl);
    }
    const url = URL.createObjectURL(file);
    setUploadedFile(file);
    setUploadedObjectUrl(url);
    setActivePhotoSrc(url);
  };

  const handleSelectPhoto = (item: { id: string; src: string; isUploaded: boolean }) => {
    if (!item.isUploaded) {
      setUploadedFile(null);
    }
    setActivePhotoSrc(item.src);
  };

  const handleChangeResize = (patch: Partial<ResizeConfig>) => {
    setResize((prev) => ({ ...prev, ...patch }));
  };

  const handleChangeFormat = (patch: Partial<ExportFormatConfig>) => {
    setFormatConfig((prev) => ({ ...prev, ...patch }));
  };

  const handleExport = () => {
    const img = loadedImgRef.current;
    if (!img) return;
    void exportGradedPhoto(
      img,
      settings,
      intensity,
      formatConfig,
      activePresetName,
      resize,
      watermark,
      loadedLogoImg
    );
  };

  const switchDesktopTab = (tab: StudioTab) => {
    setWorkspaceMode('editor');
    setActiveTab(tab);
  };

  const switchMobileTab = (tab: StudioTab) => {
    setWorkspaceMode('editor');
    if (activeTab === tab && mobileSheetOpen) {
      setMobileSheetOpen(false);
    } else {
      setActiveTab(tab);
      setMobileSheetOpen(true);
    }
  };

  const uploadedQueueItem: QueuePhotoItem | null = useMemo(() => {
    if (!uploadedObjectUrl || !uploadedFile) return null;
    return {
      id: 'uploaded-photo',
      label: uploadedFile.name,
      src: uploadedObjectUrl,
      isUploaded: true,
    };
  }, [uploadedFile, uploadedObjectUrl]);

  const targetDims = useMemo(() => {
    const srcW = imageDimensions?.width || 1080;
    const srcH = imageDimensions?.height || 1350;
    return computeTargetDimensions(srcW, srcH, resize);
  }, [imageDimensions, resize]);

  const renderInspectorBody = () => {
    if (activeTab === 'presets') {
      return (
        <PresetGrid
          presets={FILTER_PRESETS}
          customPresets={customPresets}
          activePresetId={activePresetId}
          favorites={favorites}
          thumbnails={thumbnails}
          onSelectPreset={handleSelectPreset}
          onResetToOriginal={handleResetToOriginal}
          onToggleFavorite={handleToggleFavorite}
          onSaveCustomPreset={handleSaveCustomPreset}
          onDeleteCustomPreset={handleDeleteCustomPreset}
        />
      );
    }
    if (activeTab === 'adjust') {
      return (
        <AdjustmentPanel
          settings={settings}
          onChange={handleSettingChange}
          onChangeCurves={handleChangeCurves}
          onResetAll={handleResetToOriginal}
        />
      );
    }
    if (activeTab === 'watermark') {
      return <WatermarkPanel watermark={watermark} onChange={setWatermark} />;
    }
    return (
      <ResizeFormatPanel
        sourceDimensions={imageDimensions}
        resize={resize}
        formatConfig={formatConfig}
        onChangeResize={handleChangeResize}
        onChangeFormat={handleChangeFormat}
        showCollageOption={true}
      />
    );
  };

  const renderStrengthBar = (compact = false) => (
    <div
      className={`shrink-0 border-b border-white/[0.08] bg-[#0D1016] ${
        compact ? 'px-4 py-2.5' : 'px-4 py-3'
      } space-y-2`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="text-xs font-semibold text-white truncate">Filter Strength</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono font-semibold tabular-nums text-blue-400">
            {intensity}%
          </span>
          {intensity !== DEFAULT_INTENSITY && (
            <button
              type="button"
              onClick={() => handleIntensityChange(DEFAULT_INTENSITY)}
              className="px-2 py-0.5 rounded-md bg-[#181E29] hover:bg-[#222A3A] border border-white/10 text-[10px] font-mono text-slate-200 transition-colors whitespace-nowrap cursor-pointer"
            >
              Reset {DEFAULT_INTENSITY}%
            </button>
          )}
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={intensity}
        aria-label="Filter Strength"
        onChange={(e) => handleIntensityChange(parseInt(e.target.value, 10))}
        style={{
          background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${intensity}%, #1E2430 ${intensity}%, #1E2430 100%)`,
        }}
        className="studio-slider"
      />
    </div>
  );

  const navItems: {
    id: StudioTab | 'batch';
    label: string;
    mobileLabel: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'presets', label: 'Filters', mobileLabel: 'Filters', icon: Sparkles },
    { id: 'adjust', label: 'Adjust', mobileLabel: 'Adjust', icon: SlidersHorizontal },
    { id: 'watermark', label: 'Watermark', mobileLabel: 'Mark', icon: Type },
    { id: 'size', label: 'Resize', mobileLabel: 'Resize', icon: Maximize2 },
    { id: 'batch', label: 'Batch', mobileLabel: 'Batch', icon: Layers },
  ];

  const totalEffectsCount = FILTER_PRESETS.length + customPresets.length;

  return (
    <div className="h-[100dvh] w-screen overflow-hidden flex flex-col bg-[#0E1014] text-[#F3F4F6]">
      {/* Loading Progress + Welcome Guide Overlay */}
      <StudioIntroGate
        forceOpen={showWelcomeGuide}
        onCloseForce={() => setShowWelcomeGuide(false)}
      />

      {/* Pressmark-Matched 3-Zone Top Bar */}
      <header className="h-14 shrink-0 bg-[#101319] border-b border-white/[0.08] px-3 sm:px-5 flex items-center justify-between gap-3 z-30">
        {/* Zone 1: Brand Wordmark + Creator Links (GitHub, the.astro.os, Ko-Fi) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setWorkspaceMode('editor')}
            className="inline-flex items-center gap-2 text-sm sm:text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#151A23] border border-blue-500/35 flex items-center justify-center text-blue-400">
              <Aperture className="w-4 h-4" />
            </span>
            <span>
              Astro<span className="font-normal text-blue-400">.Studio</span>
            </span>
          </button>

          <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-xl bg-white/[0.025] border border-white/[0.06]">
            {/* 1. theAstroBruh GitHub */}
            <a
              href="https://github.com/theastrobruh"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="theAstroBruh GitHub"
              title="theAstroBruh on GitHub"
              className="w-7 h-7 sm:w-8 sm:h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.07] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-[14px] h-[14px] sm:w-[15px] sm:h-[15px]"
                aria-hidden="true"
              >
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
              </svg>
            </a>

            {/* 2. the.astro.os - Web OS created by theAstroBruh */}
            <a
              href="https://theastrobruh.github.io/the.astro.os/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="the.astro.os — Web OS created by theAstroBruh"
              title="the.astro.os — Web OS by theAstroBruh"
              className="w-7 h-7 sm:w-8 sm:h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[14px] h-[14px] sm:w-[15px] sm:h-[15px]"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="15" rx="2.5" />
                <path d="M3 8.5h18" />
                <circle cx="6.25" cy="6.25" r="0.6" fill="currentColor" stroke="none" />
                <circle cx="8.75" cy="6.25" r="0.6" fill="currentColor" stroke="none" />
                <path
                  d="M12 11.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8.8-1.9z"
                  fill="currentColor"
                  stroke="none"
                />
              </svg>
            </a>

            {/* 3. Ko-Fi Animated Heart / Coffee Cup */}
            <a
              href="https://ko-fi.com/theastrobruh"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Support theAstroBruh on Ko-fi"
              title="Support on Ko-fi"
              className="group w-7 h-7 sm:w-8 sm:h-8 inline-flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-[#FF5E5B]/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5E5B]"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-[15px] h-[15px] sm:w-[16px] sm:h-[16px]"
                aria-hidden="true"
              >
                <path
                  d="M4.5 8.5h11.5v5.25a4.75 4.75 0 0 1-4.75 4.75H9.25A4.75 4.75 0 0 1 4.5 13.75V8.5Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
                <path
                  d="M16 9.5h1.75a2.25 2.25 0 0 1 0 4.5H16"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
                <path
                  d="M10.25 15.1s-2.55-1.55-2.55-3.15a1.42 1.42 0 0 1 2.55-.86 1.42 1.42 0 0 1 2.55.86c0 1.6-2.55 3.15-2.55 3.15Z"
                  fill="#FF5E5B"
                  className="animate-kofi-heart"
                />
              </svg>
            </a>
          </div>
        </div>

        {/* Zone 2: Single Unified Desktop Navigation Bar (Zero duplicate tabs in inspector) */}
        <nav
          aria-label="Studio workspace navigation"
          className="hidden md:flex items-center gap-1 h-full"
        >
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive =
              id === 'batch'
                ? workspaceMode === 'batch'
                : workspaceMode === 'editor' && activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (id === 'batch') {
                    setWorkspaceMode('batch');
                    setMobileSheetOpen(false);
                  } else {
                    switchDesktopTab(id);
                  }
                }}
                className={`relative h-full inline-flex items-center gap-2 px-3.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : ''}`} />
                <span>{label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-2.5 right-2.5 h-0.5 bg-blue-500 rounded-t" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-2 shrink-0">
          {workspaceMode === 'batch' ? (
            <button
              type="button"
              onClick={() => setWorkspaceMode('editor')}
              className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-lg bg-[#1A202C] hover:bg-[#232B3A] border border-white/[0.1] text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Single Photo
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsExportOpen(true)}
              disabled={!processedCanvas}
              className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-45 text-xs font-semibold text-white shadow-sm shadow-blue-600/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          )}
        </div>
      </header>

      {/* Main Viewport-Locked Studio Body */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {workspaceMode === 'batch' ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 studio-scroll">
            <div className="max-w-7xl mx-auto pb-6">
              <BatchWorkspace
                settings={settings}
                intensity={intensity}
                presetName={activePresetName}
                activePresetId={activePresetId}
                customPresets={customPresets}
                watermark={watermark}
                loadedLogoImg={loadedLogoImg}
                resize={resize}
                formatConfig={formatConfig}
                onSelectPreset={handleSelectPreset}
                onChangeIntensity={handleIntensityChange}
                onChangeResize={handleChangeResize}
                onChangeFormat={handleChangeFormat}
                onToggleWatermark={() =>
                  setWatermark((prev) => ({ ...prev, enabled: !prev.enabled }))
                }
                onBackToEditor={() => setWorkspaceMode('editor')}
              />
            </div>
          </div>
        ) : (
          <>
            {/* Left Sidebar (Desktop) / Sleek Filmstrip (Mobile & Tablet) */}
            <MediaQueueSidebar
              uploadedItem={uploadedQueueItem}
              samples={SAMPLE_PHOTOS}
              activePhotoSrc={activePhotoSrc}
              onSelectPhoto={handleSelectPhoto}
              onUploadFile={handleFileSelected}
              exif={exifInfo}
              isParsingExif={isParsingExif}
              dimensions={imageDimensions}
              onLoadRecipe={handleLoadRecipe}
              onOpenMobileExif={() => setMobileExifOpen(true)}
              onOpenWelcomeGuide={() => setShowWelcomeGuide(true)}
            />

            {/* Center Full-Height Photo Stage */}
            <BeforeAfterCanvas
              originalCanvas={originalCanvas}
              processedCanvas={processedCanvas}
              intensity={intensity}
              compareMode={compareMode}
              onCompareModeChange={setCompareMode}
              onFileDrop={handleFileSelected}
              activePresetName={activePresetName}
              imageDimensions={imageDimensions}
              isProcessing={isProcessing}
              canUndo={historyIdx > 0}
              canRedo={historyIdx < history.length - 1}
              onUndo={handleUndo}
              onRedo={handleRedo}
            />

            {/* Desktop Right Inspector — Clean tool header only, zero redundant nav tabs */}
            <aside className="hidden lg:flex w-[340px] xl:w-[370px] shrink-0 bg-[#11141B] border-l border-white/[0.08] flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between gap-2 shrink-0">
                <div className="min-w-0">
                  <h2 className="text-xs font-semibold text-white tracking-tight">
                    {TOOL_META[activeTab].title}
                  </h2>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {TOOL_META[activeTab].subtitle}
                  </p>
                </div>
                <span className="text-[11px] font-mono tabular-nums text-blue-400 shrink-0">
                  {activeTab === 'presets'
                    ? `${totalEffectsCount} looks`
                    : activeTab === 'size'
                    ? `${targetDims.width}×${targetDims.height}`
                    : activeTab === 'watermark'
                    ? watermark.enabled
                      ? watermark.styleMode.toUpperCase()
                      : 'OFF'
                    : `${intensity}%`}
                </span>
              </div>

              {renderStrengthBar()}

              <div className="flex-1 min-h-0 overflow-y-auto p-3.5 studio-scroll">
                {renderInspectorBody()}
              </div>
            </aside>

            {/* Mobile & Tablet (< lg): Thumb-Zone Contextual Quick Bar */}
            <div className="lg:hidden shrink-0 bg-[#12151B] border-t border-white/[0.08] px-3 py-2 flex items-center gap-3">
              {activeTab === 'size' ? (
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-slate-400">Output Target</p>
                  <p className="text-xs font-mono tabular-nums text-white truncate">
                    {targetDims.width} × {targetDims.height} · {formatConfig.format.toUpperCase()}
                  </p>
                </div>
              ) : (
                <div className="flex-1 min-w-0 flex items-center gap-2.5">
                  <span className="text-[11px] font-medium text-slate-300 shrink-0">
                    Strength
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={intensity}
                    aria-label="Filter Strength"
                    onChange={(e) => handleIntensityChange(parseInt(e.target.value, 10))}
                    style={{
                      background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${intensity}%, #1E2430 ${intensity}%, #1E2430 100%)`,
                    }}
                    className="studio-slider flex-1"
                  />
                  <span className="text-[11px] font-mono tabular-nums text-blue-400 w-9 text-right shrink-0">
                    {intensity}%
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setMobileSheetOpen(true)}
                className="inline-flex items-center gap-1 px-3 h-9 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/40 text-xs font-semibold text-blue-300 whitespace-nowrap shrink-0 cursor-pointer active:scale-95 transition-transform"
              >
                <span>{TOOL_META[activeTab].title}</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </main>

      {/* Mobile Bottom 5-Tab Bar (< md) matching Pressmark */}
      <nav
        aria-label="Mobile workspace tabs"
        className="md:hidden shrink-0 h-[58px] bg-[#101319] border-t border-white/[0.08] grid grid-cols-5 z-30 pb-safe"
      >
        {navItems.map(({ id, mobileLabel, icon: Icon }) => {
          const isActive =
            id === 'batch'
              ? workspaceMode === 'batch'
              : workspaceMode === 'editor' && activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (id === 'batch') {
                  setWorkspaceMode('batch');
                  setMobileSheetOpen(false);
                } else {
                  switchMobileTab(id);
                }
              }}
              className={`relative flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                isActive ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-4 right-4 h-0.5 bg-blue-500 rounded-b" />
              )}
              <Icon className="w-[18px] h-[18px]" />
              <span className="text-[10px] font-semibold leading-none">{mobileLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Mobile & Tablet Slide-Up Inspector Bottom Sheet (< lg) */}
      <AnimatePresence>
        {mobileSheetOpen && workspaceMode === 'editor' && (
          <div className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileSheetOpen(false)}
              className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 360 }}
              className="relative z-10 h-[70dvh] max-h-[620px] rounded-t-3xl bg-[#11141B] border-t border-white/[0.12] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="pt-2.5 pb-1 flex justify-center shrink-0">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              <div className="px-4 py-2 border-b border-white/[0.08] flex items-center justify-between gap-2 shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {TOOL_META[activeTab].title}
                  </h3>
                  <p className="text-[11px] text-slate-400">{TOOL_META[activeTab].subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileSheetOpen(false)}
                  className="inline-flex items-center gap-1 px-3 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white cursor-pointer"
                >
                  Done
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {renderStrengthBar(true)}

              <div className="flex-1 min-h-0 overflow-y-auto p-3.5 pb-8 studio-scroll">
                {renderInspectorBody()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile & Tablet EXIF & Edit History Bottom Sheet */}
      <AnimatePresence>
        {mobileExifOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileExifOpen(false)}
              className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 360 }}
              className="relative z-10 max-h-[75dvh] rounded-t-3xl bg-[#11141B] border-t border-white/[0.12] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="pt-2.5 pb-1 flex justify-center shrink-0">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
              <div className="px-4 py-2 border-b border-white/[0.08] flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Photo Info &amp; Recipe</span>
                <button
                  type="button"
                  onClick={() => setMobileExifOpen(false)}
                  className="px-3 h-8 rounded-lg bg-[#090B0E] border border-white/10 text-xs font-medium text-slate-200 cursor-pointer"
                >
                  Close
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 pb-8 studio-scroll">
                <ExifInspector
                  exif={exifInfo}
                  isLoading={isParsingExif}
                  dimensions={imageDimensions}
                  onLoadRecipe={handleLoadRecipe}
                  compact={false}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Export Size & Format Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        onExport={handleExport}
        presetName={activePresetName}
        intensity={intensity}
        dimensions={imageDimensions}
        watermarkLabel={
          watermark.enabled ? watermark.text || watermark.logoName || watermark.styleMode : undefined
        }
        resize={resize}
        formatConfig={formatConfig}
        onChangeResize={handleChangeResize}
        onChangeFormat={handleChangeFormat}
      />
    </div>
  );
}
