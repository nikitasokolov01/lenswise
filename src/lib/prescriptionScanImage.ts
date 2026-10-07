/** Local, bounded Rx-photo preparation. No OCR, storage, or network access. */
export interface PrescriptionImageCrop {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PrescriptionImageOptions {
  /** Estimated letter/number height in the original source canvas, in pixels. */
  estimatedWordHeight?: number;
  /** Focused numeric cells may benefit from a modest minimum enlargement. */
  minimumScale?: number;
}

export interface PrescriptionImagePlan {
  source: { x: number; y: number; width: number; height: number };
  width: number;
  height: number;
  scale: number;
}

const MAX_SIDE = 4000;
const MAX_PIXELS = 6_000_000;

/** Upscale small tables without stretching or allocating an unbounded canvas. */
export function planPrescriptionScanImage(
  sourceWidth: number,
  sourceHeight: number,
  crop: PrescriptionImageCrop,
  options: PrescriptionImageOptions = {},
): PrescriptionImagePlan {
  const dimensions = [sourceWidth, sourceHeight, crop.left, crop.top, crop.width, crop.height];
  if (!dimensions.every(Number.isFinite) || sourceWidth <= 0 || sourceHeight <= 0
    || crop.left < 0 || crop.top < 0 || crop.width <= 0 || crop.height <= 0
    || crop.left + crop.width > 1.000001 || crop.top + crop.height > 1.000001) {
    throw new RangeError("Choose a valid crop around the prescription table.");
  }
  const width = Math.min(crop.width, 1 - crop.left) * sourceWidth;
  const height = Math.min(crop.height, 1 - crop.top) * sourceHeight;
  if (!Number.isFinite(width * height) || width < 1 || height < 1) throw new RangeError("The prescription crop is invalid or too small.");
  const longestSide = Math.max(width, height);
  const wordHeight = options.estimatedWordHeight;
  // A known small glyph height can justify more enlargement than an arbitrary
  // whole-page size. Do not discard existing detail merely to hit the target.
  const textScale = wordHeight !== undefined && Number.isFinite(wordHeight) && wordHeight > 0
    ? Math.max(1, Math.min(4, 34 / wordHeight))
    : longestSide >= 1200 ? 1 : Math.max(1, Math.min(2, 1800 / longestSide));
  const minimumScale = options.minimumScale;
  if (minimumScale !== undefined && (!Number.isFinite(minimumScale) || minimumScale < 1 || minimumScale > 4)) {
    throw new RangeError("Prescription image enlargement must be between one and four.");
  }
  const requestedScale = Math.max(textScale, minimumScale ?? 1);
  const scale = Math.min(requestedScale, MAX_SIDE / longestSide, Math.sqrt(MAX_PIXELS / (width * height)));
  return {
    source: { x: crop.left * sourceWidth, y: crop.top * sourceHeight, width, height },
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
    scale,
  };
}

function validatePixels(rgba: Uint8ClampedArray, width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0
    || width > MAX_SIDE || height > MAX_SIDE || width * height > MAX_PIXELS
    || rgba.length !== width * height * 4) {
    throw new RangeError("Prescription image pixels must match bounded, positive dimensions.");
  }
}

function grayValues(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  validatePixels(rgba, width, height);
  const gray = new Uint8Array(width * height);
  for (let pixel = 0; pixel < gray.length; pixel++) {
    const offset = pixel * 4;
    const alpha = rgba[offset + 3] / 255;
    const luminance = rgba[offset] * 0.2126 + rgba[offset + 1] * 0.7152 + rgba[offset + 2] * 0.0722;
    // A transparent document background is paper white, not black ink.
    gray[pixel] = Math.round(luminance * alpha + 255 * (1 - alpha));
  }
  return gray;
}

/** Grayscale only: keep the first reading independent of edge enhancement. */
export function grayscalePrescriptionPixels(rgba: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const gray = grayValues(rgba, width, height);
  const output = new Uint8ClampedArray(rgba.length);
  for (let pixel = 0; pixel < gray.length; pixel++) {
    const offset = pixel * 4;
    output[offset] = output[offset + 1] = output[offset + 2] = gray[pixel];
    output[offset + 3] = 255;
  }
  return output;
}

/**
 * Only for an observed numeric cell: remove long, thin, near-edge grid rules.
 * A temporary contrast mask locates rules; all other pixels keep grayscale.
 * Short minus/plus strokes and decimal dots cannot meet the coverage test.
 */
