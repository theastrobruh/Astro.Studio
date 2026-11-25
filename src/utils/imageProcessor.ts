import {
  CurvePoint,
  EmbeddedEditRecipe,
  ExportFormatConfig,
  FilterSettings,
  ResizeConfig,
  WatermarkConfig,
} from '../types/editor';
import { embedRecipeIntoBlob } from './exifParser';

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function pixelNoise(idx: number): number {
  let n = (idx ^ 61) ^ (idx >>> 16);
  n = n + (n << 3);
  n = n ^ (n >>> 4);
  n = Math.imul(n, 0x27d4eb2d);
  n = n ^ (n >>> 15);
  return (n & 0xffff) / 32767.5 - 1.0;
}

/**
 * Evaluates a smooth monotonic Catmull-Rom / piecewise curve into a 256-entry LUT.
 */
export function buildCurveLut(points?: CurvePoint[]): Uint8Array {
  const lut = new Uint8Array(256);
  if (!points || points.length < 2) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }

  const sorted = [...points].sort((a, b) => a.x - b.x);
  if (
    sorted.length === 2 &&
    sorted[0].x === 0 &&
    sorted[0].y === 0 &&
    sorted[1].x === 255 &&
    sorted[1].y === 255
  ) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }

  // Ensure endpoints cover 0..255
  const pts: CurvePoint[] = [];
  if (sorted[0].x > 0) pts.push({ x: 0, y: sorted[0].y });
  pts.push(...sorted);
  if (sorted[sorted.length - 1].x < 255) {
    pts.push({ x: 255, y: sorted[sorted.length - 1].y });
  }

  for (let x = 0; x < 256; x++) {
    let seg = 0;
    while (seg < pts.length - 2 && x > pts[seg + 1].x) {
      seg++;
    }
    const p0 = pts[Math.max(0, seg - 1)];
    const p1 = pts[seg];
    const p2 = pts[Math.min(pts.length - 1, seg + 1)];
    const p3 = pts[Math.min(pts.length - 1, seg + 2)];

    const span = Math.max(1, p2.x - p1.x);
    const t = clamp01((x - p1.x) / span);
    const t2 = t * t;
    const t3 = t2 * t;

    // Catmull-Rom spline evaluation
    const y =
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

    lut[x] = Math.round(clamp255(y));
  }
  return lut;
}

export interface ProcessOptions {
  intensity: number; // 0 to 100
}

/**
 * Applies full color grading, tone curves, brightness, whites/blacks,
 * subject-aware background EV, split toning, sharpen, structure, vignette, and film grain.
 */
