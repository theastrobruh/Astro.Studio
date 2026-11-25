export type PresetCategory =
  | 'All'
  | 'Monochrome'
  | 'Retro & Analog'
  | 'Moody & Cinematic'
  | 'Portrait & Glow'
  | 'Disposable'
  | 'Clean & Minimal';

export type CompareMode = 'split' | 'side-by-side';

export interface SplitToneColor {
  r: number;
  g: number;
  b: number;
  amount: number; // 0 to 1
}

export interface CurvePoint {
  x: number; // 0 to 255
  y: number; // 0 to 255
}

export interface ToneCurves {
  rgb: CurvePoint[];
  red: CurvePoint[];
  green: CurvePoint[];
  blue: CurvePoint[];
}

export const DEFAULT_TONE_CURVES: ToneCurves = {
  rgb: [
    { x: 0, y: 0 },
    { x: 255, y: 255 },
  ],
  red: [
    { x: 0, y: 0 },
    { x: 255, y: 255 },
  ],
  green: [
    { x: 0, y: 0 },
    { x: 255, y: 255 },
  ],
  blue: [
    { x: 0, y: 0 },
    { x: 255, y: 255 },
  ],
};

export interface FilterSettings {
  // Depth & Signature Controls
  backgroundEv: number; // -3.0 to +1.0 EV
  shadowCrispness: number; // 0 to 100
  subjectGlow: number; // 0 to 100

  // Light & Tone
  brightness: number; // -50 to +50
  exposure: number; // -2.0 to +2.0 EV
  contrast: number; // -50 to +50
  highlights: number; // -100 to +100
  shadows: number; // -100 to +100
  whites: number; // -50 to +50
  blacks: number; // -50 to +50
  fade: number; // 0 to 100

  // Detail & Instagram-style Clarity
  sharpen: number; // 0 to 100
  structure: number; // -50 to +100

  // Color & Film
  temperature: number; // -50 (cool) to +50 (warm)
  tint: number; // -50 (green) to +50 (magenta)
  vibrance: number; // -50 to +50
  saturation: number; // -50 to +50
  grain: number; // 0 to 100
  vignette: number; // 0 to 100

  // Split toning
  shadowTint: SplitToneColor;
  highlightTint: SplitToneColor;

  // Interactive Curves
  curves: ToneCurves;

  // True monochromatic luminance pipeline (with optional optical filter & darkroom split toning)
  monochrome?: boolean;
}

export interface FilterPreset {
  id: string;
  name: string;
  category: Exclude<PresetCategory, 'All'>;
  subtitle: string;
  settings: FilterSettings;
  isFeatured?: boolean;
}

export interface SamplePhoto {
  id: string;
  label: string;
  src: string;
  aspectLabel: string;
}

export type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'mid-left'
  | 'center'
  | 'mid-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type WatermarkStyleMode = 'text' | 'badge' | 'tiled' | 'logo';

export type WatermarkFontFamily =
  | 'Plus Jakarta Sans'
  | 'Playfair Display'
  | 'Cormorant Garamond'
  | 'Oswald'
  | 'Syne'
  | 'JetBrains Mono'
  | 'Pacifico';

export interface WatermarkConfig {
  enabled: boolean;
  styleMode: WatermarkStyleMode;
  text: string;
  subtext: string;
  fontFamily: WatermarkFontFamily;
  italic: boolean;
  uppercase: boolean;
  color: string;
  badgeColor: string;
  badgeRadius: number; // 0 to 24
  position: WatermarkPosition;
  opacity: number; // 10 to 100
  scale: number; // 1.2 to 8.0 (% of min side)
  letterSpacing: number; // 0 to 10
  rotation: number; // -45 to 45
  marginPct: number; // 1 to 12
  shadowEnabled: boolean;
  outlineEnabled: boolean;
  tileDensity: number; // 2 to 5 (grid NxN for tiled mode)
  logoUrl: string | null;
  logoName: string | null;
}

export const DEFAULT_WATERMARK_CONFIG: WatermarkConfig = {
  enabled: false,
  styleMode: 'text',
  text: 'Astro.Studio',
  subtext: '35mm Color Lab',
  fontFamily: 'Plus Jakarta Sans',
  italic: false,
  uppercase: false,
  color: '#FFFFFF',
  badgeColor: '#0F172A',
  badgeRadius: 8,
  position: 'bottom-right',
  opacity: 75,
  scale: 2.8,
  letterSpacing: 1,
  rotation: 0,
  marginPct: 4,
  shadowEnabled: true,
  outlineEnabled: false,
  tileDensity: 3,
  logoUrl: null,
  logoName: null,
};

export type ResizeFitMode = 'contain' | 'cover' | 'max-width';
export type OutputFormat = 'jpeg' | 'png' | 'webp' | 'collage';

export interface ResizeConfig {
  enabled: boolean;
  presetId: string;
  width: number;
  height: number;
  fitMode: ResizeFitMode;
  lockAspect: boolean;
}

export interface ExportFormatConfig {
  format: OutputFormat;
  quality: number; // 60 to 100
}

export const DEFAULT_RESIZE_CONFIG: ResizeConfig = {
  enabled: false,
  presetId: 'original',
  width: 1080,
  height: 1350,
  fitMode: 'cover',
  lockAspect: true,
};

export const DEFAULT_EXPORT_FORMAT: ExportFormatConfig = {
  format: 'jpeg',
  quality: 95,
};

export interface EmbeddedEditRecipe {
  app: 'Astro.Studio';
  version: string;
  savedAt: string;
  presetName: string;
  intensity: number;
  settings: FilterSettings;
  watermarkSummary?: string;
}

export interface ParsedExifInfo {
  make?: string;
  model?: string;
  lens?: string;
  focalLength?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: number;
  exposureBias?: string;
  dateTaken?: string;
  colorSpace?: string;
  software?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  recipe?: EmbeddedEditRecipe | null;
}

export const DEFAULT_FILTER_SETTINGS: FilterSettings = {
  backgroundEv: 0,
  shadowCrispness: 0,
  subjectGlow: 0,
  brightness: 0,
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  fade: 0,
  sharpen: 0,
  structure: 0,
  temperature: 0,
  tint: 0,
  vibrance: 0,
  saturation: 0,
  grain: 0,
  vignette: 0,
  shadowTint: { r: 0, g: 0, b: 0, amount: 0 },
  highlightTint: { r: 0, g: 0, b: 0, amount: 0 },
  curves: DEFAULT_TONE_CURVES,
  monochrome: false,
};