export function cleanPrescriptionCellPixels(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  options: { padding?: number } = {},
): Uint8ClampedArray {
  const gray = grayValues(rgba, width, height);
  const output = grayscalePrescriptionPixels(rgba, width, height);
  const padding = options.padding ?? 0;
  if (!Number.isInteger(padding) || padding < 0 || padding * 2 >= Math.min(width, height)) {
    throw new RangeError("Prescription cell padding must fit inside the image.");
  }
  const x0 = padding;
  const x1 = width - padding;
  const y0 = padding;
  const y1 = height - padding;
  const value = (x: number, y: number) => gray[y * width + x];

  for (const horizontal of [true, false]) {
    const first = horizontal ? y0 : x0;
    const last = horizontal ? y1 : x1;
    const spanFirst = horizontal ? x0 : y0;
    const spanLast = horizontal ? x1 : y1;
    const spanLength = spanLast - spanFirst;
    const minimumHits = Math.max(32, Math.ceil(spanLength * 0.86));
    if (spanLength < 32) continue;
    const edgeBand = Math.max(3, Math.ceil((last - first) * 0.22));
    const candidates: { position: number; start: number; end: number; tone: number }[] = [];
    const pixel = (position: number, along: number) => horizontal ? value(along, position) : value(position, along);
    const contrast = (position: number, along: number) => Math.max(
      pixel(Math.max(first, position - 4), along), pixel(Math.min(last - 1, position + 4), along),
      pixel(Math.max(first, position - 6), along), pixel(Math.min(last - 1, position + 6), along),
    ) - pixel(position, along);

    for (let position = first; position < last; position++) {
      if (position >= first + edgeBand && position < last - edgeBand) continue;
      let hits = 0;
      let start = spanLast;
      let end = spanFirst;
      const histogram = new Uint32Array(256);
      for (let along = spanFirst; along < spanLast; along++) {
        if (contrast(position, along) < 4) continue;
        hits++;
        start = Math.min(start, along);
        end = along + 1;
        histogram[pixel(position, along)]++;
      }
      if (hits < minimumHits || hits / (end - start) < 0.88) continue;
      let count = 0;
      let tone = 0;
      for (; tone < 255; tone++) { count += histogram[tone]; if (count >= hits / 2) break; }
      candidates.push({ position, start, end, tone });
    }
    // A wide dark band is not a one-to-three-pixel ruling stroke.
    for (let index = 0; index < candidates.length;) {
      let endIndex = index + 1;
      while (endIndex < candidates.length && candidates[endIndex].position === candidates[endIndex - 1].position + 1) endIndex++;
      if (endIndex - index <= 3) {
        for (let line = index; line < endIndex; line++) {
          const rule = candidates[line];
          for (let along = rule.start; along < rule.end; along++) {
            // Preserve materially darker ink crossing a light-gray grid line.
            if (pixel(rule.position, along) < rule.tone - 24 || contrast(rule.position, along) < 4) continue;
            const x = horizontal ? along : rule.position;
            const y = horizontal ? rule.position : along;
            const offset = (y * width + x) * 4;
            output[offset] = output[offset + 1] = output[offset + 2] = 255;
          }
        }
      }
      index = endIndex;
    }
  }
  return output;
}

/** Pixel coordinates inside the supplied, already-observed numeric cell. */
export interface PrescriptionCellInkBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Geometry only. Crop ORIGINAL grayscale pixels to this box; do not OCR the
 * temporary masks. A strong dark seed is required and weaker short components
 * are retained for signs/dots. Uncertain/full-cell bounds return null.
 */