export function processImageData(
  source: ImageData,
  settings: FilterSettings,
  options: ProcessOptions
): ImageData {
  const { width, height, data: src } = source;
  const output = new ImageData(width, height);
  const dst = output.data;

  const intensityAlpha = clamp01(options.intensity / 100);
  if (intensityAlpha <= 0.001) {
    dst.set(src);
    return output;
  }

  const bgEvFactor =
    settings.backgroundEv <= 0
      ? Math.pow(2, settings.backgroundEv * 0.42)
      : Math.pow(2, settings.backgroundEv * 0.35);

  const expMul = Math.pow(2, settings.exposure * 0.65);
  const brightnessDelta = (settings.brightness / 100) * 0.24;
  const contrastFactor = 1 + (settings.contrast / 100) * 0.85;
  const crispAmt = clamp01(settings.shadowCrispness / 100);
  const glowAmt = clamp01(settings.subjectGlow / 100);

  const hlAdjust = settings.highlights / 100;
  const shAdjust = settings.shadows / 100;
  const whitesAdjust = settings.whites / 100; // -0.5..0.5
  const blacksAdjust = settings.blacks / 100; // -0.5..0.5
  const fadeFloor = (settings.fade / 100) * 0.14;

  const tempShift = settings.temperature / 100;
  const tintShift = settings.tint / 100;
  const wbR = 1 + tempShift * 0.24 + tintShift * 0.08;
  const wbG = 1 - tintShift * 0.16;
  const wbB = 1 - tempShift * 0.24 + tintShift * 0.08;

  const satShift = settings.saturation / 50;
  const vibShift = settings.vibrance / 50;
  const grainStrength = (settings.grain / 100) * 26;
  const vigStrength = (settings.vignette / 100) * 0.38;

  const shTintAmt = settings.shadowTint.amount;
  const shTintR = settings.shadowTint.r / 255;
  const shTintG = settings.shadowTint.g / 255;
  const shTintB = settings.shadowTint.b / 255;

  const hlTintAmt = settings.highlightTint.amount;
  const hlTintR = settings.highlightTint.r / 255;
  const hlTintG = settings.highlightTint.g / 255;
  const hlTintB = settings.highlightTint.b / 255;

  // Precompute curve LUTs
  const rgbLut = buildCurveLut(settings.curves?.rgb);
  const rLut = buildCurveLut(settings.curves?.red);
  const gLut = buildCurveLut(settings.curves?.green);
  const bLut = buildCurveLut(settings.curves?.blue);

  const invW = 1 / Math.max(1, width);
  const invH = 1 / Math.max(1, height);

  const isMono =
    Boolean(settings.monochrome) ||
    (settings.saturation <= -50 && settings.vibrance <= -35);
  const monoMix = isMono ? clamp01(intensityAlpha * 1.45) : 0;

  const needDetailPass =
    settings.sharpen > 0.5 || Math.abs(settings.structure) > 0.5;
  const gradedBuf = needDetailPass ? new Uint8ClampedArray(dst.length) : dst;

  for (let y = 0; y < height; y++) {
    const dyVig = (y * invH - 0.5) * 2;

    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const origR = src[i];
      const origG = src[i + 1];
      const origB = src[i + 2];
      const origA = src[i + 3];

      let r = origR / 255;
      let g = origG / 255;
      let b = origB / 255;

      const dxVig = (x * invW - 0.5) * 2;

      // 1. Tonal & Color-Based Subject Protection (zero spatial circle/spotlight)
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const chroma = maxC - minC;
      const luma0 = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      const warmth = clamp01((r - b) * 2.4);
      const isWarmSkin =
        r > g && r > b && r > 0.22 && chroma > 0.035 && chroma < 0.55
          ? warmth * (1 - smoothstep(0.55, 0.92, chroma))
          : 0;

      const skinProtection = clamp01(isWarmSkin * 0.85);
      const midtoneRichness =
        Math.exp(-Math.pow((luma0 - 0.45) / 0.28, 2)) * clamp01(chroma * 2.5) * 0.35;
      const subjectMask = clamp01(skinProtection + midtoneRichness);
      const bgWeight = 1 - subjectMask * 0.75;

      // 2. Uniform Tone-Aware Background EV
      if (Math.abs(settings.backgroundEv) > 0.01) {
        const toneFactor = smoothstep(0.08, 0.85, luma0) * 0.65 + 0.35;
        const localBgMul = 1 + (bgEvFactor - 1) * bgWeight * toneFactor;
        r *= localBgMul;
        g *= localBgMul;
        b *= localBgMul;
      }

      // 3. Global Exposure + Brightness + White Balance
      r = r * expMul * wbR + brightnessDelta;
      g = g * expMul * wbG + brightnessDelta;
      b = b * expMul * wbB + brightnessDelta;

      // 4. Subject Pop / Skin Luminance Lift
      if (glowAmt > 0.005) {
        const lumaNow = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const midBand = Math.exp(-Math.pow((lumaNow - 0.54) / 0.32, 2));
        const glowWeight = 0.3 + 0.7 * skinProtection;
        const glowLift = 1 + glowAmt * 0.22 * glowWeight * midBand;
        r *= glowLift;
        g *= glowLift;
        b *= glowLift;
      }

      // 5. Highlights, Shadows, Whites & Blacks
      const lumaTone = clamp01(0.2126 * r + 0.7152 * g + 0.0722 * b);
      if (Math.abs(hlAdjust) > 0.005) {
        const hlWeight = smoothstep(0.45, 0.95, lumaTone);
        const hlFactor = 1 + hlAdjust * 0.36 * hlWeight;
        r *= hlFactor;
        g *= hlFactor;
        b *= hlFactor;
      }
      if (Math.abs(shAdjust) > 0.005) {
        const shWeight = 1 - smoothstep(0.05, 0.55, lumaTone);
        const shDelta = shAdjust * 0.22 * shWeight;
        r += shDelta;
        g += shDelta;
        b += shDelta;
      }
      if (Math.abs(whitesAdjust) > 0.005) {
        const wWeight = smoothstep(0.68, 1.0, lumaTone);
        const wDelta = whitesAdjust * 0.35 * wWeight;
        r += wDelta;
        g += wDelta;
        b += wDelta;
      }
      if (Math.abs(blacksAdjust) > 0.005) {
        const bWeight = 1 - smoothstep(0.0, 0.28, lumaTone);
        const bDelta = blacksAdjust * 0.25 * bWeight;
        r += bDelta;
        g += bDelta;
        b += bDelta;
      }

      // 6. Contrast & Shadow Crispness
      if (Math.abs(settings.contrast) > 0.01) {
        r = (r - 0.5) * contrastFactor + 0.5;
        g = (g - 0.5) * contrastFactor + 0.5;
        b = (b - 0.5) * contrastFactor + 0.5;
      }

      if (crispAmt > 0.005) {
        const lumaC = clamp01(0.2126 * r + 0.7152 * g + 0.0722 * b);
        const shadowZone = 1 - smoothstep(0.06, 0.44, lumaC);
        const crushScale = 1 - crispAmt * 0.36 * shadowZone;
        r *= crushScale;
        g *= crushScale;
        b *= crushScale;
      }

      // 7. Vibrance & Saturation
      r = clamp01(r);
      g = clamp01(g);
      b = clamp01(b);

      const maxV = Math.max(r, g, b);
      const minV = Math.min(r, g, b);
      const satNow = maxV - minV;
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      if (isMono) {
        r = gray;
        g = gray;
        b = gray;
      } else {
        const vibFactor = vibShift * (1 - satNow) * (isWarmSkin > 0.2 ? 0.45 : 0.95);
        const totalSatMul =
          clamp01(1 + satShift * 0.75 + vibFactor) +
          Math.max(0, satShift * 0.55 + vibFactor);
        r = gray + (r - gray) * totalSatMul;
        g = gray + (g - gray) * totalSatMul;
        b = gray + (b - gray) * totalSatMul;
      }

      // 8. Split Toning
      const lumaSplit = clamp01(0.2126 * r + 0.7152 * g + 0.0722 * b);
      if (shTintAmt > 0.005) {
        const wSh = (1 - smoothstep(0.12, 0.68, lumaSplit)) * shTintAmt;
        r = r * (1 - wSh) + shTintR * wSh;
        g = g * (1 - wSh) + shTintG * wSh;
        b = b * (1 - wSh) + shTintB * wSh;
      }
      if (hlTintAmt > 0.005) {
        const wHl = smoothstep(0.38, 0.95, lumaSplit) * hlTintAmt;
        r = r * (1 - wHl) + hlTintR * wHl;
        g = g * (1 - wHl) + hlTintG * wHl;
        b = b * (1 - wHl) + hlTintB * wHl;
      }

      // 9. Fade / Matte Black Floor
      if (fadeFloor > 0.001) {
        r = fadeFloor + r * (1 - fadeFloor);
        g = fadeFloor + g * (1 - fadeFloor);
        b = fadeFloor + b * (1 - fadeFloor);
      }

      // 10. Gentle Corner Vignette
      if (vigStrength > 0.005) {
        const r2 = dxVig * dxVig + dyVig * dyVig;
        const vig = 1 - vigStrength * smoothstep(0.85, 2.15, r2);
        r *= vig;
        g *= vig;
        b *= vig;
      }

      // 11. Interactive Tone Curves (RGB Master + R/G/B Channels)
      const ir = rLut[rgbLut[Math.round(clamp01(r) * 255)]];
      const ig = gLut[rgbLut[Math.round(clamp01(g) * 255)]];
      const ib = bLut[rgbLut[Math.round(clamp01(b) * 255)]];

      let outR = ir;
      let outG = ig;
      let outB = ib;

      // 12. Organic Film Grain
      if (grainStrength > 0.1) {
        const n = pixelNoise((y * width + x) | 0) * grainStrength;
        outR = clamp255(outR + n);
        outG = clamp255(outG + n);
        outB = clamp255(outB + n * 0.95);
      }

      if (needDetailPass) {
        gradedBuf[i] = outR;
        gradedBuf[i + 1] = outG;
        gradedBuf[i + 2] = outB;
        gradedBuf[i + 3] = origA;
      } else if (isMono) {
        const origGray = 0.2126 * origR + 0.7152 * origG + 0.0722 * origB;
        const baseR = origR + (origGray - origR) * monoMix;
        const baseG = origG + (origGray - origG) * monoMix;
        const baseB = origB + (origGray - origB) * monoMix;
        dst[i] = Math.round(baseR + (outR - baseR) * intensityAlpha);
        dst[i + 1] = Math.round(baseG + (outG - baseG) * intensityAlpha);
        dst[i + 2] = Math.round(baseB + (outB - baseB) * intensityAlpha);
        dst[i + 3] = origA;
      } else {
        dst[i] = Math.round(origR + (outR - origR) * intensityAlpha);
        dst[i + 1] = Math.round(origG + (outG - origG) * intensityAlpha);
        dst[i + 2] = Math.round(origB + (outB - origB) * intensityAlpha);
        dst[i + 3] = origA;
      }
    }
  }

  // 13. Instagram-style Sharpen & Local Structure / Clarity Pass
  if (needDetailPass) {
    const sharpAmount = (settings.sharpen / 100) * 1.15;
    const structAmount = (settings.structure / 100) * 0.65;

    for (let y = 0; y < height; y++) {
      const yPrev = y > 0 ? y - 1 : 0;
      const yNext = y < height - 1 ? y + 1 : height - 1;
      const yPrev2 = y > 1 ? y - 2 : yPrev;
      const yNext2 = y < height - 2 ? y + 2 : yNext;

      for (let x = 0; x < width; x++) {
        const xPrev = x > 0 ? x - 1 : 0;
        const xNext = x < width - 1 ? x + 1 : width - 1;
        const xPrev2 = x > 1 ? x - 2 : xPrev;
        const xNext2 = x < width - 2 ? x + 2 : xNext;

        const i = (y * width + x) * 4;
        const iUp = (yPrev * width + x) * 4;
        const iDn = (yNext * width + x) * 4;
        const iLt = (y * width + xPrev) * 4;
        const iRt = (y * width + xNext) * 4;

        const iUp2 = (yPrev2 * width + x) * 4;
        const iDn2 = (yNext2 * width + x) * 4;
        const iLt2 = (y * width + xPrev2) * 4;
        const iRt2 = (y * width + xNext2) * 4;

        const origGray = isMono
          ? 0.2126 * src[i] + 0.7152 * src[i + 1] + 0.0722 * src[i + 2]
          : 0;

        for (let c = 0; c < 3; c++) {
          const center = gradedBuf[i + c];
          let val = center;

          if (sharpAmount > 0.005) {
            const blur4 =
              (gradedBuf[iUp + c] +
                gradedBuf[iDn + c] +
                gradedBuf[iLt + c] +
                gradedBuf[iRt + c]) *
              0.25;
            val += (center - blur4) * sharpAmount;
          }

          if (Math.abs(structAmount) > 0.005) {
            const wideBlur =
              (gradedBuf[iUp2 + c] +
                gradedBuf[iDn2 + c] +
                gradedBuf[iLt2 + c] +
                gradedBuf[iRt2 + c] +
                gradedBuf[iUp + c] +
                gradedBuf[iDn + c] +
                gradedBuf[iLt + c] +
                gradedBuf[iRt + c]) *
              0.125;
            // Weight structure toward midtones so highlights/blacks stay clean
            const nVal = center / 255;
            const midMask = 1 - Math.abs(nVal - 0.5) * 1.4;
            val += (center - wideBlur) * structAmount * Math.max(0.15, midMask);
          }

          const origC = src[i + c];
          const baseC = isMono ? origC + (origGray - origC) * monoMix : origC;
          const clamped = clamp255(val);
          dst[i + c] = Math.round(baseC + (clamped - baseC) * intensityAlpha);
        }
        dst[i + 3] = src[i + 3];
      }
    }
  }

  return output;
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

