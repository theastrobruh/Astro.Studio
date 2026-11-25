import exifr from 'exifr';
import { EmbeddedEditRecipe, ParsedExifInfo } from '../types/editor';

const RECIPE_PREFIX = 'AstroStudioRecipe:';

function formatShutterSpeed(exposureTime?: number): string | undefined {
  if (!exposureTime || exposureTime <= 0) return undefined;
  if (exposureTime >= 1) return `${exposureTime.toFixed(1).replace(/\.0$/, '')}s`;
  const denom = Math.round(1 / exposureTime);
  return `1/${denom}s`;
}

function formatDateTaken(dt: unknown): string | undefined {
  if (!dt) return undefined;
  const d = dt instanceof Date ? dt : new Date(String(dt));
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function extractRecipeFromString(str: unknown): EmbeddedEditRecipe | null {
  if (typeof str !== 'string') return null;
  const idx = str.indexOf(RECIPE_PREFIX);
  if (idx === -1) return null;
  const jsonPart = str.slice(idx + RECIPE_PREFIX.length).trim();
  try {
    const parsed = JSON.parse(jsonPart) as EmbeddedEditRecipe;
    if (parsed && parsed.app === 'Astro.Studio' && parsed.settings) {
      return parsed;
    }
  } catch {
    // Ignore malformed JSON
  }
  return null;
}

/**
 * Scans raw PNG tEXt chunks or JPEG COM (0xFFFE) segments for embedded Astro.Studio edit recipes.
 */
function scanBinaryForRecipe(bytes: Uint8Array): EmbeddedEditRecipe | null {
  // Check PNG signature
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    let offset = 8;
    const decoder = new TextDecoder('utf-8');
    while (offset + 12 <= bytes.length) {
      const length =
        ((bytes[offset] << 24) |
          (bytes[offset + 1] << 16) |
          (bytes[offset + 2] << 8) |
          bytes[offset + 3]) >>>
        0;
      const type = decoder.decode(bytes.subarray(offset + 4, offset + 8));
      const dataStart = offset + 8;
      const dataEnd = dataStart + length;
      if (dataEnd > bytes.length) break;

      if (type === 'tEXt' || type === 'iTXt') {
        const chunkText = decoder.decode(bytes.subarray(dataStart, dataEnd));
        const recipe = extractRecipeFromString(chunkText.replace(/\0/g, ''));
        if (recipe) return recipe;
      }
      if (type === 'IEND') break;
      offset = dataEnd + 4;
    }
  }

  // Check JPEG SOI
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    const decoder = new TextDecoder('utf-8');
    while (offset + 4 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      if (marker === 0xda || marker === 0xd9) break; // SOS / EOI
      if (marker >= 0xd0 && marker <= 0xd8) {
        offset += 2;
        continue;
      }
      const segLen = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (segLen < 2 || offset + 2 + segLen > bytes.length) break;
      if (marker === 0xfe || marker === 0xe1) {
        const text = decoder.decode(bytes.subarray(offset + 4, offset + 2 + segLen));
        const recipe = extractRecipeFromString(text);
        if (recipe) return recipe;
      }
      offset += 2 + segLen;
    }
  }

  return null;
}

/**
 * Parses EXIF metadata + any embedded Astro.Studio edit recipe from a File or image URL.
 */
export async function parsePhotoMetadata(
  source: File | string,
  meta?: { sizeBytes?: number; mimeType?: string }
): Promise<ParsedExifInfo> {
  const result: ParsedExifInfo = {
    fileSizeBytes: source instanceof File ? source.size : meta?.sizeBytes,
    mimeType: source instanceof File ? source.type : meta?.mimeType,
    recipe: null,
  };

  try {
    let buffer: ArrayBuffer;
    if (source instanceof File) {
      buffer = await source.arrayBuffer();
    } else {
      const resp = await fetch(source);
      if (!resp.ok) return result;
      const blob = await resp.blob();
      result.fileSizeBytes = result.fileSizeBytes ?? blob.size;
      result.mimeType = result.mimeType ?? blob.type;
      buffer = await blob.arrayBuffer();
    }

    const bytes = new Uint8Array(buffer);
    result.recipe = scanBinaryForRecipe(bytes);

    const parsed = await exifr.parse(bytes, {
      tiff: true,
      exif: true,
      xmp: true,
      iptc: true,
    });

    if (parsed && typeof parsed === 'object') {
      if (parsed.Make) result.make = String(parsed.Make).trim();
      if (parsed.Model) result.model = String(parsed.Model).trim();
      if (parsed.LensModel) result.lens = String(parsed.LensModel).trim();
      else if (parsed.Lens) result.lens = String(parsed.Lens).trim();

      if (typeof parsed.FocalLength === 'number') {
        result.focalLength = `${Math.round(parsed.FocalLength * 10) / 10}mm`;
      }
      if (typeof parsed.FNumber === 'number') {
        result.aperture = `f/${Number(parsed.FNumber.toFixed(1))}`;
      }
      if (typeof parsed.ExposureTime === 'number') {
        result.shutterSpeed = formatShutterSpeed(parsed.ExposureTime);
      }
      if (typeof parsed.ISO === 'number') {
        result.iso = parsed.ISO;
      }
      if (typeof parsed.ExposureCompensation === 'number') {
        const bias = parsed.ExposureCompensation;
        result.exposureBias = `${bias > 0 ? '+' : ''}${bias.toFixed(1)} EV`;
      }
      result.dateTaken = formatDateTaken(parsed.DateTimeOriginal || parsed.CreateDate);
      if (parsed.Software) result.software = String(parsed.Software).trim();
      if (parsed.ColorSpace === 1 || parsed.ColorSpace === 'sRGB') {
        result.colorSpace = 'sRGB';
      } else if (parsed.ColorSpace) {
        result.colorSpace = String(parsed.ColorSpace);
      }

      if (!result.recipe) {
        result.recipe =
          extractRecipeFromString(parsed.ImageDescription) ||
          extractRecipeFromString(parsed.UserComment) ||
          extractRecipeFromString(parsed.Description);
      }
    }
  } catch {
    // Gracefully return whatever metadata was extracted
  }

  return result;
}