export function findPrescriptionCellInkBounds(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  options: { padding?: number; margin?: number } = {},
): PrescriptionCellInkBounds | null {
  const gray = grayValues(rgba, width, height);
  const padding = options.padding ?? 0;
  const margin = options.margin ?? 6;
  if (!Number.isInteger(padding) || padding < 0 || padding * 2 >= Math.min(width, height)
    || !Number.isInteger(margin) || margin < 0 || margin > 32) {
    throw new RangeError("Prescription cell padding/margin must fit inside the image.");
  }
  const left = padding;
  const top = padding;
  const right = width - padding;
  const bottom = height - padding;
  const contentWidth = right - left;
  const contentHeight = bottom - top;
  const histogram = new Uint32Array(256);
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) histogram[gray[y * width + x]]++;
  let total = 0;
  let background = 0;
  for (; background < 255; background++) {
    total += histogram[background];
    if (total >= contentWidth * contentHeight * 0.9) break;
  }
  if (background < 150) return null;
  const strongThreshold = Math.min(110, background - 70);
  const weakThreshold = Math.max(strongThreshold, background - 20);
  let darkPixels = 0;
  for (let value = 0; value <= strongThreshold; value++) darkPixels += histogram[value];
  if (darkPixels > contentWidth * contentHeight * 0.35) return null;
  const seen = new Uint8Array(width * height);
  const queue = new Uint32Array(contentWidth * contentHeight);
  let inkLeft = right;
  let inkTop = bottom;
  let inkRight = left;
  let inkBottom = top;
  let strongCount = 0;
  const edgeX = Math.max(3, Math.ceil(contentWidth * 0.22));
  const edgeY = Math.max(3, Math.ceil(contentHeight * 0.22));

  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
    const seed = y * width + x;
    if (seen[seed] || gray[seed] > strongThreshold) continue;
    let head = 0;
    let tail = 1;
    queue[0] = seed;
    seen[seed] = 1;
    let x0 = x;
    let x1 = x + 1;
    let y0 = y;
    let y1 = y + 1;
    let componentStrong = 0;
    let interiorStrong = false;
    let onlyBorderBand = true;
    while (head < tail) {
      const pixel = queue[head++];
      const px = pixel % width;
      const py = Math.floor(pixel / width);
      x0 = Math.min(x0, px); x1 = Math.max(x1, px + 1);
      y0 = Math.min(y0, py); y1 = Math.max(y1, py + 1);
      const interior = px >= left + edgeX && px < right - edgeX && py >= top + edgeY && py < bottom - edgeY;
      if (interior) onlyBorderBand = false;
      if (gray[pixel] <= strongThreshold) {
        componentStrong++;
        if (interior) interiorStrong = true;
      }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = px + dx;
        const ny = py + dy;
        if (nx < left || nx >= right || ny < top || ny >= bottom) continue;
        const next = ny * width + nx;
        if (!seen[next] && gray[next] <= strongThreshold) { seen[next] = 1; queue[tail++] = next; }
      }
    }
    const boxWidth = x1 - x0;
    const boxHeight = y1 - y0;
    const across = boxWidth >= Math.max(32, contentWidth * 0.82) && x0 <= left + 3 && x1 >= right - 3;
    const down = boxHeight >= Math.max(32, contentHeight * 0.82) && y0 <= top + 3 && y1 >= bottom - 3;
    const horizontalRule = across && boxHeight <= 8 && tail <= boxWidth * 3.2 && (y0 < top + edgeY || y1 > bottom - edgeY);
    const verticalRule = down && boxWidth <= 8 && tail <= boxHeight * 3.2 && (x0 < left + edgeX || x1 > right - edgeX);
    const borderRectangle = across && down && onlyBorderBand && tail <= (boxWidth + boxHeight) * 6;
    if (!interiorStrong && (horizontalRule || verticalRule || borderRectangle)) continue;
    inkLeft = Math.min(inkLeft, x0); inkRight = Math.max(inkRight, x1);
    inkTop = Math.min(inkTop, y0); inkBottom = Math.max(inkBottom, y1);
    strongCount += componentStrong;
  }
  if (strongCount < 4 || inkLeft >= inkRight || inkTop >= inkBottom) return null;
  // Ink touching the observed boundary may already be clipped; no tighter crop.
  if (inkLeft <= left || inkRight >= right || inkTop <= top || inkBottom >= bottom) return null;
  // Weak paper shadows can connect an entire cell. Only consider short weak
  // components in the observed text band; the original pixels remain untouched.
  const bandTop = Math.max(top, inkTop - margin);
  const bandBottom = Math.min(bottom, inkBottom + margin);
  const maximumWeakWidth = Math.max(inkRight - inkLeft, contentWidth * 0.65);
  seen.fill(0);
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
    const seed = y * width + x;
    if (seen[seed] || gray[seed] > weakThreshold) continue;
    let head = 0;
    let tail = 1;
    queue[0] = seed;
    seen[seed] = 1;
    let x0 = x; let x1 = x + 1;
    let y0 = y; let y1 = y + 1;
    while (head < tail) {
      const pixel = queue[head++];
      const px = pixel % width;
      const py = Math.floor(pixel / width);
      x0 = Math.min(x0, px); x1 = Math.max(x1, px + 1);
      y0 = Math.min(y0, py); y1 = Math.max(y1, py + 1);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = px + dx; const ny = py + dy;
        if (nx < left || nx >= right || ny < top || ny >= bottom) continue;
        const next = ny * width + nx;
        if (!seen[next] && gray[next] <= weakThreshold) { seen[next] = 1; queue[tail++] = next; }
      }
    }
    // Near-edge shadows or large connected background patches are not evidence
    // of a printed sign. Short isolated plus/minus/dot components are retained.
    if (y0 < bandTop || y1 > bandBottom || x1 - x0 > maximumWeakWidth) continue;
    // A short faint mark at the observed boundary could be a clipped sign/dot.
    // Do not silently drop it merely because a grid could also live there.
    if (x0 <= left + 2 || x1 >= right - 2) return null;
    inkLeft = Math.min(inkLeft, x0); inkRight = Math.max(inkRight, x1);
    inkTop = Math.min(inkTop, y0); inkBottom = Math.max(inkBottom, y1);
  }
  const x0 = Math.max(left, inkLeft - margin);
  const x1 = Math.min(right, inkRight + margin);
  const y0 = Math.max(top, inkTop - margin);
  const y1 = Math.min(bottom, inkBottom + margin);
  if ((x1 - x0) >= contentWidth * 0.95 && (y1 - y0) >= contentHeight * 0.95) return null;
  return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
}