export function getScaledImageData(
  img: HTMLImageElement,
  maxDimension: number
): { imageData: ImageData; width: number; height: number } {
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;
  const scale = Math.min(1, maxDimension / Math.max(naturalW, naturalH));
  const width = Math.max(1, Math.round(naturalW * scale));
  const height = Math.max(1, Math.round(naturalH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Could not acquire 2D canvas context');
  }
  ctx.drawImage(img, 0, 0, width, height);
  return {
    imageData: ctx.getImageData(0, 0, width, height),
    width,
    height,
  };
}

export function imageDataToDataUrl(data: ImageData, quality = 0.85): string {
  const canvas = document.createElement('canvas');
  canvas.width = data.width;
  canvas.height = data.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Computes exact output width/height for single or batch export based on ResizeConfig.
 */
export function computeTargetDimensions(
  srcWidth: number,
  srcHeight: number,
  resize?: ResizeConfig
): { width: number; height: number } {
  if (!resize || !resize.enabled || resize.presetId === 'original') {
    return { width: srcWidth, height: srcHeight };
  }
  const targetW = Math.max(64, Math.round(resize.width || srcWidth));
  const targetH = Math.max(64, Math.round(resize.height || srcHeight));

  if (resize.fitMode === 'max-width') {
    const scale = Math.min(1, targetW / Math.max(1, srcWidth));
    return {
      width: Math.max(1, Math.round(srcWidth * scale)),
      height: Math.max(1, Math.round(srcHeight * scale)),
    };
  }

  if (resize.fitMode === 'contain') {
    const ratio = Math.min(targetW / Math.max(1, srcWidth), targetH / Math.max(1, srcHeight));
    return {
      width: Math.max(1, Math.round(srcWidth * ratio)),
      height: Math.max(1, Math.round(srcHeight * ratio)),
    };
  }

  // cover
  return { width: targetW, height: targetH };
}

/**
 * Draws a processed canvas into a target resized canvas (supporting cover crop, contain, max-width).
 */
export function resizeCanvas(
  sourceCanvas: HTMLCanvasElement,
  resize?: ResizeConfig
): HTMLCanvasElement {
  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;
  const target = computeTargetDimensions(srcW, srcH, resize);

  if (target.width === srcW && target.height === srcH) {
    return sourceCanvas;
  }

  const out = document.createElement('canvas');
  out.width = target.width;
  out.height = target.height;
  const ctx = out.getContext('2d');
  if (!ctx) return sourceCanvas;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (resize?.fitMode === 'cover') {
    const scale = Math.max(target.width / srcW, target.height / srcH);
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    const dx = (target.width - drawW) / 2;
    const dy = (target.height - drawH) / 2;
    ctx.drawImage(sourceCanvas, dx, dy, drawW, drawH);
  } else {
    ctx.drawImage(sourceCanvas, 0, 0, target.width, target.height);
  }

  return out;
}

/**
 * Draws rich, customizable watermarks (Text, Badge, Tiled, or Logo image).
 */
export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  watermark?: WatermarkConfig,
  loadedLogoImg?: HTMLImageElement | null
): void {
  if (!watermark || !watermark.enabled) return;

  const baseDim = Math.min(width, height);
  const scaleFactor = (watermark.scale || 2.8) / 100;
  const fontSize = Math.max(12, Math.round(baseDim * scaleFactor));
  const margin = Math.max(12, Math.round(baseDim * ((watermark.marginPct ?? 4) / 100)));

  const rawText = watermark.text.trim();
  const displayText = watermark.uppercase ? rawText.toUpperCase() : rawText;
  const subtext = watermark.subtext?.trim() || '';

  ctx.save();
  ctx.globalAlpha = clamp01(watermark.opacity / 100);

  // Logo image mode
  if (watermark.styleMode === 'logo' && loadedLogoImg) {
    const logoTargetW = Math.max(28, Math.round(baseDim * (scaleFactor * 3.2)));
    const logoAspect =
      (loadedLogoImg.naturalHeight || loadedLogoImg.height) /
      Math.max(1, loadedLogoImg.naturalWidth || loadedLogoImg.width);
    const logoTargetH = Math.max(20, Math.round(logoTargetW * logoAspect));

    const { cx, cy } = resolveAnchorCenter(
      width,
      height,
      margin,
      logoTargetW,
      logoTargetH,
      watermark.position
    );
    ctx.translate(cx, cy);
    ctx.rotate((watermark.rotation * Math.PI) / 180);
    if (watermark.shadowEnabled) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 2;
    }
    ctx.drawImage(loadedLogoImg, -logoTargetW / 2, -logoTargetH / 2, logoTargetW, logoTargetH);
    ctx.restore();
    return;
  }

  if (!displayText) {
    ctx.restore();
    return;
  }

  const italicStr = watermark.italic ? 'italic ' : '';
  const fontStack = `"${watermark.fontFamily}", "Plus Jakarta Sans", sans-serif`;
  ctx.font = `${italicStr}700 ${fontSize}px ${fontStack}`;

  // Apply letter spacing cleanly when supported
  if ('letterSpacing' in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${
      watermark.letterSpacing || 0
    }px`;
  }

  // Tiled Pattern Mode
  if (watermark.styleMode === 'tiled') {
    const density = Math.max(2, Math.min(5, watermark.tileDensity || 3));
    const stepX = width / density;
    const stepY = height / density;
    const rotRad = ((watermark.rotation || -28) * Math.PI) / 180;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = watermark.color || '#FFFFFF';

    for (let row = 0; row < density; row++) {
      for (let col = 0; col < density; col++) {
        const px = (col + 0.5) * stepX + (row % 2 === 1 ? stepX * 0.25 : 0);
        const py = (row + 0.5) * stepY;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rotRad);
        if (watermark.outlineEnabled) {
          ctx.lineWidth = Math.max(1.5, fontSize * 0.08);
          ctx.strokeStyle = 'rgba(0,0,0,0.65)';
          ctx.strokeText(displayText, 0, 0);
        }
        ctx.fillText(displayText, 0, 0);
        ctx.restore();
      }
    }
    ctx.restore();
    return;
  }

  // Measure primary text + optional subtext
  const metrics = ctx.measureText(displayText);
  const subFontSize = Math.max(9, Math.round(fontSize * 0.52));
  let subW = 0;
  if (watermark.styleMode === 'badge' && subtext) {
    ctx.save();
    ctx.font = `500 ${subFontSize}px ${fontStack}`;
    subW = ctx.measureText(subtext).width;
    ctx.restore();
  }

  const contentW = Math.max(metrics.width, subW);
  const padX = watermark.styleMode === 'badge' ? Math.round(fontSize * 0.75) : 0;
  const padY = watermark.styleMode === 'badge' ? Math.round(fontSize * 0.45) : 0;
  const subH = watermark.styleMode === 'badge' && subtext ? subFontSize + Math.round(fontSize * 0.22) : 0;
  const boxW = contentW + padX * 2;
  const boxH = fontSize * 1.15 + subH + padY * 2;

  const { cx, cy } = resolveAnchorCenter(width, height, margin, boxW, boxH, watermark.position);

  ctx.translate(cx, cy);
  ctx.rotate(((watermark.rotation || 0) * Math.PI) / 180);

  if (watermark.shadowEnabled) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.58)';
    ctx.shadowBlur = Math.max(4, Math.round(fontSize * 0.35));
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.max(1, Math.round(fontSize * 0.09));
  }

  if (watermark.styleMode === 'badge') {
    const r = Math.min(watermark.badgeRadius ?? 8, boxH / 2);
    ctx.fillStyle = watermark.badgeColor || '#0F172A';
    roundRectPath(ctx, -boxW / 2, -boxH / 2, boxW, boxH, r);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = watermark.color || '#FFFFFF';

    const mainY = subH > 0 ? -subH / 2 : 0;
    ctx.fillText(displayText, 0, mainY);

    if (subtext) {
      ctx.font = `500 ${subFontSize}px ${fontStack}`;
      ctx.globalAlpha = clamp01((watermark.opacity / 100) * 0.78);
      ctx.fillText(subtext, 0, mainY + fontSize * 0.78);
    }
  } else {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (watermark.outlineEnabled) {
      ctx.lineWidth = Math.max(2, fontSize * 0.09);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.strokeText(displayText, 0, 0);
    }
    ctx.fillStyle = watermark.color || '#FFFFFF';
    ctx.fillText(displayText, 0, 0);
  }

  ctx.restore();
}

function resolveAnchorCenter(
  width: number,
  height: number,
  margin: number,
  boxW: number,
  boxH: number,
  position: WatermarkConfig['position']
): { cx: number; cy: number } {
  let cx = width / 2;
  let cy = height / 2;

  if (position.includes('left')) cx = margin + boxW / 2;
  else if (position.includes('right')) cx = width - margin - boxW / 2;

  if (position.startsWith('top')) cy = margin + boxH / 2;
  else if (position.startsWith('bottom')) cy = height - margin - boxH / 2;

  return { cx, cy };
}

/**
 * Renders a graded, resized, and optionally watermarked HTMLImageElement to a Blob.
 */
export async function renderGradedOutput(
  img: HTMLImageElement,
  settings: FilterSettings,
  intensity: number,
  formatConfig: ExportFormatConfig,
  resizeConfig?: ResizeConfig,
  watermark?: WatermarkConfig,
  loadedLogoImg?: HTMLImageElement | null,
  presetName = 'Custom Edit',
  maxSourceDim = 3600
): Promise<{ blob: Blob; width: number; height: number; ext: 'jpg' | 'png' | 'webp' }> {
  const { imageData: origData, width: srcW, height: srcH } = getScaledImageData(img, maxSourceDim);
  const gradedData = processImageData(origData, settings, { intensity });

  const qualityFloat = clamp01((formatConfig.quality || 95) / 100);

  if (formatConfig.format === 'collage') {
    const beforeRaw = document.createElement('canvas');
    beforeRaw.width = srcW;
    beforeRaw.height = srcH;
    beforeRaw.getContext('2d')?.putImageData(origData, 0, 0);
    const beforeCanvas = resizeCanvas(beforeRaw, resizeConfig);

    const afterRaw = document.createElement('canvas');
    afterRaw.width = srcW;
    afterRaw.height = srcH;
    afterRaw.getContext('2d')?.putImageData(gradedData, 0, 0);
    const afterCanvas = resizeCanvas(afterRaw, resizeConfig);
    const afterCtx = afterCanvas.getContext('2d');
    if (afterCtx) {
      drawWatermark(afterCtx, afterCanvas.width, afterCanvas.height, watermark, loadedLogoImg);
    }

    const w = afterCanvas.width;
    const h = afterCanvas.height;
    const pad = Math.max(24, Math.round(w * 0.03));
    const gap = Math.max(16, Math.round(w * 0.02));
    const totalW = pad * 2 + w * 2 + gap;
    const totalH = pad * 2 + h;

    const canvas = document.createElement('canvas');
    canvas.width = totalW;
    canvas.height = totalH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, totalW, totalH);
    ctx.drawImage(beforeCanvas, pad, pad);
    ctx.drawImage(afterCanvas, pad + w + gap, pad);

    const fontSize = Math.max(16, Math.round(w * 0.026));
    const pillH = Math.round(fontSize * 1.9);
    const pillPadX = Math.round(fontSize * 0.9);
    const inset = Math.max(16, Math.round(w * 0.025));
    ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.textBaseline = 'middle';

    const beforeText = 'BEFORE';
    const beforeW = ctx.measureText(beforeText).width + pillPadX * 2;
    ctx.fillStyle = 'rgba(18, 24, 34, 0.86)';
    roundRectPath(ctx, pad + inset, pad + inset, beforeW, pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(beforeText, pad + inset + pillPadX, pad + inset + pillH / 2 + 1);

    const afterText = 'AFTER';
    const afterW = ctx.measureText(afterText).width + pillPadX * 2;
    const afterX = pad + w + gap + w - inset - afterW;
    ctx.fillStyle = '#0EA5E9';
    roundRectPath(ctx, afterX, pad + inset, afterW, pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(afterText, afterX + pillPadX, pad + inset + pillH / 2 + 1);

    const rawBlob = await canvasToBlob(canvas, 'image/jpeg', qualityFloat);
    const recipe: EmbeddedEditRecipe = {
      app: 'Astro.Studio',
      version: '1.0',
      savedAt: new Date().toISOString(),
      presetName,
      intensity,
      settings,
      watermarkSummary: watermark?.enabled ? watermark.text : undefined,
    };
    const blob = await embedRecipeIntoBlob(rawBlob, 'jpg', recipe);
    return { blob, width: totalW, height: totalH, ext: 'jpg' };
  }

  const gradedRaw = document.createElement('canvas');
  gradedRaw.width = srcW;
  gradedRaw.height = srcH;
  gradedRaw.getContext('2d')?.putImageData(gradedData, 0, 0);

  const outCanvas = resizeCanvas(gradedRaw, resizeConfig);
  const outCtx = outCanvas.getContext('2d');
  if (outCtx) {
    drawWatermark(outCtx, outCanvas.width, outCanvas.height, watermark, loadedLogoImg);
  }

  const ext: 'jpg' | 'png' | 'webp' =
    formatConfig.format === 'png'
      ? 'png'
      : formatConfig.format === 'webp'
      ? 'webp'
      : 'jpg';
  const mime =
    ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  const rawBlob = await canvasToBlob(outCanvas, mime, ext === 'png' ? 1 : qualityFloat);
  const recipe: EmbeddedEditRecipe = {
    app: 'Astro.Studio',
    version: '1.0',
    savedAt: new Date().toISOString(),
    presetName,
    intensity,
    settings,
    watermarkSummary: watermark?.enabled ? watermark.text : undefined,
  };
  const blob = await embedRecipeIntoBlob(rawBlob, ext, recipe);
  return { blob, width: outCanvas.width, height: outCanvas.height, ext };
}

export async function exportGradedPhoto(
  img: HTMLImageElement,
  settings: FilterSettings,
  intensity: number,
  formatConfig: ExportFormatConfig,
  presetName: string,
  resizeConfig?: ResizeConfig,
  watermark?: WatermarkConfig,
  loadedLogoImg?: HTMLImageElement | null
): Promise<void> {
  const slug = presetName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const { blob, ext } = await renderGradedOutput(
    img,
    settings,
    intensity,
    formatConfig,
    resizeConfig,
    watermark,
    loadedLogoImg,
    presetName,
    4096
  );
  const filename =
    formatConfig.format === 'collage'
      ? `astro-studio-${slug}-before-after.jpg`
      : `astro-studio-${slug}.${ext}`;
  triggerBlobDownload(blob, filename);
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Failed to encode image'));
        else resolve(blob);
      },
      mimeType,
      quality
    );
  });
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