// CRC32 table for valid PNG tEXt chunk injection
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Embeds an Astro.Studio edit recipe inside exported PNG or JPEG binaries so re-uploading
 * an edited photo reveals exactly how it was graded.
 */
export async function embedRecipeIntoBlob(
  blob: Blob,
  ext: 'jpg' | 'png' | 'webp',
  recipe: EmbeddedEditRecipe
): Promise<Blob> {
  if (ext === 'webp') return blob;

  const payloadText = `${RECIPE_PREFIX}${JSON.stringify(recipe)}`;
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(payloadText);

  try {
    const buffer = await blob.arrayBuffer();
    const src = new Uint8Array(buffer);

    if (ext === 'jpg') {
      if (src.length < 4 || src[0] !== 0xff || src[1] !== 0xd8) return blob;
      // JPEG COM segment: FF FE [2-byte big-endian length including length bytes] [data]
      const segDataLen = Math.min(payloadBytes.length, 65000);
      const segTotalLen = 4 + segDataLen;
      const out = new Uint8Array(src.length + segTotalLen);
      out.set(src.subarray(0, 2), 0); // SOI
      out[2] = 0xff;
      out[3] = 0xfe;
      const lenField = segDataLen + 2;
      out[4] = (lenField >> 8) & 0xff;
      out[5] = lenField & 0xff;
      out.set(payloadBytes.subarray(0, segDataLen), 6);
      out.set(src.subarray(2), 2 + segTotalLen);
      return new Blob([out], { type: blob.type });
    }

    if (ext === 'png') {
      if (src.length < 33 || src[0] !== 0x89 || src[1] !== 0x50) return blob;
      // Insert tEXt chunk right after IHDR (byte 33)
      const keyword = encoder.encode('AstroStudioRecipe\0');
      const chunkData = new Uint8Array(keyword.length + payloadBytes.length);
      chunkData.set(keyword, 0);
      chunkData.set(payloadBytes, keyword.length);

      const typeBytes = encoder.encode('tEXt');
      const crcInput = new Uint8Array(4 + chunkData.length);
      crcInput.set(typeBytes, 0);
      crcInput.set(chunkData, 4);
      const crc = crc32(crcInput);

      const chunkTotalLen = 12 + chunkData.length;
      const chunk = new Uint8Array(chunkTotalLen);
      const len = chunkData.length;
      chunk[0] = (len >>> 24) & 0xff;
      chunk[1] = (len >>> 16) & 0xff;
      chunk[2] = (len >>> 8) & 0xff;
      chunk[3] = len & 0xff;
      chunk.set(typeBytes, 4);
      chunk.set(chunkData, 8);
      chunk[8 + len] = (crc >>> 24) & 0xff;
      chunk[9 + len] = (crc >>> 16) & 0xff;
      chunk[10 + len] = (crc >>> 8) & 0xff;
      chunk[11 + len] = crc & 0xff;

      const insertAt = 33; // Immediately after PNG sig (8) + IHDR chunk (25)
      const out = new Uint8Array(src.length + chunkTotalLen);
      out.set(src.subarray(0, insertAt), 0);
      out.set(chunk, insertAt);
      out.set(src.subarray(insertAt), insertAt + chunkTotalLen);
      return new Blob([out], { type: blob.type });
    }
  } catch {
    return blob;
  }

  return blob;
}