const clampIndex = (index: number, maximum: number) => Math.max(0, Math.min(maximum - 1, index));

/**
 * Alternate numeric-cell reading only: a perceptual-luminance percentile stretch
 * followed by very mild Gaussian unsharp masking. No threshold/new characters.
 * Analyze exactly the supplied gray pixels, including any caller-added padding.
 * Canvas ordering and crop geometry remain the caller's responsibility.
 */
export function normalizePrescriptionCellPixels(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  options: { sharpen?: boolean } = {},
): Uint8ClampedArray {
  const gray = grayValues(rgba, width, height);
  const lightness = new Float32Array(gray.length);
  const histogram = new Uint32Array(101);
  for (let pixel = 0; pixel < gray.length; pixel++) {
    const srgb = gray[pixel] / 255;
    const luminance = srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    const value = luminance > 216 / 24389 ? 116 * Math.cbrt(luminance) - 16 : luminance * 24389 / 27;
    lightness[pixel] = value;
    histogram[Math.max(0, Math.min(100, Math.floor(value)))]++;
  }
  const percentile = (fraction: number) => {
    let count = 0;
    for (let value = 0; value <= 100; value++) {
      count += histogram[value];
      if (count >= Math.max(1, gray.length * fraction)) return value;
    }
    return 100;
  };
  const low = percentile(0.01);
  const high = percentile(0.99);
  // Blank/near-flat cells must not become a page of amplified paper grain.
  if (high - low < 4) return grayscalePrescriptionPixels(rgba, width, height);
  const normalized = new Float32Array(gray.length);
  for (let pixel = 0; pixel < gray.length; pixel++) {
    normalized[pixel] = Math.max(0, Math.min(100, (lightness[pixel] - low) * 100 / (high - low)));
  }
  const side = Math.exp(-1 / (2 * 0.4 * 0.4));
  const denominator = (1 + 2 * side) ** 2;
  const output = new Uint8ClampedArray(rgba.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let weighted = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const weight = (dx === 0 ? 1 : side) * (dy === 0 ? 1 : side);
      weighted += normalized[clampIndex(y + dy, height) * width + clampIndex(x + dx, width)] * weight;
    }
    const value = normalized[y * width + x];
    const delta = options.sharpen === false ? 0 : Math.max(-6, Math.min(6, (value - weighted / denominator) * 0.5));
    const resultLightness = Math.max(0, Math.min(100, value + delta));
    const luminance = resultLightness > 8 ? ((resultLightness + 16) / 116) ** 3 : resultLightness * 27 / 24389;
    const srgb = luminance <= 0.0031308 ? luminance * 12.92 : 1.055 * luminance ** (1 / 2.4) - 0.055;
    const result = Math.max(0, Math.min(255, Math.round(srgb * 255)));
    const offset = (y * width + x) * 4;
    output[offset] = output[offset + 1] = output[offset + 2] = result;
    output[offset + 3] = 255;
  }
  return output;
}

function horizontalMean(gray: Uint8Array, width: number, row: number, radius: number, output: Float32Array) {
  const offset = row * width;
  const diameter = radius * 2 + 1;
  let sum = 0;
  for (let x = -radius; x <= radius; x++) sum += gray[offset + clampIndex(x, width)];
  for (let x = 0; x < width; x++) {
    output[x] = sum / diameter;
    sum += gray[offset + clampIndex(x + radius + 1, width)] - gray[offset + clampIndex(x - radius, width)];
  }
}

/**
 * Mild local contrast and bounded unsharp masking for an alternate OCR pass.
 * No binary/global threshold: small decimal dots and minus strokes retain
 * grayscale detail. This cannot reconstruct characters absent from the photo.
 */
export function enhancePrescriptionPixels(rgba: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const gray = grayValues(rgba, width, height);
  const output = new Uint8ClampedArray(rgba.length);
  const radius = 12;
  const diameter = radius * 2 + 1;
  // A rolling ring avoids a full-image integral or floating-point blur buffer.
  const ring = Array.from({ length: diameter }, () => new Float32Array(width));
  const columnSums = new Float64Array(width);
  for (let row = 0; row < diameter; row++) {
    horizontalMean(gray, width, clampIndex(row - radius, height), radius, ring[row]);
    for (let x = 0; x < width; x++) columnSums[x] += ring[row][x];
  }
  let ringSlot = 0;
  for (let y = 0; y < height; y++) {
    const previousRow = clampIndex(y - 1, height) * width;
    const row = y * width;
    const nextRow = clampIndex(y + 1, height) * width;
    for (let x = 0; x < width; x++) {
      const left = clampIndex(x - 1, width);
      const right = clampIndex(x + 1, width);
      const value = gray[row + x];
      const nearby = (gray[previousRow + left] + 2 * gray[previousRow + x] + gray[previousRow + right]
        + 2 * gray[row + left] + 4 * value + 2 * gray[row + right]
        + gray[nextRow + left] + 2 * gray[nextRow + x] + gray[nextRow + right]) / 16;
      const localMean = columnSums[x] / diameter;
      const delta = Math.max(-20, Math.min(20, (value - localMean) * 0.12 + (value - nearby) * 0.45));
      const sharpened = Math.max(0, Math.min(255, Math.round(value + delta)));
      const offset = (row + x) * 4;
      output[offset] = output[offset + 1] = output[offset + 2] = sharpened;
      output[offset + 3] = 255;
    }
    if (y + 1 < height) {
      const leaving = ring[ringSlot];
      for (let x = 0; x < width; x++) columnSums[x] -= leaving[x];
      horizontalMean(gray, width, clampIndex(y + radius + 1, height), radius, leaving);
      for (let x = 0; x < width; x++) columnSums[x] += leaving[x];
      ringSlot = (ringSlot + 1) % diameter;
    }
  }
  return output;
}

export interface PreparedPrescriptionScanImages {
  grayscale: HTMLCanvasElement;
  /** Lazy/cached alternate; call only when another reading is warranted. */
  getEnhanced: () => HTMLCanvasElement;
  /** Clears helper-owned canvases, never the caller's original photo. */
  dispose: () => void;
  plan: PrescriptionImagePlan;
}

export function preparePrescriptionScanImages(
  sourceCanvas: HTMLCanvasElement,
  crop: PrescriptionImageCrop,
  options: PrescriptionImageOptions = {},
): PreparedPrescriptionScanImages {
  const plan = planPrescriptionScanImage(sourceCanvas.width, sourceCanvas.height, crop, options);
  const grayscale = document.createElement("canvas");
  let enhanced: HTMLCanvasElement | null = null;
  let disposed = false;
  const dispose = () => {
    disposed = true;
    grayscale.width = grayscale.height = 0;
    if (enhanced) enhanced.width = enhanced.height = 0;
    enhanced = null;
  };
  try {
    grayscale.width = plan.width;
    grayscale.height = plan.height;
    const context = grayscale.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Local prescription image preparation is unavailable.");
    context.fillStyle = "white";
    context.fillRect(0, 0, plan.width, plan.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    const area = plan.source;
    context.drawImage(sourceCanvas, area.x, area.y, area.width, area.height, 0, 0, plan.width, plan.height);
    const pixels = context.getImageData(0, 0, plan.width, plan.height);
    pixels.data.set(grayscalePrescriptionPixels(pixels.data, plan.width, plan.height));
    context.putImageData(pixels, 0, 0);
    return {
      grayscale,
      plan,
      dispose,
      getEnhanced: () => {
        if (disposed) throw new Error("Prescription image preparation was closed.");
        if (enhanced) return enhanced;
        enhanced = document.createElement("canvas");
        try {
          enhanced.width = plan.width;
          enhanced.height = plan.height;
          const alternate = enhanced.getContext("2d", { willReadFrequently: true });
          if (!alternate) throw new Error("Local prescription image enhancement is unavailable.");
          const originalPixels = context.getImageData(0, 0, plan.width, plan.height);
          originalPixels.data.set(enhancePrescriptionPixels(originalPixels.data, plan.width, plan.height));
          alternate.putImageData(originalPixels, 0, 0);
          return enhanced;
        } catch (error) {
          enhanced.width = enhanced.height = 0;
          enhanced = null;
          throw error;
        }
      },
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
